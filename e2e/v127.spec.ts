import { expect, test, type Page } from "@playwright/test";

/** v1.2.7: the Subtitles panel (tracks, style, timing, second language), one-press toggle and per-title memory. */
const STATE = (prefs: Record<string, unknown> = {}) => JSON.stringify({
  profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }],
  activeProfileId: "p1", prefs: { autoplayTrailers: false, subtitleMode: "always", ...prefs }, data: {},
});
const ok = (data: unknown) => ({ contentType: "application/json", body: JSON.stringify({ success: true, data }) });
const track = (id: string, language: string, label: string, hearingImpaired = false) => ({ id, language, label, hearingImpaired, downloads: 100, release: `Fight.Club.1999.${id}`, file: `/api/v1/panda/subtitles/file?f=${id}` });
const BASE = [track("en-1", "en", "English"), track("en-sdh", "en", "English (SDH)", true), track("hi-1", "hi", "Hindi")];
const EXTRA: Record<string, ReturnType<typeof track>[]> = { es: [track("es-1", "es", "Spanish")], fr: [track("fr-1", "fr", "French")] };
const vtt = (line: string) => `WEBVTT\n\n00:00:01.000 --> 00:59:00.000\n${line}\n`;
const LINES: Record<string, string> = { "en-1": "People always ask me", "en-sdh": "[door slams] People always ask me", "hi-1": "Hindi line here", "es-1": "La gente siempre me pregunta", "fr-1": "Les gens me demandent" };
const FAKE_EMBED = `<!doctype html><body style="background:#123;margin:0"><script>
let t = 5; const send = (type, data) => parent.postMessage({ type, data }, "*");
send("cinesrc:ready", {}); send("cinesrc:loadedmetadata", { duration: 8000 }); send("cinesrc:play", {});
setInterval(() => { t += 0.25; send("cinesrc:timeupdate", { currentTime: t, duration: 8000 }); }, 250);
</script></body>`;

async function open(page: Page, tv: boolean, state = STATE()) {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "v0.0.1", assets: [] }) }));
  await page.route(/\/api\/v1\/panda\/subtitles\/file/, (r) => { const f = new URL(r.request().url()).searchParams.get("f") ?? ""; return r.fulfill({ contentType: "text/vtt", body: vtt(LINES[f] ?? "?") }); });
  await page.route(/\/api\/v1\/panda\/subtitles\/tt/, (r) => {
    const langs = (new URL(r.request().url()).searchParams.get("langs") ?? "").split(",");
    const tracks = [...BASE.filter((t) => langs.includes(t.language)), ...langs.flatMap((l) => EXTRA[l] ?? [])];
    return r.fulfill(ok({ imdbId: "tt0137523", season: null, episode: null, tracks }));
  });
  await page.route(/\/api\/v1\/panda\/play\/movie\/550/, (r) => r.fulfill(ok({ type: "movie", tmdbId: 550, sources: [{ id: "cinesrc", provider: "cinesrc", label: "CineSrc", url: "https://cinesrc.st/embed/movie/550", origin: "https://cinesrc.st", events: "cinesrc", supportsStart: true }] })));
  await page.route(/^https:\/\/cinesrc\.st\/embed\//, (r) => r.fulfill({ contentType: "text/html", body: FAKE_EMBED }));
  await page.addInitScript((s) => { if (!localStorage.getItem("panda:v1:state")) localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1"); }, state);
  await page.goto(`/watch/movie/550?layout=${tv ? "tv" : "mobile"}`, { waitUntil: "domcontentloaded" });
  await expect(caption(page)).toContainText("People always ask me", { timeout: 30_000 });
}
const caption = (page: Page) => page.locator(".captions:not(.captions--preview)");
const prefsOf = (page: Page) => page.evaluate(() => { const s = JSON.parse(localStorage.getItem("panda:v1:state") ?? "{}"); return { ...s.prefs, ...(s.profilePrefs?.[s.activeProfileId] ?? {}) }; });
async function openPanel(page: Page, tv: boolean) {
  if (tv) await page.keyboard.press("Enter"); else await page.mouse.click(200, 200);
  await page.locator("#tvp-audio").click();
  await page.locator("#tvp-sub-options").click();
  await expect(page.locator(".so")).toBeVisible();
}

test("Style tab changes the live captions and the preview, and the look is saved for the profile", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  await open(page, tv);
  await openPanel(page, tv);
  await expect(page.locator("#so-tab-style")).toHaveAttribute("aria-selected", "true");
  await page.locator("#so-color-yellow").click();
  await page.locator("#so-bg-box").click();
  await page.locator("#so-edge-outline").click();
  await page.locator("#so-size-large").click();
  for (const el of [caption(page), page.locator(".so .captions--preview")]) {
    await expect(el).toHaveClass(/cap-c--yellow/);
    await expect(el).toHaveClass(/cap-bg--box/);
    await expect(el).toHaveClass(/cap-e--outline/);
    await expect(el).toHaveClass(/cap--large/);
  }
  await page.locator("#so-pos-up").click();
  await page.locator("#so-pos-up").click();
  await expect.poll(async () => (await prefsOf(page)).subtitlePos).toBe(4);
  await expect(caption(page)).toHaveAttribute("style", /--cap-lift:\s*4%/);
  await page.locator("#so-style-reset").click();
  await expect(caption(page)).toHaveClass(/cap-c--white/);
  await expect.poll(async () => { const p = await prefsOf(page); return [p.subtitleColor, p.subtitlePos]; }).toEqual(["white", 0]);
});

test("Timing moves in 0.1 s steps, speeds up on hold and is remembered for the title", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  await open(page, tv);
  await openPanel(page, tv);
  await page.locator("#so-tab-timing").click();
  await page.locator("#so-later").click();
  await page.locator("#so-later").click();
  await expect(page.locator(".so-offset")).toContainText("+0.2");
  // hold OK / the finger for a second: the step repeats
  await page.locator("#so-earlier").scrollIntoViewIfNeeded();
  const box = (await page.locator("#so-earlier").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1300);
  await page.mouse.up();
  const after = Number((await page.locator(".so-offset").textContent())!.replace(/[^\d.−-]/g, "").replace("−", "-"));
  expect(after).toBeLessThan(-0.2);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(caption(page)).toContainText("People always ask me", { timeout: 30_000 });
  await openPanel(page, tv);
  await page.locator("#so-tab-timing").click();
  await expect(page.locator(".so-offset")).not.toHaveText("In sync");
});

