import { expect, test, type Page } from "@playwright/test";

/** v1.2.2: Still watching? after N episodes, swipe gestures, spoiler protection, Settings › Playback. */
const STATE = (prefs: Record<string, unknown> = {}) => JSON.stringify({
  profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }],
  activeProfileId: "p1", prefs: { autoplayTrailers: false, subtitleMode: "off", ...prefs }, data: {},
});
const ok = (data: unknown) => ({ contentType: "application/json", body: JSON.stringify({ success: true, data }) });
const cinesrc = (type: string, tmdbId: number) => ({ id: "cinesrc", provider: "cinesrc", label: "CineSrc", url: `https://cinesrc.st/embed/${type}/${tmdbId}`, origin: "https://cinesrc.st", events: "cinesrc", supportsStart: true });
// a stand-in for CineSrc's embed; `script` adds timed events (the real player posts the same messages)
const embed = (script = "") => `<!doctype html><body style="background:#246;margin:0"><script>
let t = 5; const send = (type, data) => parent.postMessage({ type, data }, "*");
send("cinesrc:ready", {}); send("cinesrc:loadedmetadata", { duration: 3000 }); send("cinesrc:play", {});
setInterval(() => { t += 0.25; send("cinesrc:timeupdate", { currentTime: t, duration: 3000 }); }, 250);
${script}
</script></body>`;

async function open(page: Page, path: string, tv: boolean, state: string, script = "") {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "v0.0.1", assets: [] }) }));
  await page.route(/\/api\/v1\/panda\/subtitles\//, (r) => r.fulfill(ok({ imdbId: null, season: null, episode: null, tracks: [] })));
  await page.route(/\/api\/v1\/panda\/play\/movie\/550/, (r) => r.fulfill(ok({ type: "movie", tmdbId: 550, sources: [cinesrc("movie", 550)] })));
  await page.route(/\/api\/v1\/panda\/play\/tv\/1396/, (r) => r.fulfill(ok({ type: "tv", tmdbId: 1396, sources: [cinesrc("tv", 1396)] })));
  await page.route(/^https:\/\/cinesrc\.st\/embed\//, (r) => r.fulfill({ contentType: "text/html", body: embed(script) }));
  await page.addInitScript((s) => { if (!localStorage.getItem("panda:v1:state")) localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1"); }, state);
  await page.goto(`${path}${path.includes("?") ? "&" : "?"}layout=${tv ? "tv" : "mobile"}`, { waitUntil: "domcontentloaded" });
}
const prefsOf = (page: Page) => page.evaluate(() => { const s = JSON.parse(localStorage.getItem("panda:v1:state") ?? "{}"); return { ...s.prefs, ...(s.profilePrefs?.[s.activeProfileId] ?? {}) }; });

test("Settings › Playback saves Still watching?, Hide spoilers and (phones) Swipe gestures", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  await open(page, "/settings/playback", tv, STATE());
  if (tv) await page.locator("#set-playback").focus();
  await page.locator("#stillafter-2").click();
  await page.locator("#sp-spoilers").click();
  if (tv) await expect(page.locator("#sp-gestures")).toHaveCount(0);
  else await page.locator("#sp-gestures").click();
  // picture-in-picture is an Android app feature: no switch in a browser (no dead controls)
  await expect(page.locator("#sp-autopip")).toHaveCount(0);
  await expect.poll(async () => { const p = await prefsOf(page); return [p.stillAfter, p.hideSpoilers, p.gestures]; }).toEqual([2, true, tv]);
});

test("After N episodes in a row Panda asks before starting another", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  test.setTimeout(90_000);
  // the source moves to E2 by itself, then E2 ends: with "after 2 episodes" Panda asks before E3
  await open(page, "/watch/tv/1396?s=1&e=1", tv, STATE({ stillAfter: 2, autoplayNext: true }),
    `setTimeout(() => send("cinesrc:nextepisode", { season: 1, episode: 2, internalNavigation: true }), 2500);
     setTimeout(() => send("cinesrc:ended", {}), 6000);`);
  const dlg = page.locator("#p2-keep");
  await expect(dlg).toBeVisible({ timeout: 40_000 });
  await expect(page.getByText("You've watched 2 episodes in a row")).toBeVisible();
  await dlg.click();
  await expect(page).toHaveURL(/e=3/, { timeout: 15_000 });
});

test("Swipe gestures: drag to seek, swipe for brightness, hold for 2×", async ({ page }, info) => {
  test.skip(Boolean(info.project.metadata.tv), "gestures are for phones and tablets");
  await open(page, "/watch/movie/550", false, STATE());
  const layer = page.locator(".tvp-touch");
  await expect(layer).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  const b = (await layer.boundingBox())!;
  // sideways drag shows the seek preview and commits on release
  // (away from the centre play/pause buttons, which appear as soon as the pointer moves)
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.66);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.7, b.y + b.height * 0.66, { steps: 8 });
  await expect(page.locator(".tvp-ghud--seek")).toBeVisible();
  await page.mouse.up();
  await expect(page.locator(".tvp-ghud--seek")).toHaveCount(0);
  // swipe down on the left dims the picture
  await page.mouse.move(b.x + b.width * 0.12, b.y + b.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.12, b.y + b.height * 0.7, { steps: 8 });
  await expect(page.locator(".tvp-ghud--level.is-brightness")).toBeVisible();
  await page.mouse.up();
  await expect(page.locator(".player-dim")).toHaveCount(1);
  // a resting finger plays at 2× until it lifts
  await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.66);
  await page.mouse.down();
  await expect(page.locator(".tvp-ghud--hold")).toContainText("2×", { timeout: 3000 });
  await page.mouse.up();
  await expect(page.locator(".tvp-ghud--hold")).toHaveCount(0);
});

test("Hide spoilers blurs unwatched episode pictures and hides their descriptions", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  await open(page, "/title/tv/1396/episodes", tv, STATE({ hideSpoilers: true }));
  const still = page.locator(tv ? ".tv-ep-still.is-spoiler" : ".m-ep-still.is-spoiler").first();
  await expect(still).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Description hidden until you watch it").first()).toBeAttached();
});
