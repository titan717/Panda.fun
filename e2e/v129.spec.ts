import { expect, test, type Page } from "@playwright/test";

/** v1.2.9: D-pad Down from Details actions, Who's watching on a fresh start, and the /welcome landing page. */
const STATE = JSON.stringify({ profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }], activeProfileId: "p1", prefs: { autoplayTrailers: false }, data: {} });
const RELEASE = { tag_name: "v1.2.8", published_at: "2026-11-10T10:00:00Z", assets: [
  { name: "Panda.fun-Android-TV.apk", size: 4586086, browser_download_url: "https://github.com/titan717/Panda.fun/releases/download/v1.2.8/Panda.fun-Android-TV.apk" },
  { name: "Panda.fun-Android-TV.apk.sha256", size: 99, browser_download_url: "https://github.com/titan717/Panda.fun/releases/download/v1.2.8/Panda.fun-Android-TV.apk.sha256" }
] };

async function open(page: Page, path: string, { fresh = false } = {}) {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "v0.0.1", assets: [] }) }));
  await page.addInitScript(([s, f]) => {
    if (!localStorage.getItem("panda:v1:state")) localStorage.setItem("panda:v1:state", s as string);
    if (!f) sessionStorage.setItem("panda:splash", "1");
  }, [STATE, fresh] as const);
  await page.goto(`${path}${path.includes("?") ? "&" : "?"}layout=tv`, { waitUntil: "domcontentloaded" });
}

test("Down from the Details actions moves into the tabs, never the side rail", async ({ page }, info) => {
  test.skip(!info.project.metadata.tv, "TV layout");
  await open(page, "/title/tv/1399");
  const play = page.locator("#det-primary");
  await expect(play).toBeVisible({ timeout: 30_000 });
  await play.focus();
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(350);
    const inRail = await page.evaluate(() => Boolean(document.activeElement?.closest("[data-nav-side]")));
    expect(inRail).toBe(false);
  }
  await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest(".tv-tabs, .tv-det-panel, [role=tabpanel]")) || document.activeElement?.getAttribute("role") === "tab")).toBe(true);
});

test("Who's watching appears on a fresh start and not again after a reload", async ({ page }, info) => {
  test.skip(info.project.name !== "tv-1920" && info.project.name !== "mobile-390", "one TV and one phone size");
  await open(page, "/", { fresh: true });
  // skip the launch intro with any key or tap
  await page.waitForTimeout(400);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Who's watching?" })).toBeVisible({ timeout: 15_000 });
  await page.locator(".profile-btn").first().click();
  await expect(page.getByRole("heading", { name: "Who's watching?" })).toHaveCount(0);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await expect(page.getByRole("heading", { name: "Who's watching?" })).toHaveCount(0);
});

test("a recreated Android activity (?resumed=1) does not ask again", async ({ page }, info) => {
  test.skip(info.project.name !== "tv-1920", "launch logic is layout independent");
  await open(page, "/?resumed=1", { fresh: true });
  await page.waitForTimeout(2000);
  await expect(page.getByRole("heading", { name: "Who's watching?" })).toHaveCount(0);
});

test("the /welcome landing page shows real release data and working links", async ({ page }, info) => {
  test.skip(info.project.name !== "tv-1920" && info.project.name !== "mobile-390", "desktop and phone");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify(RELEASE) }));
  await page.goto("/welcome/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("[data-release]")).toContainText("Version 1.2.8");
  await expect(page.locator("[data-release]")).toContainText("4.4 MB");
  await expect(page.locator('[data-r="size"]')).toHaveText("4.4 MB");
  const apk = page.locator("[data-apk]").first();
  await expect(apk).toHaveAttribute("href", RELEASE.assets[0]!.browser_download_url);
  await expect(page.getByRole("link", { name: "Stream in Browser" }).first()).toHaveAttribute("href", "/");
  for (const p of ["/privacy", "/terms", "/about"]) await expect(page.locator(`footer a[href="${p}"]`)).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test("the landing page keeps its fallback text when GitHub is unreachable", async ({ page }, info) => {
  test.skip(info.project.name !== "tv-1920", "once");
  await page.route("https://api.github.com/**", (r) => r.fulfill({ status: 403, body: "rate limited" }));
  await page.goto("/welcome/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await expect(page.locator("[data-release]")).toHaveText("Latest release on GitHub");
  await expect(page.locator("[data-apk]").first()).toHaveAttribute("href", "https://github.com/titan717/Panda.fun/releases/latest/download/Panda.fun-Android-TV.apk");
  await expect(page.locator('[data-r="size"]')).toHaveText("See GitHub");
});
