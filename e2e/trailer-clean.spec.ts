import { expect, test } from "@playwright/test";

/**
 * Clean trailers release gate (MASTER V4 §4.B, docs/TRAILERS.md). YouTube is replaced by a stand-in
 * IFrame API and embed page, so the test is deterministic: it checks the iframe Panda builds
 * (host, parameters, sandbox, permissions, no pointer or focus), that nothing is visible before
 * PLAYING + reveal delay, that a stall hides the frame, and that clicks, right-clicks and keys
 * over the trailer open nothing and never navigate away.
 */
const STATE = JSON.stringify({
  profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }],
  activeProfileId: "p1", prefs: { trailerAutoplay: true, autoplayTrailers: true, trailerDelay: 3, trailerSound: false }, data: {},
});
const FAKE_API = `(() => {
  const players = [];
  window.__yt = { players, set: (s) => players.forEach((p) => p.set(s)), playingAt: 0, playCalls: [] };
  class Player {
    constructor(el, opts) { this.el = el; this.opts = opts; this.state = -1; this.t = 0; players.push(this); setTimeout(() => opts.events.onReady({ target: this }), 50); }
    set(s) { this.state = s; if (s === 1 && !window.__yt.playingAt) window.__yt.playingAt = performance.now(); this.opts.events.onStateChange({ data: s, target: this }); }
    playVideo() { window.__yt.playCalls.push(performance.now()); if (this.state !== 1) setTimeout(() => this.set(1), 150); }
    pauseVideo() { this.state = 2; } mute() {} unMute() {} isMuted() { return true; } setVolume() {}
    getPlayerState() { return this.state; } getCurrentTime() { return this.t; } getDuration() { return 120; } seekTo(t) { this.t = t; }
    getIframe() { return this.el; } destroy() {}
  }
  window.YT = { Player };
  setTimeout(() => window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady(), 0);
})();`;
// the embed tries everything an ad or a YouTube end screen would: links, window.open, top navigation
const FAKE_EMBED = `<!doctype html><body style="margin:0;background:#c00;height:100vh">
<a id="yt" href="https://www.youtube.com/watch?v=x" target="_blank" style="display:block;position:fixed;inset:0">Watch on YouTube</a>
<script>document.addEventListener("click", () => { try { window.open("https://www.youtube.com/watch?v=x"); } catch (e) {} try { top.location.href = "https://www.youtube.com/"; } catch (e) {} });</script></body>`;

