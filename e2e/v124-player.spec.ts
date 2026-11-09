import { expect, test, type Page } from "@playwright/test";

/** v1.2.4 player: ad-tier order, VidLink adapter, buffering + stall recovery, resume prompt, seek bubble, TTFF. */
const STATE = (prefs: Record<string, unknown> = {}) => JSON.stringify({
  profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }],
  activeProfileId: "p1", prefs: { autoplayTrailers: false, subtitleMode: "off", ...prefs }, data: {},
});
const ok = (data: unknown) => ({ contentType: "application/json", body: JSON.stringify({ success: true, data }) });
const cinesrc = { id: "cinesrc", provider: "cinesrc", label: "CineSrc", url: "https://cinesrc.st/embed/movie/550", origin: "https://cinesrc.st", events: "cinesrc", supportsStart: true, tier: 1 };
const vidlink = { id: "vidlink", provider: "vidlink", label: "VidLink", url: "https://vidlink.pro/movie/550?primaryColor=1f80e0", origin: "https://vidlink.pro", events: "vidy", supportsStart: true, tier: 3 };
const vidy = { id: "vidy", provider: "vidy", label: "Vidy", url: "https://www.vidy.st/movie/550", origin: "https://www.vidy.st", events: "vidy", supportsStart: true, tier: 2 };
/** stand-in CineSrc embed; `stopAt` = seconds of wall time after which it stops reporting (a stall) */
const embed = (stopAt = 0) => `<!doctype html><body style="background:#246;margin:0"><script>
let t = 5; const send = (type, data) => parent.postMessage({ type, data }, "*"); const t0 = Date.now();
window.cmds = []; addEventListener("message", (e) => { if (e.data && e.data.type === "cinesrc:command") { cmds.push(e.data.command); if (e.data.command === "seek") t = e.data.args[0]; } });
send("cinesrc:ready", {}); send("cinesrc:loadedmetadata", { duration: 3000 }); send("cinesrc:play", {});
setInterval(() => { if (${stopAt} && Date.now() - t0 > ${stopAt} * 1000) return; t += 0.25; send("cinesrc:timeupdate", { currentTime: t, duration: 3000 }); }, 250);
</script></body>`;

async function open(page: Page, path: string, tv: boolean, sources: unknown[], stopAt = 0) {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "v0.0.1", assets: [] }) }));
  await page.route(/\/api\/v1\/panda\/subtitles\//, (r) => r.fulfill(ok({ imdbId: null, season: null, episode: null, tracks: [] })));
  await page.route(/\/api\/v1\/panda\/report/, (r) => r.fulfill(ok({ received: true, counted: true })));
  await page.route(/\/api\/v1\/panda\/play\/movie\/550/, (r) => r.fulfill(ok({ type: "movie", tmdbId: 550, sources })));
  let loads = 0;
  await page.route(/^https:\/\/cinesrc\.st\/embed\//, (r) => { loads++; return r.fulfill({ contentType: "text/html", body: embed(loads === 1 ? stopAt : 0) }); });
  await page.route(/^https:\/\/(vidlink\.pro|www\.vidy\.st)\//, (r) => r.fulfill({ contentType: "text/html", body: "<!doctype html><body style='background:#422'></body>" }));
  await page.addInitScript((s) => { if (!localStorage.getItem("panda:v1:state")) localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1"); }, STATE());
  await page.goto(`${path}${path.includes("?") ? "&" : "?"}layout=${tv ? "tv" : "mobile"}`, { waitUntil: "domcontentloaded" });
  return { loads: () => loads };
}

test("the ad tier outranks the order the backend sent: CineSrc (tier 1) plays before VidLink", async ({ page }, info) => {
  await open(page, "/watch/movie/550", Boolean(info.project.metadata.tv), [vidlink, vidy, cinesrc]);
  const frame = page.locator("iframe.player-frame");
  await expect(frame).toHaveCount(1, { timeout: 30_000 });
  expect(new URL((await frame.getAttribute("src"))!).hostname).toBe("cinesrc.st");
  // time to first frame is measured and kept per source
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("panda:ttff") ?? "{}").cinesrc?.length ?? 0), { timeout: 20_000 }).toBeGreaterThan(0);
});

test("a stall shows the buffering ring, then a recovery card that retries or switches", async ({ page }, info) => {
  test.setTimeout(90_000);
  const tv = Boolean(info.project.metadata.tv);
  const h = await open(page, "/watch/movie/550", tv, [cinesrc, vidy], 3);
  await expect(page.locator("#pl-buffering")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#pl-stall")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#pl-stall")).toContainText("CineSrc stopped playing");
  await expect(page.locator("#pl-stall")).toContainText(/Switching to Vidy in \d+ s/);
  await expect(page.locator("#pl-stall-switch")).toBeVisible();
  await expect(page.locator("#pl-stall-report")).toBeVisible();
  if (tv) await expect(page.locator("#pl-stall-retry")).toBeFocused();
  await page.locator("#pl-stall-retry").click();
  await expect(page.locator("#pl-stall")).toHaveCount(0);
  await expect.poll(() => h.loads()).toBe(2);
  await expect(page.locator("#pl-buffering")).toHaveCount(0, { timeout: 15_000 });
});

test("opening at a saved position offers Resume or Start over", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  await open(page, "/watch/movie/550?t=1394", tv, [cinesrc]);
  const go = page.locator("#pl-resume-go");
  await expect(go).toHaveText(/Resume from 23:14/, { timeout: 30_000 });
  await expect(page.locator("#pl-resume-over")).toHaveText(/Start over/);
  expect(new URL((await page.locator("iframe.player-frame").getAttribute("src"))!).searchParams.get("t")).toBeNull();
  await page.locator("#pl-resume-over").click();
  await expect(page.locator("#pl-resume")).toHaveCount(0);
  const cmds = await page.frameLocator("iframe.player-frame").locator("body").evaluate(() => (window as unknown as { cmds: string[] }).cmds);
  expect(cmds).toContain("seek");
});

test("TV: a burst of presses accumulates the seek and the bubble shows the jump", async ({ page }, info) => {
  test.skip(!info.project.metadata.tv, "remote seek");
  await open(page, "/watch/movie/550", true, [cinesrc]);
  const track = page.locator("#tvp-track");
  await expect(track).toBeAttached({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await track.focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight", { delay: 30 });
  const bubble = page.locator("#tvp-seek-bubble");
  await expect(bubble).toBeVisible();
  // 4 × 10 s + 2 × 20 s = +1:20
  await expect(bubble).toContainText("+1:20");
});