test("Second language shows above the main subtitles, and More languages finds another one", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  await open(page, tv);
  await openPanel(page, tv);
  await page.locator("#so-tab-tracks").click();
  await page.locator("#so-dual-hi").click();
  await expect(caption(page).locator(".cap-cue--second")).toContainText("Hindi line here");
  await page.locator("#so-dual-none").click();
  await expect(caption(page).locator(".cap-cue--second")).toHaveCount(0);
  await page.locator("#so-more").click();
  await page.locator("#so-find-es").click();
  await expect(caption(page)).toContainText("La gente siempre", { timeout: 15_000 });
  await expect(page.locator("#so-track-es-1")).toHaveAttribute("aria-checked", "true");
  // remembered for this title: Spanish comes back after a reload
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(caption(page)).toContainText("La gente siempre", { timeout: 30_000 });
});

test("SDH switch picks the SDH track, and the panel toggle switches subtitles in one press", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  await open(page, tv);
  await openPanel(page, tv);
  await page.locator("#so-tab-tracks").click();
  await page.locator("#so-sdh").click();
  await expect(caption(page)).toContainText("[door slams]");
  await page.locator("#so-toggle").click();
  await expect(caption(page)).toHaveCount(0);
  await page.locator("#so-toggle").click();
  await expect(caption(page)).toContainText("[door slams]");
});

test("The CC key (C on a keyboard) turns subtitles off and back on", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  await open(page, tv);
  await page.keyboard.press("c");
  await expect(caption(page)).toHaveCount(0);
  await expect(page.locator(".toast", { hasText: "Subtitles off" })).toBeVisible();
  await page.keyboard.press("c");
  await expect(caption(page)).toContainText("People always ask me");
});

test("Settings › Subtitles sets colour, background, edge, height and a second language", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "v0.0.1", assets: [] }) }));
  await page.addInitScript((s) => { if (!localStorage.getItem("panda:v1:state")) localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1"); }, STATE());
  await page.goto(`/settings/subtitles?layout=${tv ? "tv" : "mobile"}`, { waitUntil: "domcontentloaded" });
  if (tv) await page.locator("#set-subtitles").focus();
  await page.locator("#subcolor-cyan").click();
  await page.locator("#subbg-dim").click();
  await page.locator("#subedge-none").click();
  await page.locator("#subpos-12").click();
  await page.locator("#subdual-hi").click();
  const preview = page.locator(".captions--preview");
  await expect(preview).toHaveClass(/cap-c--cyan/);
  await expect(preview.locator(".cap-cue--second")).toContainText("Hindi");
  await expect.poll(async () => { const p = await prefsOf(page); return [p.subtitleColor, p.subtitleBg, p.subtitleEdge, p.subtitlePos, p.subtitleDual]; }).toEqual(["cyan", "dim", "none", 12, "hi"]);
  await page.locator("#sp-sub-reset").click();
  await expect(preview).toHaveClass(/cap-c--white/);
});

test("Kids PIN is saved as a hash, guards grown-up settings on a Kids profile and locks after wrong guesses", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "v0.0.1", assets: [] }) }));
  // a plain PIN left by an older version, on a Kids profile
  const state = JSON.stringify({
    profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }, { id: "k1", name: "Kid", avatar: "kids", kids: true, createdAt: 2 }],
    activeProfileId: "k1", prefs: { autoplayTrailers: false, kidsPin: "2468" }, data: {},
  });
  await page.addInitScript((s) => { if (!localStorage.getItem("panda:v1:state")) localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1"); }, state);
  await page.goto(`/profiles/manage?layout=${tv ? "tv" : "mobile"}`, { waitUntil: "domcontentloaded" });
  const input = page.locator(".pin-sheet .pin-input");
  await expect(input).toBeVisible();
  await expect(page.locator("#pf-kids, .manage-name")).toHaveCount(0);
  for (let i = 0; i < 5; i++) { await input.fill("1111"); await expect(input).toHaveValue(""); }
  await expect(page.locator(".pin-error")).toContainText("Too many wrong PINs");
  await expect(input).toBeDisabled();
  // the lock survives a reload
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".pin-sheet .pin-error")).toContainText("Too many wrong PINs");
  await page.evaluate(() => localStorage.removeItem("panda:v1:pinlock"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".pin-sheet .pin-input").fill("2468");
  await expect(page.locator(".manage-name").first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("panda:v1:state") ?? "{}").prefs.kidsPin as string)).toMatch(/^pbkdf2-sha256\$/);
});
