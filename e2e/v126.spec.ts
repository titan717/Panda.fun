import { expect, test, type Page } from "@playwright/test";

/** v1.2.6 Player I: first-frames screen, seek-bar chapters, picture fit, lock, volume steps, mute memory, portrait frame. */
const STATE = JSON.stringify({
  profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }],
  activeProfileId: "p1", prefs: { autoplayTrailers: false, subtitleMode: "off" }, data: {},
});
const ok = (data: unknown) => ({ contentType: "application/json", body: JSON.stringify({ success: true, data }) });
const cinesrc = (type: string, tmdbId: number) => ({ id: "cinesrc", provider: "cinesrc", label: "CineSrc", url: `https://cinesrc.st/embed/${type}/${tmdbId}`, origin: "https://cinesrc.st", events: "cinesrc", supportsStart: true });
// stand-in for CineSrc's embed: reports ready after `delay` ms, then plays; records the commands it receives
const embed = (delay: number) => `<!doctype html><body style="background:#246;margin:0"><script>
let t = 5; const send = (type, data) => parent.postMessage({ type, data }, "*");
window.addEventListener("message", (m) => { if (m.data && m.data.type === "cinesrc:command") parent.postMessage({ type: "test:cmd", data: m.data }, "*"); });
setTimeout(() => {
  send("cinesrc:ready", {}); send("cinesrc:loadedmetadata", { duration: 3000 }); send("cinesrc:play", {});
  setInterval(() => { t += 0.25; send("cinesrc:timeupdate", { currentTime: t, duration: 3000 }); }, 250);
}, ${delay});
</script></body>`;

