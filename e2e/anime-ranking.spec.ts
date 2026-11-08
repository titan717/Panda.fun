import { expect, test, type Page } from "@playwright/test";

/** v1.2.0: Anime page (AniList), community source ranking in Settings, Report an Issue in the player. */
const STATE = JSON.stringify({
  profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }],
  activeProfileId: "p1", prefs: { autoplayTrailers: false }, data: {},
});
const ok = (data: unknown) => ({ contentType: "application/json", body: JSON.stringify({ success: true, data }) });
const card = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `tv:${9000 + n}`, tmdbId: 9000 + n, type: "tv", title: `Anime ${n}`, year: 2026, poster: null, backdrop: null,
  overview: "A test anime.", genres: ["Animation"], language: "ja", anilistId: 100 + n, color: "#e4a15d", score: 8.1, studio: "MAPPA", ...extra,
});
const ANIME = {
  hero: card(0, { airing: { episode: 6, at: new Date(Date.now() + 2 * 86_400_000).toISOString() } }),
  rows: [
    { id: "trending", title: "Trending Anime", items: [card(1), card(2), card(3), card(4)] },
    { id: "season", title: "This Season", items: [card(5), card(6), card(7), card(8)] },
  ],
  season: { name: "FALL", year: 2026 },
};
const RANKING = {
  sources: [
    { id: "vidy", rank: 1, score: 0.91, reliability: 0.94, plays: 120, reports: 4, reports24h: 0, state: "healthy" },
    { id: "cinesrc", rank: 2, score: 0.7, reliability: 0.78, plays: 80, reports: 20, reports24h: 5, state: "healthy" },
    { id: "vidyanime", rank: 3, score: 0.5, reliability: null, plays: 0, reports: 0, reports24h: 0, state: "healthy" },
  ],
  halfLifeHours: 72, shared: false, updatedAt: new Date().toISOString(),
};

async function open(page: Page, path: string, tv: boolean, state = STATE) {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "v0.0.1", assets: [] }) }));
  await page.route(/\/api\/v1\/panda\/anime$/, (r) => r.fulfill(ok(ANIME)));
  await page.route(/\/api\/v1\/panda\/sources\/ranking/, (r) => r.fulfill(ok(RANKING)));
  await page.addInitScript((s) => { if (!localStorage.getItem("panda:v1:state")) localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1"); }, state);
  await page.goto(`${path}${path.includes("?") ? "&" : "?"}layout=${tv ? "tv" : "mobile"}`, { waitUntil: "domcontentloaded" });
}

test("Anime page shows the AniList hero and rows, and cards open the title", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  await open(page, "/anime", tv);
  await expect(page.locator(".anime-name")).toHaveText("Anime 0");
  await expect(page.locator(".anime-airing")).toContainText("Ep 6 in 2d");
  await expect(page.locator("#anime-trending-0")).toBeVisible();
  await expect(page.locator("#anime-season-3")).toBeAttached();
  await expect(page.locator(".anime-credit")).toContainText("AniList");
  await page.locator("#anime-trending-1").click();
  await expect(page).toHaveURL(/\/title\/tv\/9002/);
});

test("Settings › Sources defaults to Automatic and shows the community ranking", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  await open(page, "/settings/sources", tv);
  if (tv) await page.locator("#set-sources").focus();
  await expect(page.locator("#src-auto")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("#sp-ranking")).toBeVisible();
  await expect(page.locator("#sp-ranking li").first()).toContainText("Vidy");
  await expect(page.locator("#sp-rank-cinesrc")).toContainText("Reported 5× today");
  await page.locator("#src-cinesrc").click();
  await expect.poll(() => page.evaluate(() => { const s = JSON.parse(localStorage.getItem("panda:v1:state") ?? "{}"); return { ...s.prefs, ...(s.profilePrefs?.[s.activeProfileId] ?? {}) }.preferredSource; })).toBe("cinesrc");
});

test("Report an Issue on a source with its own controls sends the report to the ranking", async ({ page }, info) => {
  test.skip(Boolean(info.project.metadata.tv), "phone player chrome");
  const reports: { source?: string; issue?: string }[] = [];
  await page.route(/\/api\/v1\/panda\/report/, async (r) => { reports.push(JSON.parse(r.request().postData() ?? "{}")); await r.fulfill(ok({ received: true, counted: true })); });
  // only Vidy answers, so the phone player shows Panda's Report chip over Vidy's own controls
  await page.route(/\/api\/v1\/panda\/play\/movie\/550/, (r) => r.fulfill(ok({ type: "movie", tmdbId: 550, sources: [{ id: "vidy", provider: "vidy", label: "Vidy", url: "https://www.vidy.st/embed/movie/550", origin: "https://www.vidy.st", events: "vidy", supportsStart: true }] })));
  await open(page, "/watch/movie/550", false);
  const frame = page.locator("iframe.player-frame");
  await expect(frame).toHaveCount(1, { timeout: 30_000 });
  expect(new URL((await frame.getAttribute("src"))!).hostname).toMatch(/vidy\.st$/);
  await expect(page.locator("#pl-src-vidy .src-rel-dot.src-rel--good")).toBeAttached();
  await page.locator("#pl-report").click();
  await expect(page.locator(".sheet--report")).toBeVisible();
  await expect(page.locator("#pl-issue-subs")).toBeVisible();
  await page.locator("#pl-issue-wrong").click();
  await expect.poll(() => reports.some((r) => r.issue === "wrong" && r.source === "vidy")).toBe(true);
  await expect(page.locator(".sheet--report")).toHaveCount(0);
});
