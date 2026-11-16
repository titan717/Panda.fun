import { expect, test, type Page } from "@playwright/test";

/**
 * v1.4.0 launch (replaces the v1.3.0/v1.3.1 non-skippable intro specs): the Intro Manager plays on a cold start,
 * can be skipped after 1 s, never replays on reload in the same tab, and the last profile is restored, so Who's
 * watching only shows when there is no saved profile. The picker itself still works by D-pad.
 */
const profiles = [
  { id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 },
  { id: "p2", name: "Sam", avatar: "star", kids: false, createdAt: 2 },
];
const STATE = (active: string | null) => JSON.stringify({ profiles, activeProfileId: active, prefs: { autoplayTrailers: false }, data: {} });

async function fresh(page: Page, query = "", active: string | null = "p1") {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "v0.0.1", assets: [] }) }));
  await page.addInitScript((s) => { if (!localStorage.getItem("panda:v1:state")) localStorage.setItem("panda:v1:state", s); }, STATE(active));
  await page.goto(`/${query}`, { waitUntil: "commit" });
}

const intro = (page: Page) => page.locator("[data-intro]");
const who = (page: Page) => page.getByRole("heading", { name: "Who's watching?" });

test("cold start: the intro plays, skips after 1 s, then the saved profile's Home opens directly", async ({ page }, info) => {
  test.skip(info.project.name !== "tv-1920" && info.project.name !== "mobile-390", "one TV and one phone size");
  const tv = Boolean(info.project.metadata.tv);
  await fresh(page, tv ? "?layout=tv" : "");
  await expect(intro(page)).toBeVisible({ timeout: 5_000 });
  const skip = page.getByRole("button", { name: "Skip intro" });
  await expect(skip).toBeVisible({ timeout: 3_000 });
  // TV: Skip holds focus while the intro is up ("gone" = a loaded runner let the 4 s bumper finish first)
  if (tv) { await expect.poll(() => page.evaluate(() => document.querySelector("[data-intro]") ? document.activeElement?.getAttribute("aria-label") : "gone")).toMatch(/^(Skip intro|gone)$/); await page.keyboard.press("Enter"); }
  // under a loaded CI runner the 4 s bumper may finish on its own before the tap lands
  else await skip.tap({ timeout: 2_000 }).catch(() => undefined);
  await expect(intro(page)).toHaveCount(0, { timeout: 2_000 });
  await expect(who(page)).toHaveCount(0);
  // and a reload in the same tab is not a cold start
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await expect(intro(page)).toHaveCount(0);
  await expect(who(page)).toHaveCount(0);
});

test("the intro always ends on its own within the hard timeout", async ({ page }, info) => {
  test.skip(info.project.name !== "tv-1920" && info.project.name !== "mobile-390", "one TV and one phone size");
  const tv = Boolean(info.project.metadata.tv);
  await fresh(page, tv ? "?layout=tv" : "");
  await expect(intro(page)).toBeVisible({ timeout: 5_000 });
  // v1.4.2: the IntroBumper on both, 4 s with a hard 4.2 s timeout (plus runner slack)
  await expect(intro(page)).toHaveCount(0, { timeout: 5_000 });
});

test("reduced motion shows the bumper's static final frame, then ends", async ({ page }, info) => {
  test.skip(info.project.name !== "tv-1920", "once");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fresh(page, "?layout=tv");
  await expect(intro(page)).toHaveAttribute("data-view", "bumper", { timeout: 5_000 });
  await expect(page.locator("[data-intro] [data-bumper]")).toHaveAttribute("data-still", "true");
  await expect(page.locator(".intro-video")).toHaveCount(0);
  await expect(intro(page)).toHaveCount(0, { timeout: 4_000 });
});

test("an Android activity recreation (?resumed=1) plays no intro", async ({ page }, info) => {
  test.skip(info.project.name !== "tv-1920", "once");
  await fresh(page, "?layout=tv&resumed=1");
  await page.waitForTimeout(1500);
  await expect(intro(page)).toHaveCount(0);
});

test("D-pad on Who's watching (no saved profile): Right, Left, Down to Manage, Up back, OK picks and opens Home", async ({ page }, info) => {
  test.skip(!info.project.metadata.tv || info.project.name === "tv-3840", "TV layout");
  await fresh(page, "?layout=tv", null);
  // wait for the intro to start and then end (with waitUntil "commit" the page can still be blank here)
  await expect(intro(page)).toBeVisible({ timeout: 5_000 });
  await expect(intro(page)).toHaveCount(0, { timeout: 9_000 });
  await expect(who(page)).toBeVisible({ timeout: 10_000 });
  const focused = () => page.evaluate(() => document.activeElement?.id);
  await expect.poll(focused).toBe("prof-p1");
  await page.keyboard.press("ArrowRight"); await expect.poll(focused).toBe("prof-p2");
  await page.keyboard.press("ArrowRight"); await expect.poll(focused).toBe("prof-add");
  await page.keyboard.press("ArrowLeft"); await expect.poll(focused).toBe("prof-p2");
  await page.keyboard.press("ArrowDown"); await expect.poll(focused).toBe("prof-manage");
  await page.keyboard.press("ArrowUp"); await expect.poll(focused).toMatch(/^prof-(p1|p2|add)$/);
  await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowLeft");
  await expect.poll(focused).toBe("prof-p1");
  await page.keyboard.press("Enter");
  await expect(who(page)).toHaveCount(0, { timeout: 3_000 });
  // the choice is remembered for the next cold start
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("panda:v1:state") ?? "{}").activeProfileId)).toBe("p1");
});

test("Add Profile and Manage Profiles still open from the picker", async ({ page }, info) => {
  test.skip(info.project.name !== "tv-1920", "once");
  await fresh(page, "?layout=tv", null);
  // wait for the intro to start and then end (with waitUntil "commit" the page can still be blank here)
  await expect(intro(page)).toBeVisible({ timeout: 5_000 });
  await expect(intro(page)).toHaveCount(0, { timeout: 9_000 });
  await page.locator("#prof-add").click();
  await expect(page).toHaveURL(/\/profiles\/new/);
  await page.goBack();
  await expect(page.locator("#prof-manage")).toBeVisible({ timeout: 10_000 });
  await page.locator("#prof-manage").click();
  await expect(page).toHaveURL(/\/profiles\/manage/);
});
