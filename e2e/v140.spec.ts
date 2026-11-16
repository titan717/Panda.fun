import { expect, test, type Page } from "@playwright/test";

/**
 * v1.4.0 release specs (directive §8, §10, §7, §4): Panda Top Picks on Search, the TV hold-OK feedback menu,
 * Search focus memory after Details → Back, the on-device playback health panel, and "Season N" labels.
 * Runs against the live Panda API, like smoke.spec.ts.
 */
const NOW = Date.now();
const STATE = JSON.stringify({
  profiles: [{ id: "p1", name: "Asha", avatar: "smile", kids: false, createdAt: 1 }],
  activeProfileId: "p1", prefs: { autoplayTrailers: false }, data: {},
});
const TASTE = JSON.stringify({
  v: 1,
  profiles: { p1: { v: 1, genres: ["Thriller", "Crime"], contentType: "both", popularity: "mix", era: "mix", length: "mix", pace: "mix", completedAt: NOW, skipped: false } },
  drafts: {}, seen: ["p1"], welcomed: true,
});

async function open(page: Page, path: string, tv: boolean, extra: Record<string, string> = {}) {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "v0.0.1", assets: [] }) }));
  await page.addInitScript(({ s, t, x }) => {
    if (!localStorage.getItem("panda:v1:state")) {
      localStorage.setItem("panda:v1:state", s);
      localStorage.setItem("panda:v1:taste", t);
      for (const [k, v] of Object.entries(x)) localStorage.setItem(k, v);
    }
    sessionStorage.setItem("panda:v1:intro-session", "e2e"); sessionStorage.setItem("panda:v1:bumper", "off");
  }, { s: STATE, t: TASTE, x: extra });
  const sep = path.includes("?") ? "&" : "?";
  await page.goto(`${path}${sep}layout=${tv ? "tv" : "mobile"}`, { waitUntil: "domcontentloaded" });
}

const focusedId = (page: Page) => page.evaluate(() => document.activeElement?.id ?? "");

test("Search opens on Panda Top Picks, with real reasons and no fabricated ones", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  test.setTimeout(60_000);
  await open(page, "/search", tv);
  const top = tv ? page.locator("#reco-top-picks") : page.locator(".m-reco--top");
  await expect(top).toBeVisible({ timeout: 30_000 });
  await expect(top).toContainText("Panda Top Picks for Asha");
  // Top Picks is the first discovery row
  const first = tv ? page.locator(".tv-discover > [data-row]").first() : page.locator(".m-discover > section").first();
  await expect(first).toHaveAttribute("data-reco-surface", "top-picks");
  // every reason on screen names a checkable cause
  const reasons = tv ? [] : await page.locator(".m-reco--top .m-reco-reason").allTextContents();
  if (tv) {
    await page.locator("#res-0").focus();
    const why = (await page.locator("#reco-top-picks .tv-reco-why").textContent())?.trim() ?? "";
    if (why) reasons.push(why);
  }
  for (const r of reasons) expect(r).toMatch(/^(Because you|You picked|You rate|You save|You watch|Trending now|Rated \d|New in \d{4})/);
  for (const r of reasons) { expect(r).not.toMatch(/you'?ll love|perfect for you/i); expect(r).not.toMatch(/\bAI\b/); }
});

test("TV: hold OK opens the feedback menu; a short OK still opens the title; Back restores the card", async ({ page }, info) => {
  test.skip(!info.project.metadata.tv, "remote");
  test.setTimeout(90_000);
  await open(page, "/search", true);
  await expect(page.locator("#reco-top-picks")).toBeVisible({ timeout: 30_000 });
  await page.locator("#res-0").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const card = await focusedId(page);
  expect(card).toMatch(/^reco-top-picks-2$/);

  // long press
  await page.keyboard.down("Enter");
  await page.waitForTimeout(800);
  await page.keyboard.up("Enter");
  const menu = page.getByRole("dialog");
  await expect(menu).toBeVisible();
  await expect(menu).toContainText("More like this");
  await expect(menu).toContainText("Not interested");
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect.poll(() => focusedId(page)).toBe(card);

  // short press opens Details, Back returns to the same card
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/title\//, { timeout: 15_000 });
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/search/, { timeout: 15_000 });
  await expect.poll(() => focusedId(page), { timeout: 15_000 }).toBe(card);
});

test("TV: Up/Down between discovery rows keeps each row's column", async ({ page }, info) => {
  test.skip(!info.project.metadata.tv, "remote");
  test.setTimeout(60_000);
  await open(page, "/search", true);
  await expect(page.locator(".tv-discover > [data-row]").nth(1)).toBeVisible({ timeout: 30_000 });
  await page.locator("#res-0").focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  const top = await focusedId(page);
  await page.keyboard.press("ArrowDown");
  const second = await focusedId(page);
  expect(second).not.toBe(top);
  expect(second).toMatch(/^reco-/);
  await page.keyboard.press("ArrowUp");
  await expect.poll(() => focusedId(page)).toBe(top);
});

test("Settings › Playback health lists this device's failures and clears them", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  const platform = info.project.use.hasTouch ? "mobile" : "browser";
  const rec = { v: 1, contentId: 550, contentType: "movie", platform, profileId: "p1", attempted: ["cinesrc", "vidy"], reason: "timeout", failedAt: NOW - 1000, failures: 1, lastVerified: "failed", suppressedUntil: NOW + 86_400_000, recovery: "suppressed" };
  await open(page, "/settings/sources", tv, { "panda:v1:playhealth": JSON.stringify({ [`${platform}:movie:550`]: rec }) });
  if (tv) await page.locator("#set-sources").focus();
  const note = page.locator("#sp-device-health");
  await expect(note).toContainText("1 title failed on every player recently");
  await expect(note).toContainText("kept out of recommendations");
  await page.locator("#sp-health-clear").click();
  await expect(note).toContainText("No playback problems recorded");
  expect(await page.evaluate(() => localStorage.getItem("panda:v1:playhealth"))).toBeNull();
});

test("Series details label seasons \"Season N\" and never show Arc names", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  test.setTimeout(60_000);
  await open(page, "/title/tv/1399", tv); // Game of Thrones: 8 seasons
  const seasons = tv ? page.locator(".tv-season") : page.locator(".m-season-chip");
  await expect(seasons.first()).toBeVisible({ timeout: 30_000 });
  const labels = (await seasons.allTextContents()).map((s) => s.trim()).filter(Boolean);
  expect(labels.length).toBeGreaterThan(0);
  for (const l of labels) expect(l).toMatch(/^(Season \d+|Specials)/);
  await expect(page.locator("body")).not.toContainText(/\bArc\b/);
});
