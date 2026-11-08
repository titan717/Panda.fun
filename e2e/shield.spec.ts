import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * Ad shield release gate (docs/AD_SHIELD.md, layer 7). For each playback adapter: open a title,
 * play, interact with the player the way a viewer would (clicks / taps / remote keys), seek, go to
 * the next episode and back out. Fails if any popup, new tab or top-level navigation outside the
 * app happens. Runs against the live providers, so it also catches a provider changing its embed.
 */
const ORIGIN = "http://127.0.0.1:4173";
const ADAPTERS = [
  { id: "cinesrc", host: /(^|\.)cinesrc\.st$/ },
  { id: "vidy", host: /(^|\.)vidy\.st$/ },
] as const;

function state(source: string) {
  return JSON.stringify({
    profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }],
    activeProfileId: "p1", prefs: { preferredSource: source, autoplayTrailers: false }, data: {},
  });
}

function watch(ctx: BrowserContext, page: Page) {
  const popups: string[] = [];
  const navs: string[] = [];
  ctx.on("page", (p) => { if (p !== page) popups.push(p.url() || "about:blank"); });
  page.on("popup", (p) => popups.push(p.url() || "about:blank"));
  page.on("framenavigated", (f) => { if (f === page.mainFrame()) navs.push(f.url()); });
  return { popups, navs };
}

for (const adapter of ADAPTERS) {
  test(`ad shield: ${adapter.id} play flow opens no popups and never leaves the app`, async ({ page, context }, info) => {
    const tv = Boolean(info.project.metadata.tv);
    // TV browsers only fall back to compatibility sources (D-94), so Vidy is gated on touch layouts.
    test.skip(tv && adapter.id === "vidy", "Vidy is a last-resort source on TV browsers");
    test.setTimeout(150_000);
    const seen = watch(context, page);
    await page.addInitScript((s) => {
      localStorage.setItem("panda:v1:state", s);
      sessionStorage.setItem("panda:splash", "1");
    }, state(adapter.id));

    await page.goto(`/watch/tv/1396?s=1&e=1${tv ? "&layout=tv" : ""}`, { waitUntil: "domcontentloaded" });
    const frame = page.locator("iframe.player-frame");
    await expect(frame).toHaveCount(1, { timeout: 30_000 });
    expect(new URL((await frame.getAttribute("src"))!).hostname).toMatch(adapter.host);
    await page.waitForTimeout(12_000);

    // play + interact: everywhere a viewer would click or tap, and the remote keys
    const box = (await page.locator(".player, .tvp, body").first().boundingBox())!;
    const pts = [[0.5, 0.5], [0.15, 0.85], [0.85, 0.85], [0.5, 0.75], [0.25, 0.25], [0.8, 0.2], [0.5, 0.5]];
    for (const [x, y] of pts) {
      const px = box.x + box.width * x, py = box.y + box.height * y;
      if (info.project.use.hasTouch) await page.touchscreen.tap(px, py); else await page.mouse.click(px, py);
      await page.waitForTimeout(1200);
    }
    if (tv) for (const k of ["Enter", "ArrowRight", "ArrowRight", "ArrowLeft", "Enter"]) { await page.keyboard.press(k); await page.waitForTimeout(600); }

    // next episode through Panda's own control when it is on screen
    const next = page.locator("#tvp-next, #pl-next").first();
    if (await next.isVisible().catch(() => false)) {
      await next.click({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(8_000);
    }

    // back out of the player
    await page.keyboard.press("Escape");
    await page.waitForTimeout(2_000);

    expect(seen.popups, "popups / new tabs").toEqual([]);
    const outside = seen.navs.filter((u) => !u.startsWith(ORIGIN) && u !== "about:blank");
    expect(outside, "top-level navigations outside the app").toEqual([]);
    expect(page.url().startsWith(ORIGIN)).toBe(true);
  });
}

test("ad shield: CineSrc runs in the strict sandbox and cannot take input", async ({ page }) => {
  await page.addInitScript((s) => { localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1"); }, state("cinesrc"));
  await page.goto("/watch/movie/550", { waitUntil: "domcontentloaded" });
  const frame = page.locator("iframe.player-frame");
  await expect(frame).toHaveCount(1, { timeout: 30_000 });
  await expect(frame).toHaveAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation");
  await expect(frame).toHaveAttribute("tabindex", "-1");
  expect(await frame.evaluate((f) => getComputedStyle(f).pointerEvents)).toBe("none");
});