async function open(page: Page, path: string, tv: boolean, delay = 0) {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "v0.0.1", assets: [] }) }));
  await page.route(/\/api\/v1\/panda\/subtitles\//, (r) => r.fulfill(ok({ imdbId: null, season: null, episode: null, tracks: [] })));
  await page.route(/\/api\/v1\/panda\/segments\//, (r) => r.fulfill(ok({ imdbId: "tt0137523", season: null, episode: null, intro: { start: 60, end: 150 }, recap: null, credits: { start: 2850, end: 3000 }, source: "introdb" })));
  await page.route(/\/api\/v1\/panda\/play\/movie\/550/, (r) => r.fulfill(ok({ type: "movie", tmdbId: 550, sources: [cinesrc("movie", 550)] })));
  await page.route(/\/api\/v1\/panda\/play\/tv\/1396/, (r) => r.fulfill(ok({ type: "tv", tmdbId: 1396, sources: [cinesrc("tv", 1396)] })));
  await page.route(/^https:\/\/cinesrc\.st\/embed\//, (r) => r.fulfill({ contentType: "text/html", body: embed(delay) }));
  await page.addInitScript((s) => { if (!localStorage.getItem("panda:v1:state")) localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1"); }, STATE);
  await page.goto(`${path}${path.includes("?") ? "&" : "?"}layout=${tv ? "tv" : "mobile"}`, { waitUntil: "domcontentloaded" });
}

test("first-frames screen: title, Season X Episode Y, a rising percentage, then it fades away", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  await open(page, "/watch/tv/1396?s=1&e=2", tv, 3500);
  const loading = page.locator("#pl-loading");
  await expect(loading).toBeVisible();
  await expect(loading).toContainText("Breaking Bad");
  await expect(loading).toContainText("Season 1, Episode 2");
  await expect(loading.locator(".pll-label")).toHaveText("Buffering the first seconds…");
  const bar = loading.getByRole("progressbar");
  const first = Number(await bar.getAttribute("aria-valuenow"));
  await expect.poll(async () => Number(await bar.getAttribute("aria-valuenow")), { timeout: 3000 }).toBeGreaterThan(first);
  expect(Number(await bar.getAttribute("aria-valuenow"))).toBeLessThanOrEqual(95);
  if (!tv) await expect(page.locator("#pll-back")).toBeVisible();
  // ready: 100 %, then gone
  await expect(loading).toHaveCount(0, { timeout: 8000 });
  // the chrome's episode line uses the same wording
  await expect(page.locator(".tvp-title span")).toContainText("Season 1, Episode 2");
});

test("seek bar shows intro and credits chapters", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  await open(page, "/watch/movie/550", tv);
  await expect(page.locator(".tvp-mark.is-intro")).toHaveCount(1, { timeout: 15000 });
  await expect(page.locator(".tvp-mark.is-credits")).toHaveCount(1);
  const style = await page.locator(".tvp-mark.is-intro").getAttribute("style");
  expect(style).toContain("left: 2%");
  if (tv) {
    // seeking into the intro names the chapter in the preview bubble
    await page.keyboard.press("ArrowDown");
    await page.locator("#tvp-track").focus();
    for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
    await expect(page.locator(".tvp-chapter")).toHaveText("Intro");
  }
});

test("picture fit is offered with Panda's controls and remembered", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  await open(page, "/watch/movie/550", tv);
  await expect(page.locator("#pl-loading")).toHaveCount(0, { timeout: 15000 });
  await page.locator("#tvp-quality").click();
  await page.locator("#tvp-fit-fill").click();
  await expect(page.locator("#tvp-fit-fill")).toHaveAttribute("aria-checked", "true");
  expect(await page.evaluate(() => localStorage.getItem("panda:fit"))).toBe("fill");
  // a wide screen zooms the frame evenly to drop the black bars
  await page.setViewportSize({ width: 1400, height: 600 });
  await expect.poll(async () => (await page.locator(".player-frame").getAttribute("style")) ?? "").toContain("scale(1.3125, 1.3125)");
});

test("Audio column: volume steps and Sound off is remembered", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  await open(page, "/watch/movie/550", tv);
  await expect(page.locator("#pl-loading")).toHaveCount(0, { timeout: 15000 });
  await page.locator("#tvp-audio").click();
  await expect(page.locator(".tvp-vol-val")).toHaveText("100%");
  await page.locator("#tvp-vol-down").click();
  await expect(page.locator(".tvp-vol-val")).toHaveText("90%");
  await page.locator("#tvp-a-mute").click();
  expect(await page.evaluate(() => localStorage.getItem("panda:muted"))).toBe("1");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#pl-loading")).toHaveCount(0, { timeout: 15000 });
  await page.locator("#tvp-audio").click();
  await expect(page.locator("#tvp-a-mute")).toHaveAttribute("aria-checked", "true");
});

test("phones: lock hides every control until unlocked; portrait gets a 16:9 frame", async ({ page }, info) => {
  test.skip(Boolean(info.project.metadata.tv), "phones and tablets only");
  await open(page, "/watch/movie/550", false);
  await expect(page.locator("#pl-loading")).toHaveCount(0, { timeout: 15000 });
  const box = (await page.locator(".player-frame").boundingBox())!;
  expect(Math.abs(box.height - (box.width * 9) / 16)).toBeLessThan(2);
  await page.locator("#tvp-lock").click();
  await expect(page.locator(".tvp-top")).toHaveCount(0);
  await expect(page.locator("#tvp-unlock")).toHaveClass(/is-shown/);
  await page.locator("#tvp-unlock").click();
  await expect(page.locator(".tvp-top")).toHaveCount(1);
  await expect(page.locator("#tvp-lock")).toBeVisible();
});

test("TV: the remote's Menu key opens the quick panel", async ({ page }, info) => {
  test.skip(!info.project.metadata.tv, "TV remote");
  await open(page, "/watch/movie/550", true);
  await expect(page.locator("#pl-loading")).toHaveCount(0, { timeout: 15000 });
  // the remote's key goes to whatever holds focus; the player keeps focus on its own chrome (never the embed)
  await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest(".tvp, .player")))).toBe(true);
  await page.keyboard.press("ContextMenu");
  await expect(page.getByRole("dialog", { name: "Quality" })).toBeVisible();
  await expect(page.locator("#tvp-fit-fit")).toHaveAttribute("aria-checked", "true");
});
