import { expect, test, type Page } from "@playwright/test";

/** v1.3.1: the TV launch intro is the retro stop-motion paper-cutout film; phones keep the v1.3.0 intro. */
const STATE = JSON.stringify({
  profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }],
  activeProfileId: "p1", prefs: { autoplayTrailers: false }, data: {},
});

async function fresh(page: Page, query = "") {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "v0.0.1", assets: [] }) }));
  await page.addInitScript((s) => { if (!localStorage.getItem("panda:v1:state")) localStorage.setItem("panda:v1:state", s); }, STATE);
  await page.goto(`/${query}`, { waitUntil: "commit" });
}

test("TV: the film steps at 12 fps, assembles the panda, zooms into the eye and hands off within 6 s", async ({ page }, info) => {
  test.skip(!info.project.metadata.tv || info.project.name === "tv-3840", "TV layout");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await fresh(page, "?layout=tv");
  const film = page.locator(".intro-retro");
  await expect(film).toBeVisible({ timeout: 5_000 });
  const t0 = Date.now();
  await expect(page.locator(".intro-ribbons, .intro-face")).toHaveCount(0);
  // sample the frame counter: it only ever holds whole frames, moves forward, and at about 12 a second
  const seen = await page.evaluate(() => new Promise<number[]>((done) => {
    const out: number[] = []; const end = performance.now() + 1500;
    const tick = () => { out.push(Number(document.querySelector(".intro-retro")?.getAttribute("data-frame") ?? -1)); if (performance.now() < end) requestAnimationFrame(tick); else done(out); };
    requestAnimationFrame(tick);
  }));
  const distinct = [...new Set(seen)];
  // never more than 12 drawings a second (stepped), and the clock never waits: a slow renderer (software
  // rendering here) skips to the right drawing and, if it keeps falling behind, drops to lite effects
  expect(distinct.length).toBeGreaterThanOrEqual(6);
  expect(distinct.length).toBeLessThanOrEqual(19);
  for (let i = 1; i < seen.length; i++) expect(seen[i]!).toBeGreaterThanOrEqual(seen[i - 1]!);
  expect(seen.every((f) => Number.isInteger(f) && f >= 0 && f <= 60)).toBe(true);
  expect(seen.at(-1)! - seen[0]!).toBeGreaterThanOrEqual(15); // ~18 frames of clock in 1.5 s
  // the assembled panda with blue eyes and gold rings
  await expect(page.locator('[data-piece="shades"]')).toHaveCount(1, { timeout: 3_000 });
  await expect(page.locator('[data-piece="bamboo"]')).toHaveCount(1);
  await expect(page.locator("[data-eye]")).toHaveCount(2);
  expect(await page.locator("[data-eye] circle[r='25']").first().getAttribute("fill")).toBe("#36b3ff");
  // the zoom into the left eye
  await expect.poll(() => page.locator("[data-cam]").getAttribute("transform"), { timeout: 3_000 }).toMatch(/scale\((1\d|2\d)\.\d+\) translate\(-69\d/);
  await expect(page.locator("[data-intro]")).toHaveClass(/is-leaving/, { timeout: 3_000 });
  await expect(page.locator("[data-intro]")).toHaveCount(0, { timeout: 2_000 });
  expect(Date.now() - t0).toBeLessThan(6_000);
  await expect(page.getByRole("heading", { name: "Who's watching?" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("TV: reduced motion shows the assembled panda as one still frame", async ({ page }, info) => {
  test.skip(info.project.name !== "tv-1920", "once");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fresh(page, "?layout=tv");
  const film = page.locator(".intro-retro");
  await expect(film).toBeVisible({ timeout: 5_000 });
  const f = await film.getAttribute("data-frame");
  await expect(page.locator("[data-piece]")).toHaveCount(16);
  await page.waitForTimeout(300);
  expect(await film.getAttribute("data-frame")).toBe(f);
  await expect(page.locator("[data-intro]")).toHaveCount(0, { timeout: 2_000 });
});

test("TV lite mode (low-memory device) draws the film without boil, shadows or grain", async ({ page }, info) => {
  test.skip(info.project.name !== "tv-1280", "once");
  await page.addInitScript(() => Object.defineProperty(navigator, "deviceMemory", { get: () => 1 }));
  await fresh(page, "?layout=tv");
  await expect(page.locator(".intro-retro--lite")).toBeVisible({ timeout: 5_000 });
  await expect(page.locator("#pf-boil, #pf-paper, [data-grain]")).toHaveCount(0);
  await expect(page.locator("[data-intro]")).toHaveCount(0, { timeout: 7_000 });
});

test("phones keep the v1.3.0 intro", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile-390", "once");
  await fresh(page);
  await expect(page.locator("[data-intro]")).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(".intro-face")).toHaveCount(1);
  await expect(page.locator(".intro-retro")).toHaveCount(0);
  await expect(page.locator("[data-intro]")).toHaveCount(0, { timeout: 3_500 });
});
