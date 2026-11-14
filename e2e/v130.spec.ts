import { expect, test, type Page } from "@playwright/test";

/** v1.3.0: the launch intro cannot be skipped, ends on time, hands off to Who's watching, and the picker works by D-pad. */
const STATE = JSON.stringify({
  profiles: [
    { id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 },
    { id: "p2", name: "Sam", avatar: "star", kids: false, createdAt: 2 },
  ],
  activeProfileId: "p1", prefs: { autoplayTrailers: false }, data: {},
});

async function fresh(page: Page, query = "") {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "v0.0.1", assets: [] }) }));
  await page.addInitScript((s) => { if (!localStorage.getItem("panda:v1:state")) localStorage.setItem("panda:v1:state", s); }, STATE);
  await page.goto(`/${query}`, { waitUntil: "commit" });
}

/** Wait for the intro to appear and then hand off (it cannot be skipped). */
async function afterIntro(page: Page) {
  await expect(page.locator("[data-intro]")).toHaveCount(1, { timeout: 5_000 });
  await expect(page.locator("[data-intro]")).toHaveCount(0, { timeout: 7_000 });
}

test("the intro ignores keys, clicks and taps, then ends on time and hands focus to the picker", async ({ page }, info) => {
  test.skip(info.project.name !== "tv-1920" && info.project.name !== "mobile-390", "one TV and one phone size");
  const tv = Boolean(info.project.metadata.tv);
  await fresh(page, tv ? "?layout=tv" : "");
  const intro = page.locator("[data-intro]");
  await expect(intro).toBeVisible({ timeout: 5_000 });
  const t0 = Date.now();
  // hammer it: remote keys, Back (Escape), clicks and taps
  for (const k of ["Enter", "Escape", "ArrowRight", "Backspace", " ", "ArrowDown"]) { await page.keyboard.press(k); }
  await page.mouse.click(400, 300);
  if (!tv) await page.touchscreen.tap(200, 400);
  await expect(intro).toBeVisible();
  // still on screen shortly before its end
  // (v1.3.1: the TV film runs 5 s with a 6 s hard timeout; phones keep 2.4 s / 3 s)
  await page.waitForTimeout(Math.max(0, (tv ? 4400 : 1900) - (Date.now() - t0)));
  await expect(intro).toHaveCount(1);
  // and gone well within the hard timeout
  await expect(intro).toHaveCount(0, { timeout: tv ? 2_000 : 1_400 });
  await expect(page.getByRole("heading", { name: "Who's watching?" })).toBeVisible();
  // none of those keys moved focus or picked a profile underneath
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("prof-p1");
  expect(await page.evaluate(() => sessionStorage.getItem("panda:who"))).toBeNull();
});

test("the intro's horizon lands on the picker's horizon", async ({ page }, info) => {
  test.skip(info.project.name !== "tv-1920" && info.project.name !== "mobile-390", "one TV and one phone size");
  const tv = Boolean(info.project.metadata.tv);
  await fresh(page, tv ? "?layout=tv" : "");
  await expect(page.locator(".intro-horizon")).toHaveCount(1);
  // measured during the final fade, when both lines are on screen together (rAF polling: the window is short)
  const handle = await page.waitForFunction(() => {
    const i = document.querySelector(".intro.is-leaving .intro-horizon");
    const p = document.querySelector(".profiles-arc");
    if (!i || !p) return null;
    return { a: { y: i.getBoundingClientRect().y }, b: { y: p.getBoundingClientRect().y } };
  }, null, { polling: "raf", timeout: 5_000 });
  const { a, b } = (await handle.jsonValue())!;
  expect(a && b).toBeTruthy();
  expect(Math.abs(a!.y - b!.y)).toBeLessThanOrEqual(1);
  expect(a!.y / page.viewportSize()!.height).toBeCloseTo(tv ? 0.78 : 0.68, 2);
});

test("reduced motion shows a short still frame, still not skippable", async ({ page }, info) => {
  test.skip(info.project.name !== "tv-1920", "once");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fresh(page, "?layout=tv");
  const intro = page.locator("[data-intro]");
  await expect(intro).toHaveClass(/intro--still/);
  await page.keyboard.press("Enter");
  await expect(intro).toHaveCount(1);
  await expect(intro).toHaveCount(0, { timeout: 2_000 });
});

test("D-pad on Who's watching: Right, Left, Down to Manage, Up back, OK picks and opens Home", async ({ page }, info) => {
  test.skip(!info.project.metadata.tv || info.project.name === "tv-3840", "TV layout");
  await fresh(page, "?layout=tv");
  await afterIntro(page);
  const focused = () => page.evaluate(() => document.activeElement?.id);
  await expect.poll(focused).toBe("prof-p1");
  await page.keyboard.press("ArrowRight"); await expect.poll(focused).toBe("prof-p2");
  await page.keyboard.press("ArrowRight"); await expect.poll(focused).toBe("prof-add");
  await page.keyboard.press("ArrowLeft"); await expect.poll(focused).toBe("prof-p2");
  // the focused avatar lifts off the line and glows
  const lift = await page.locator("#prof-p2 .profile-lift").evaluate((el) => getComputedStyle(el).transform);
  expect(lift).not.toBe("none");
  await expect.poll(async () => Number(await page.locator("#prof-p2 .profile-glow").evaluate((el) => getComputedStyle(el).opacity))).toBeGreaterThan(0.5);
  await page.keyboard.press("ArrowDown"); await expect.poll(focused).toBe("prof-manage");
  await page.keyboard.press("ArrowUp"); await expect.poll(focused).toMatch(/^prof-(p1|p2|add)$/);
  await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowLeft");
  await expect.poll(focused).toBe("prof-p1");
  await page.keyboard.press("Enter");
  await expect(page.locator(".profiles.is-choosing")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Who's watching?" })).toHaveCount(0, { timeout: 3_000 });
  await expect(page.locator(".who-veil")).toHaveCount(0, { timeout: 2_000 });
  expect(await page.evaluate(() => sessionStorage.getItem("panda:who"))).toBe("1");
});

test("Add Profile and Manage Profiles still open from the picker", async ({ page }, info) => {
  test.skip(info.project.name !== "tv-1920", "once");
  await fresh(page, "?layout=tv");
  await afterIntro(page);
  await page.locator("#prof-add").click();
  await expect(page).toHaveURL(/\/profiles\/new/);
  await page.goBack();
  await expect(page.locator("#prof-manage")).toBeVisible({ timeout: 10_000 });
  await page.locator("#prof-manage").click();
  await expect(page).toHaveURL(/\/profiles\/manage/);
});
