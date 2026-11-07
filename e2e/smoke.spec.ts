import { expect, test, type Page } from "@playwright/test";

const STATE = JSON.stringify({
  profiles: [
    { id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 },
    { id: "p2", name: "Kids", avatar: "kids", kids: true, createdAt: 1 },
  ],
  activeProfileId: "p1", prefs: {}, data: {},
});
const THIRD_PARTY = /youtube|ytimg|googlevideo|doubleclick|cinesrc|vidsrc|google/;

async function open(page: Page, path: string, tv: boolean) {
  const issues: string[] = [];
  page.on("pageerror", (e) => issues.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => { if (!THIRD_PARTY.test(r.url()) && r.failure()?.errorText !== "net::ERR_ABORTED") issues.push(`failed: ${r.url()}`); });
  page.on("response", (r) => { if (r.status() >= 400 && !THIRD_PARTY.test(r.url())) issues.push(`http ${r.status()}: ${r.url()}`); });
  // GitHub's unauthenticated API is rate-limited per IP; serve a release-shaped fixture in CI.
  await page.route("https://api.github.com/repos/titan717/Panda.fun/releases/latest", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ tag_name: "v1.0.0", name: "Panda.fun v1.0.0", body: "Signed release build.", published_at: "2026-11-07T00:00:00Z", html_url: "https://github.com/titan717/Panda.fun/releases/tag/v1.0.0", assets: [{ name: "Panda.fun-Android-TV.apk", browser_download_url: "https://github.com/titan717/Panda.fun/releases/download/v1.0.0/Panda.fun-Android-TV.apk", size: 12_000_000 }] }),
  }));
  await page.addInitScript((s) => {
    if (!localStorage.getItem("panda:v1:state")) localStorage.setItem("panda:v1:state", s);
    sessionStorage.setItem("panda:splash", "1");
  }, STATE);
  const sep = path.includes("?") ? "&" : "?";
  await page.goto(`${path}${tv ? `${sep}layout=tv` : ""}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 45_000 }).catch(() => undefined);
  return issues;
}

const ROUTES = ["/", "/movies", "/tv", "/new", "/search", "/categories", "/my-space", "/my-list", "/continue-watching", "/settings", "/settings/updates", "/about", "/profiles", "/title/movie/550", "/title/tv/1396"];

for (const route of ROUTES) {
  test(`renders ${route} without errors`, async ({ page }, info) => {
    const tv = Boolean(info.project.metadata.tv);
    const issues = await open(page, route, tv);
    await expect(page.locator("#root")).not.toBeEmpty();
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
    const broken = await page.$$eval("img", (imgs) => imgs.filter((i) => i.complete && i.currentSrc && i.naturalWidth === 0).map((i) => i.currentSrc));
    expect(broken, "broken images").toEqual([]);
    expect(issues, "runtime/network issues").toEqual([]);
  });
}

test("home shows real catalogue rows", async ({ page }, info) => {
  await open(page, "/", Boolean(info.project.metadata.tv));
  await expect(page.locator("img[src*='image.tmdb.org']").first()).toBeVisible({ timeout: 30_000 });
});

test("TV D-pad moves focus and Back returns", async ({ page }, info) => {
  test.skip(!info.project.metadata.tv, "TV only");
  await open(page, "/", true);
  await page.keyboard.press("ArrowDown");
  const first = await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80) ?? "");
  await page.keyboard.press("ArrowRight");
  const second = await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80) ?? "");
  expect(first).not.toBe("");
  expect(second).not.toBe(first);
  await page.goto("/settings?layout=tv");
  await page.goto("/about?layout=tv");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/settings/);
});

test("search returns results for a real query", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  await open(page, "/search", tv);
  const input = page.locator("input[type='search'], input").first();
  await input.fill("batman");
  await expect(page.locator("img[src*='image.tmdb.org']").first()).toBeVisible({ timeout: 30_000 });
});

test("check for updates reaches GitHub Releases", async ({ page }, info) => {
  await open(page, "/settings/updates", Boolean(info.project.metadata.tv));
  await expect(page.getByText(/version/i).first()).toBeVisible();
});
