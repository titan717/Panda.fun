import { expect, test, type Page } from "@playwright/test";

/**
 * v1.5.0 Panda Intelligence specs: the infinite Home category feed (never a short rail, rails appended as you go,
 * TV focus kept), mood discovery on Search, and the Taste DNA / Entertainment Memory page (forget, reset).
 * Runs against the live Panda API, like smoke.spec.ts.
 */
const NOW = Date.now();
const item = (id: string, title: string, genres: string[], language: string) => ({
  id, tmdbId: Number(id.split(":")[1]), type: id.split(":")[0], title, year: 2019, rating: 8, poster: null, posterLarge: null,
  backdrop: null, backdropLarge: null, overview: null, genres, language, releaseDate: "2019-05-30"
});
const history: Record<string, unknown> = {};
[item("movie:496243", "Parasite", ["Thriller", "Drama", "Comedy"], "ko"), item("movie:670", "Oldboy", ["Thriller", "Mystery", "Action"], "ko"), item("movie:27205", "Inception", ["Action", "Science Fiction", "Adventure"], "en")]
  .forEach((x, i) => { history[x.id] = { item: x, position: 7000, duration: 7200, completed: true, upNext: false, updatedAt: NOW - i * 86_400_000 }; });
const STATE = JSON.stringify({
  profiles: [{ id: "p1", name: "Asha", avatar: "smile", kids: false, createdAt: 1 }],
  activeProfileId: "p1", prefs: { autoplayTrailers: false }, data: { p1: { history, watchlist: [], ratings: {} } }
});
const TASTE = JSON.stringify({
  v: 1,
  profiles: { p1: { v: 1, genres: ["Thriller", "Crime"], contentType: "both", popularity: "mix", era: "mix", length: "mix", pace: "mix", completedAt: NOW, skipped: false } },
  drafts: {}, seen: ["p1"], welcomed: true
});

async function open(page: Page, path: string, tv: boolean) {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "v0.0.1", assets: [] }) }));
  await page.addInitScript(({ s, t }) => {
    if (!localStorage.getItem("panda:v1:state")) { localStorage.setItem("panda:v1:state", s); localStorage.setItem("panda:v1:taste", t); }
    sessionStorage.setItem("panda:v1:intro-session", "e2e");
    sessionStorage.setItem("panda:v1:bumper", "off");
  }, { s: STATE, t: TASTE });
  const sep = path.includes("?") ? "&" : "?";
  await page.goto(`${path}${sep}layout=${tv ? "tv" : "mobile"}`, { waitUntil: "domcontentloaded" });
}

test("Home grows category rails as you go, and never shows a short rail", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  test.setTimeout(90_000);
  await open(page, "/", tv);
  const rails = page.locator("[data-feed-cat]");
  await expect(rails.first()).toBeVisible({ timeout: 40_000 });
  const before = await rails.count();
  if (tv) {
    await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest(".tv-home"))), { timeout: 15_000 }).toBe(true);
    for (let i = 0; i < 24; i++) { await page.keyboard.press("ArrowDown"); await page.waitForTimeout(i % 6 === 5 ? 1200 : 350); }
    const f = await page.evaluate(() => { const a = document.activeElement as HTMLElement | null; const r = a?.getBoundingClientRect(); return { inRow: Boolean(a?.closest("[data-row]")), top: r?.top ?? -1, h: innerHeight }; });
    expect(f.inRow).toBe(true);
    expect(f.top).toBeGreaterThanOrEqual(0);
    expect(f.top).toBeLessThan(f.h);
  } else {
    for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 1600); await page.waitForTimeout(600); }
  }
  await expect.poll(() => rails.count(), { timeout: 30_000 }).toBeGreaterThan(before);
  const counts = await rails.evaluateAll((els) => els.map((e) => e.querySelectorAll("a").length));
  for (const n of counts) expect(n).toBeGreaterThanOrEqual(6);
});

test("Search offers moods before typing and recognises a mood in a query", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  await open(page, "/search", tv);
  await expect(page.locator("#mood-scary")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".mood-chip")).toHaveCount(11);
  await page.locator("input[type=search]").fill("something scary");
  await expect(page.locator("#mood-hit-movie")).toHaveAttribute("href", /\/browse\/movie\?genre=27%7C53/, { timeout: 15_000 });
  await page.locator("#mood-hit-movie").click();
  await expect(page.getByRole("heading", { name: "Scary Movies" })).toBeVisible();
});

test("Taste DNA shows what was learned on the device, and Forget / Reset work", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  await open(page, "/taste-dna", tv);
  await expect(page.locator(".taste-intro")).toContainText("never uploaded");
  await expect(page.locator(".taste-list .taste-item").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".taste-list")).toContainText(["Thriller"]);
  if (tv) expect(await page.evaluate(() => document.activeElement?.classList.contains("taste-btn"))).toBe(true);
  const memory = page.locator(".taste-memory .taste-item");
  await expect(memory).toHaveCount(3);
  await memory.filter({ hasText: "Inception" }).getByRole("button", { name: "Forget" }).click();
  await expect(memory).toHaveCount(2);
  const reset = page.locator(".taste-reset");
  await reset.click();
  await expect(reset).toContainText("Press again");
  await reset.click();
  await expect(page.locator(".taste-intro")).toContainText("Nothing learned yet", { timeout: 10_000 });
});