test("background trailers are sandboxed, hidden until playing and open nothing", async ({ page, context }, info) => {
  test.skip(!info.project.metadata.tv, "TV hero trailers");
  test.setTimeout(90_000);
  const popups: string[] = [];
  context.on("page", (p) => { if (p !== page) popups.push(p.url()); });
  const navs: string[] = [];
  page.on("framenavigated", (f) => { if (f === page.mainFrame()) navs.push(f.url()); });
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "v0.0.1", assets: [] }) }));
  await page.route("https://www.youtube.com/iframe_api", (r) => r.fulfill({ contentType: "text/javascript", body: FAKE_API }));
  await page.route(/^https:\/\/www\.youtube-nocookie\.com\/embed\//, (r) => r.fulfill({ contentType: "text/html", body: FAKE_EMBED }));
  await page.addInitScript((s) => { localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1"); }, STATE);
  await page.goto("/title/movie/550?layout=tv", { waitUntil: "domcontentloaded" });

  const frame = page.locator(".trailer iframe").first();
  await expect(frame).toBeAttached({ timeout: 40_000 });
  const src = new URL((await frame.getAttribute("src"))!);
  expect(src.hostname).toBe("www.youtube-nocookie.com");
  for (const [k, v] of Object.entries({ enablejsapi: "1", controls: "0", disablekb: "1", fs: "0", iv_load_policy: "3", cc_load_policy: "0", rel: "0", playsinline: "1" })) expect(src.searchParams.get(k)).toBe(v);
  expect(src.searchParams.has("modestbranding")).toBe(false);
  expect(src.searchParams.has("showinfo")).toBe(false);
  expect(await frame.getAttribute("sandbox")).toBe("allow-scripts allow-same-origin");
  expect(await frame.getAttribute("allow")).toBe("autoplay; encrypted-media");
  expect(await frame.getAttribute("tabindex")).toBe("-1");
  expect(await frame.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");

  // invisible until PLAYING + reveal delay
  const box = page.locator(".trailer").first();
  await expect(box).not.toHaveClass(/is-visible/);
  await expect(box).toHaveClass(/is-visible/, { timeout: 30_000 });
  // the YouTube title/logo overlay window: at least ~2 s of PLAYING before the frame shows
  const shownAfter = await page.evaluate(() => performance.now() - (window as unknown as { __yt: { playingAt: number } }).__yt.playingAt);
  expect(shownAfter).toBeGreaterThanOrEqual(1900);
  expect(src.searchParams.get("start")).toBe("1");
  // a stall (BUFFERING) hides the frame within ~700 ms + a watchdog tick
  await page.evaluate(() => (window as unknown as { __yt: { players: { state: number }[] } }).__yt.players.forEach((p) => { p.state = 3; }));
  await expect(box).not.toHaveClass(/is-visible/, { timeout: 3000 });

  // click, right-click and keys over the trailer area open nothing
  const r = (await box.boundingBox())!;
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.click(r.x + r.width - 40, r.y + r.height - 40);
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 3, { button: "right" });
  for (const k of ["k", "f", "Space", "Enter"]) await page.keyboard.press(k);
  await page.waitForTimeout(1500);
  expect(popups).toEqual([]);
  expect(navs.every((u) => u.startsWith("http://127.0.0.1:4173"))).toBe(true);
});

async function fakeYouTube(page: import("@playwright/test").Page) {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "v0.0.1", assets: [] }) }));
  await page.route("https://www.youtube.com/iframe_api", (r) => r.fulfill({ contentType: "text/javascript", body: FAKE_API }));
  await page.route(/^https:\/\/www\.youtube-nocookie\.com\/embed\//, (r) => r.fulfill({ contentType: "text/html", body: FAKE_EMBED }));
}

test("TV focus trailer starts after 5 s of focus and shows 2 s after it plays", async ({ page }, info) => {
  test.skip(!info.project.metadata.tv, "TV hero trailers");
  test.setTimeout(90_000);
  await fakeYouTube(page);
  // default profile prefs: trailer delay 5 s
  const state = JSON.stringify({ profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }], activeProfileId: "p1", prefs: { trailerAutoplay: true, trailerSound: false }, data: {} });
  await page.addInitScript((s) => { localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1"); }, state);
  await page.goto("/title/movie/550?layout=tv", { waitUntil: "domcontentloaded" });
  const t0 = await page.evaluate(() => performance.now());
  const box = page.locator(".trailer").first();
  await expect(box).toHaveClass(/is-visible/, { timeout: 40_000 });
  const firstPlay = await page.evaluate(() => (window as unknown as { __yt: { playCalls: number[] } }).__yt.playCalls[0] ?? 0);
  expect(firstPlay - t0).toBeGreaterThanOrEqual(4900);
});

test("full-screen trailer viewer opens, plays and closes with Back", async ({ page }, info) => {
  test.skip(!info.project.metadata.tv, "TV Trailers & More");
  test.setTimeout(90_000);
  await fakeYouTube(page);
  const state = JSON.stringify({ profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }], activeProfileId: "p1", prefs: { trailerAutoplay: false, trailerSound: false }, data: {} });
  await page.addInitScript((s) => { localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1"); }, state);
  await page.goto("/title/movie/550?layout=tv", { waitUntil: "domcontentloaded" });
  const tab = page.locator("#tab-trailers");
  await expect(tab).toBeAttached({ timeout: 40_000 });
  await tab.click();
  const card = page.locator("#vid-0");
  await expect(card).toBeAttached({ timeout: 10_000 });
  await card.scrollIntoViewIfNeeded();
  await card.click();
  const overlay = page.locator(".video-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay.locator("iframe")).toBeAttached();
  // the viewer shows as soon as it plays: the loading spinner goes away
  await expect(overlay.locator(".spinner-wrap")).toHaveCount(0, { timeout: 5000 });
  expect(new URL((await overlay.locator("iframe").getAttribute("src"))!).searchParams.has("start")).toBe(false);
  await page.keyboard.press("Escape");
  await expect(overlay).toHaveCount(0);
});
