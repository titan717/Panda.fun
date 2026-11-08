import { expect, test, type Page } from "@playwright/test";

/** v1.2.1: Panda's own subtitles over the source player, Settings › Subtitles, per-profile languages. */
const STATE = (prefs: Record<string, unknown> = {}) => JSON.stringify({
  profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }],
  activeProfileId: "p1", prefs: { autoplayTrailers: false, ...prefs }, data: {},
});
const ok = (data: unknown) => ({ contentType: "application/json", body: JSON.stringify({ success: true, data }) });
const TRACKS = {
  imdbId: "tt0137523", season: null, episode: null,
  tracks: [
    { id: "en-1", language: "en", label: "English", hearingImpaired: false, downloads: 900, release: "Fight.Club.1999.1080p", file: "/api/v1/panda/subtitles/file?f=en1" },
    { id: "en-sdh", language: "en", label: "English (SDH)", hearingImpaired: true, downloads: 400, release: "Fight.Club.1999.SDH", file: "/api/v1/panda/subtitles/file?f=ensdh" },
    { id: "hi-1", language: "hi", label: "Hindi", hearingImpaired: false, downloads: 50, release: "Fight.Club.1999.Hindi", file: "/api/v1/panda/subtitles/file?f=hi1" },
  ],
};
const VTT = "WEBVTT\n\n00:00:01.000 --> 00:00:30.000\nPeople always ask me\nif I know Tyler Durden.\n\n00:00:31.000 --> 00:00:59.000\nThree minutes.\n";
// a stand-in for CineSrc's embed: it reports a running clock through postMessage, like the real player
const FAKE_EMBED = `<!doctype html><body style="background:#123;margin:0"><script>
let t = 5; const send = (type, data) => parent.postMessage({ type, data }, "*");
send("cinesrc:ready", {}); send("cinesrc:loadedmetadata", { duration: 8000 }); send("cinesrc:play", {});
setInterval(() => { t += 0.25; send("cinesrc:timeupdate", { currentTime: t, duration: 8000 }); }, 250);
</script></body>`;

async function open(page: Page, path: string, tv: boolean, state = STATE()) {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "v0.0.1", assets: [] }) }));
  await page.route(/\/api\/v1\/panda\/subtitles\/file/, (r) => r.fulfill({ contentType: "text/vtt", body: VTT }));
  await page.route(/\/api\/v1\/panda\/subtitles\/tt/, (r) => r.fulfill(ok(TRACKS)));
  await page.route(/\/api\/v1\/panda\/play\/movie\/550/, (r) => r.fulfill(ok({ type: "movie", tmdbId: 550, sources: [{ id: "cinesrc", provider: "cinesrc", label: "CineSrc", url: "https://cinesrc.st/embed/movie/550", origin: "https://cinesrc.st", events: "cinesrc", supportsStart: true }] })));
  await page.route(/^https:\/\/cinesrc\.st\/embed\//, (r) => r.fulfill({ contentType: "text/html", body: FAKE_EMBED }));
  await page.addInitScript((s) => { if (!localStorage.getItem("panda:v1:state")) localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1"); }, state);
  await page.goto(`${path}${path.includes("?") ? "&" : "?"}layout=${tv ? "tv" : "mobile"}`, { waitUntil: "domcontentloaded" });
}
const prefsOf = (page: Page) => page.evaluate(() => { const s = JSON.parse(localStorage.getItem("panda:v1:state") ?? "{}"); return { ...s.prefs, ...(s.profilePrefs?.[s.activeProfileId] ?? {}) }; });

test("Settings › Subtitles saves mode, languages, size and style for the profile", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  await open(page, "/settings/subtitles", tv);
  if (tv) await page.locator("#set-subtitles").focus();
  await expect(page.locator(".captions--preview")).toBeVisible();
  await page.locator("#submode-always").click();
  await page.locator("#sublang-hi").click();
  await page.locator("#subsize-large").click();
  await expect.poll(async () => { const p = await prefsOf(page); return [p.subtitleMode, p.subtitleLang, p.subtitleSize]; }).toEqual(["always", "hi", "large"]);
});

test("Captions show over the source player and the track can be switched off", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  await open(page, "/watch/movie/550", tv, STATE({ subtitleMode: "always" }));
  await expect(page.locator(".captions:not(.captions--preview)")).toContainText("Tyler Durden", { timeout: 30_000 });
  // CineSrc runs under Panda's own controls on TV and on phones; Audio & Subtitles lists the tracks
  if (tv) await page.keyboard.press("Enter"); else await page.mouse.click(200, 200);
  await page.locator("#tvp-audio").click();
  await expect(page.locator("#tvp-sub-en-1")).toHaveAttribute("aria-checked", "true");
  await page.locator("#tvp-sub-later").click();
  await expect(page.locator(".tvp-sub-offset")).toContainText("0.5");
  await page.locator("#tvp-sub-off").click();
  await expect(page.locator(".captions:not(.captions--preview)")).toHaveCount(0);
});
