import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * v1.4.2 IntroBumper: the canvas bumper is the launch intro on phones and TVs (hands off within the 4.2 s hard
 * timeout), the pre-movie bumper shows over the Player while the stream loads underneath, and reduced motion draws
 * the static final logo frame. Set SHOTS=1 to also write screenshots to docs/screenshots/v1.4.2/.
 */
const STATE = JSON.stringify({
  profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }],
  activeProfileId: "p1", prefs: { autoplayTrailers: false, subtitleMode: "off" }, data: {},
});
const ok = (data: unknown) => ({ contentType: "application/json", body: JSON.stringify({ success: true, data }) });
const cinesrc = { id: "cinesrc", provider: "cinesrc", label: "CineSrc", url: "https://cinesrc.st/embed/movie/550", origin: "https://cinesrc.st", events: "cinesrc", supportsStart: true, tier: 1 };
const vidy = { id: "vidy", provider: "vidy", label: "Vidy", url: "https://www.vidy.st/movie/550", origin: "https://www.vidy.st", events: "vidy", supportsStart: true, tier: 2 };
/** A stand-in embed that starts reporting playback after `playAfter` ms (0 = never). */
const embed = (playAfter: number) => `<!doctype html><body style="background:#246;margin:0"><script>
const send = (type, data) => parent.postMessage({ type, data }, "*"); let t = 0;
send("cinesrc:ready", {}); send("cinesrc:loadedmetadata", { duration: 3000 });
if (${playAfter}) setTimeout(() => { send("cinesrc:play", {}); setInterval(() => { t += 0.25; send("cinesrc:timeupdate", { currentTime: t, duration: 3000 }); }, 250); }, ${playAfter});
</script></body>`;

const SHOTS = process.env.SHOTS ? "docs/screenshots/v1.4.2" : null;
async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function launch(page: Page, query: string, { bumper = "off" }: { bumper?: string } = {}) {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "v0.0.1", assets: [] }) }));
  await page.addInitScript(([s, b]) => {
    if (!localStorage.getItem("panda:v1:state")) localStorage.setItem("panda:v1:state", s as string);
    if (b === "off") sessionStorage.setItem("panda:v1:bumper", "off");
  }, [STATE, bumper] as const);
  // measure the intro on the page itself: when it appears and when it is gone (performance.now, ms)
  await page.addInitScript(() => {
    const w = window as unknown as { __introAt?: number; __introGone?: number; __preAt?: number };
    const check = () => {
      const el = document.querySelector("[data-intro]");
      if (el && w.__introAt === undefined) w.__introAt = performance.now();
      if (!el && w.__introAt !== undefined && w.__introGone === undefined) w.__introGone = performance.now();
      if (w.__preAt === undefined && document.querySelector("[data-premovie]")) w.__preAt = performance.now();
    };
    new MutationObserver(check).observe(document, { childList: true, subtree: true });
  });
  await page.goto(`/${query}`, { waitUntil: "commit" });
}

/** Wait until the bumper (launch intro or pre-movie) has been up for `ms` (its clock starts when it mounts). */
const at = (page: Page, which: "__introAt" | "__preAt", ms: number) =>
  page.waitForFunction(([k, x]) => { const v = (window as unknown as Record<string, number | undefined>)[k as string]; return v !== undefined && performance.now() - v >= (x as number); }, [which, ms] as const, { polling: 16 });

const timing = (page: Page) => page.evaluate(() => { const w = window as unknown as { __introAt?: number; __introGone?: number }; return { at: w.__introAt ?? null, gone: w.__introGone ?? null }; });

for (const kind of ["phone", "tv"] as const) {
  test(`launch intro on ${kind}: the canvas bumper plays and hands off within 4.2 s`, async ({ page }, info) => {
    test.skip(info.project.name !== (kind === "tv" ? "tv-1920" : "mobile-390"), "one TV and one phone size");
    await launch(page, kind === "tv" ? "?layout=tv" : "?layout=mobile");
    const intro = page.locator("[data-intro]");
    await expect(intro).toHaveAttribute("data-view", "bumper", { timeout: 5_000 });
    const b = page.locator("[data-intro] [data-bumper]");
    await expect(b).toHaveAttribute("data-still", "false");
    await expect(b).toHaveAttribute("data-drawn", "true", { timeout: 3_000 });
    // the canvas is really painting (non-black pixels by the time the triangle is up)
    await at(page, "__introAt", 1600);
    await shot(page, `app-${kind}-launch-t1.6`);
    const lit = await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>(".bumper-canvas")!;
      const x = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let n = 0; for (let i = 0; i < x.length; i += 4 * 97) if (x[i]! + x[i + 1]! + x[i + 2]! > 60) n++;
      return { n, w: c.width, h: c.height, cssW: c.clientWidth };
    });
    expect(lit.n).toBeGreaterThan(0);
    expect(lit.w / lit.cssW).toBeLessThanOrEqual(2); // DPR capped at 2
    if (SHOTS) { await at(page, "__introAt", 3000); await shot(page, `app-${kind}-launch-t3.0`); }
    await expect(intro).toHaveCount(0, { timeout: 4_000 });
    const t = await timing(page);
    expect(t.at).not.toBeNull();
    expect(t.gone! - t.at!).toBeLessThanOrEqual(4200 + 400); // 4.2 s hard limit + observer / runner slack
    // handed off to the app (no Who's watching: the saved profile opens Home)
    await expect(page.getByRole("heading", { name: "Who's watching?" })).toHaveCount(0);
    await expect(page.locator("main, .tv-page").first()).toBeVisible();
  });

  test(`reduced motion on ${kind}: the static final logo frame, no animation loop`, async ({ page }, info) => {
    test.skip(info.project.name !== (kind === "tv" ? "tv-1920" : "mobile-390"), "one TV and one phone size");
    await page.emulateMedia({ reducedMotion: "reduce" });
    // count animation frames requested while the bumper is up
    await page.addInitScript(() => {
      const w = window as unknown as { __rafs: number };
      w.__rafs = 0;
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) => { if (document.querySelector("[data-bumper]")) w.__rafs++; return raf(cb); };
    });
    await launch(page, kind === "tv" ? "?layout=tv" : "?layout=mobile");
    const b = page.locator("[data-intro] [data-bumper]");
    await expect(b).toHaveAttribute("data-still", "true", { timeout: 5_000 });
    await expect(b).toHaveAttribute("data-drawn", "true", { timeout: 3_000 });
    await shot(page, `app-${kind}-reduced-motion`);
    const before = await page.evaluate(() => (window as unknown as { __rafs: number }).__rafs);
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => (window as unknown as { __rafs: number }).__rafs);
    expect(after - before).toBeLessThanOrEqual(2); // nothing animates (the app itself may ask for a frame or two)
    await expect(page.locator("[data-intro]")).toHaveCount(0, { timeout: 3_000 });
  });
}

