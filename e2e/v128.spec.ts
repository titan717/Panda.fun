import { expect, test, type Page } from "@playwright/test";

/** v1.2.8: desktop mouse paddles on rows, wheel steps focus on TV Home, player keyboard shortcuts sheet. */
const STATE = JSON.stringify({ profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }], activeProfileId: "p1", prefs: { autoplayTrailers: false }, data: {} });
const ok = (data: unknown) => ({ contentType: "application/json", body: JSON.stringify({ success: true, data }) });
const FAKE_EMBED = `<!doctype html><body style="background:#123;margin:0"><script>
let t = 5; const send = (type, data) => parent.postMessage({ type, data }, "*");
send("cinesrc:ready", {}); send("cinesrc:loadedmetadata", { duration: 8000 }); send("cinesrc:play", {});
setInterval(() => { t += 0.25; send("cinesrc:timeupdate", { currentTime: t, duration: 8000 }); }, 250);
</script></body>`;

async function open(page: Page, path: string) {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "v0.0.1", assets: [] }) }));
  await page.addInitScript((s) => { if (!localStorage.getItem("panda:v1:state")) localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1"); }, STATE);
  await page.goto(`${path}${path.includes("?") ? "&" : "?"}layout=tv`, { waitUntil: "domcontentloaded" });
}

test("mouse paddles page a row and show the side that can scroll", async ({ page }, info) => {
  test.skip(!info.project.metadata.tv || info.project.name !== "tv-1920", "desktop TV layout");
  await open(page, "/");
  const rows = page.locator(".tv-row-track[data-scroll-x]");
  await expect(rows.nth(0)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(800);
  // hovering focuses a card and Home re-centres that row, so point at the row again once it has settled
  for (let i = 0; i < 2; i++) {
    const box = await rows.nth(0).boundingBox();
    const y = Math.min(box!.y + box!.height / 2, 1040);
    await page.mouse.move(900, y);
    await page.mouse.move(905 + i, y);
    await page.waitForTimeout(900);
  }
  await expect(page.locator(".row-paddle--right")).toBeVisible();
  await expect(page.locator(".row-paddle--left")).toHaveCount(0);
  await expect(page.locator(".row-paddle--right")).toHaveAttribute("tabindex", "-1");
  await page.locator(".row-paddle--right").click();
  await expect.poll(() => page.evaluate(() => document.querySelectorAll<HTMLElement>(".tv-row-track[data-scroll-x]")[0]!.scrollLeft)).toBeGreaterThan(200);
  await expect(page.locator(".row-paddle--left")).toBeVisible();
});

test("the wheel steps focus row by row on TV Home", async ({ page }, info) => {
  test.skip(!info.project.metadata.tv || info.project.name !== "tv-1920", "desktop TV layout");
  await open(page, "/");
  await expect(page.locator(".tv-hero-card")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => document.activeElement?.classList.contains("tv-hero-card"))).toBe(true);
  await page.mouse.move(1700, 60);
  const row = () => page.evaluate(() => { const r = document.activeElement?.closest(".tv-row"); return r ? Array.from(document.querySelectorAll(".tv-row")).indexOf(r) : -1; });
  await page.mouse.wheel(0, 120);
  await expect.poll(row).toBe(0);
  await page.waitForTimeout(300);
  await page.mouse.wheel(0, 120);
  await expect.poll(row).toBe(1);
  await page.waitForTimeout(300);
  await page.mouse.wheel(0, -120);
  await expect.poll(row).toBe(0);
});

test("? opens the keyboard shortcuts sheet in the player and M toggles sound", async ({ page }, info) => {
  test.skip(info.project.name !== "tv-1920", "keyboard");
  await page.route(/\/api\/v1\/panda\/play\/movie\/550/, (r) => r.fulfill(ok({ type: "movie", tmdbId: 550, sources: [{ id: "cinesrc", provider: "cinesrc", label: "CineSrc", url: "https://cinesrc.st/embed/movie/550", origin: "https://cinesrc.st", events: "cinesrc", supportsStart: true }] })));
  await page.route(/^https:\/\/cinesrc\.st\/embed\//, (r) => r.fulfill({ contentType: "text/html", body: FAKE_EMBED }));
  await open(page, "/watch/movie/550");
  await expect(page.locator(".player")).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press("Shift+Slash");
  await expect(page.getByRole("dialog", { name: /keyboard shortcuts/i })).toBeVisible();
  await expect(page.locator(".keys-row")).toHaveCount(9);
  await page.keyboard.press("Escape");
  await expect(page.locator(".keys-row")).toHaveCount(0);
  await page.keyboard.press("m");
  await expect(page.locator(".toast").filter({ hasText: /Sound off/ })).toBeVisible();
});