async function openPlayer(page: Page, tv: boolean, playAfter: number) {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "v0.0.1", assets: [] }) }));
  await page.route(/\/api\/v1\/panda\/subtitles\//, (r) => r.fulfill(ok({ imdbId: null, season: null, episode: null, tracks: [] })));
  await page.route(/\/api\/v1\/panda\/report/, (r) => r.fulfill(ok({ received: true, counted: true })));
  await page.route(/\/api\/v1\/panda\/play\/movie\/550/, (r) => r.fulfill(ok({ type: "movie", tmdbId: 550, sources: [cinesrc, vidy] })));
  await page.route(/^https:\/\/cinesrc\.st\/embed\//, (r) => r.fulfill({ contentType: "text/html", body: embed(playAfter) }));
  await page.route(/^https:\/\/www\.vidy\.st\//, (r) => r.fulfill({ contentType: "text/html", body: "<!doctype html><body style='background:#422'></body>" }));
  await page.addInitScript(() => {
    const w = window as unknown as { __preAt?: number };
    new MutationObserver(() => { if (w.__preAt === undefined && document.querySelector("[data-premovie]")) w.__preAt = performance.now(); }).observe(document, { childList: true, subtree: true });
  });
  // launch intro already seen in this tab; the pre-movie bumper is on
  await page.addInitScript((s) => { if (!localStorage.getItem("panda:v1:state")) localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:v1:intro-session", "e2e"); }, STATE);
  await page.goto(`/watch/movie/550?layout=${tv ? "tv" : "mobile"}`, { waitUntil: "domcontentloaded" });
}

test("pre-movie bumper shows before the player, while the stream loads underneath, then hands off", async ({ page }, info) => {
  test.skip(info.project.name !== "tv-1920" && info.project.name !== "mobile-390", "one TV and one phone size");
  const tv = Boolean(info.project.metadata.tv);
  await openPlayer(page, tv, 0); // the stand-in never starts: the bumper runs its full 4 s
  const pre = page.locator("[data-premovie]");
  await expect(pre).toBeVisible({ timeout: 10_000 });
  await expect(pre.locator("[data-bumper]")).toHaveAttribute("data-still", "false");
  // the embed is created at once underneath: the bumper never delays playback
  await expect(page.locator("iframe.player-frame")).toHaveCount(1, { timeout: 10_000 });
  await expect(pre).toBeVisible();
  if (SHOTS) { await at(page, "__preAt", 2300); await shot(page, `app-${tv ? "tv" : "phone"}-premovie-t2.3`); }
  await expect(pre).toHaveCount(0, { timeout: 5_000 });
  await expect(page).toHaveURL(/\/watch\/movie\/550/);
  if (tv) {
    // the remote works on the Player afterwards: focus is on a Player control, not lost on <body>
    await expect.poll(() => page.evaluate(() => document.activeElement !== document.body && Boolean(document.activeElement?.closest(".player")))).toBe(true);
  }
});

test("pre-movie bumper gets out of the way as soon as playback really starts", async ({ page }, info) => {
  test.skip(info.project.name !== "tv-1920", "once (TV starts on the CineSrc stand-in)");
  await openPlayer(page, true, 1200);
  const pre = page.locator("[data-premovie]");
  await expect(pre).toBeVisible({ timeout: 10_000 });
  const t0 = Date.now();
  await expect(pre).toHaveCount(0, { timeout: 5_000 });
  expect(Date.now() - t0).toBeLessThan(3800); // cut short by real playback, not the 4 s end
});

test("pre-movie bumper on TV: OK/Back skip it after 1 s (like the launch intro) and Back does not leave the Player", async ({ page }, info) => {
  test.skip(info.project.name !== "tv-1920", "once");
  await openPlayer(page, true, 0);
  const pre = page.locator("[data-premovie]");
  await expect(pre).toBeVisible({ timeout: 10_000 });
  const skip = page.getByRole("button", { name: "Skip", exact: true });
  await expect(skip).toBeVisible({ timeout: 3_000 });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(pre).toHaveCount(0, { timeout: 1_500 });
  await expect(page).toHaveURL(/\/watch\/movie\/550/);
});

test("pre-movie bumper with reduced motion: the static final frame, briefly", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile-390", "once");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPlayer(page, false, 0);
  const pre = page.locator("[data-premovie]");
  await expect(pre.locator("[data-bumper]")).toHaveAttribute("data-still", "true", { timeout: 10_000 });
  await expect(pre).toHaveCount(0, { timeout: 3_000 });
});
