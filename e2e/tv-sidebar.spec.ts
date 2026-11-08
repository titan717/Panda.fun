import { expect, test, type Page } from "@playwright/test";

/** TV sidebar behaviour (BLUEPRINT_SPEC §4, docs/skills/tv-sidebar-test.md). TV projects only. */
const STATE = JSON.stringify({
  profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }],
  activeProfileId: "p1", prefs: {}, data: {},
});

async function open(page: Page, path: string) {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "v0.0.1", assets: [] }) }));
  await page.addInitScript((s) => { localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1"); }, STATE);
  await page.goto(`${path}${path.includes("?") ? "&" : "?"}layout=tv`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  await page.locator(".rail").waitFor();
}
const activeId = (page: Page) => page.evaluate(() => document.activeElement?.id ?? "");
const inRail = (page: Page) => page.evaluate(() => Boolean(document.activeElement?.closest(".rail")));

async function enterRail(page: Page) {
  for (let i = 0; i < 12 && !(await inRail(page)); i++) { await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(60); }
  expect(await inRail(page)).toBe(true);
}

test.describe("TV sidebar", () => {
  test.beforeEach(({ page: _page }, info) => { test.skip(!info.project.metadata.tv, "TV only"); });

  for (const [path, id] of [["/", "rail-home"], ["/movies", "rail-movies"], ["/search", "rail-search"], ["/categories", "rail-categories"]] as const) {
    test(`Left from content opens on the current section (${path})`, async ({ page }) => {
      await open(page, path);
      await page.locator("#main").locator("a,button,input,[tabindex='0']").first().waitFor();
      if (path !== "/search") await page.keyboard.press("ArrowDown");
      await enterRail(page);
      expect(await activeId(page)).toBe(id);
      await expect(page.locator(".rail")).toHaveClass(/is-open/);
    });
  }

  test("collapsed vs expanded geometry, overlay, order and return focus", async ({ page }, info) => {
    await open(page, "/");
    const vw = page.viewportSize()!.width;
    const tu = vw / 1920;
    await page.waitForTimeout(400);
    const before = await page.locator("#main").boundingBox();
    await expect(page.locator(".rail")).not.toHaveClass(/is-open/);
    await expect(page.locator("#rail-tv")).toHaveCSS("opacity", "0");
    await page.screenshot({ path: `test-results/sidebar-${info.project.name}-collapsed.png` });
    // focus a content item, remember it, open the sidebar
    await page.keyboard.press("ArrowDown");
    const content = await page.evaluate(() => { const a = document.activeElement as HTMLElement; a.dataset.sidebarMark = "1"; return a.closest(".rail") ? null : a.tagName; });
    expect(content).not.toBeNull();
    await enterRail(page);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/sidebar-${info.project.name}-expanded.png` });
    const panel = await page.locator(".rail-panel").boundingBox();
    expect(Math.abs(panel!.width - 400 * tu)).toBeLessThan(2);
    // overlay, not shift
    const after = await page.locator("#main").boundingBox();
    expect(after!.x).toBe(before!.x);
    await expect(page.locator("#rail-tv")).toHaveCSS("opacity", "1");
    // order: down from Home walks TV, Movies, New & Hot, Categories, My Space; never leaves the rail
    const seen: string[] = [];
    for (let i = 0; i < 7; i++) { await page.keyboard.press("ArrowDown"); seen.push(await activeId(page)); }
    expect(seen).toEqual(["rail-tv", "rail-movies", "rail-new", "rail-categories", "rail-myspace", "rail-myspace", "rail-myspace"]);
    for (let i = 0; i < 9; i++) await page.keyboard.press("ArrowUp");
    expect(await activeId(page)).toBe("rail-update");
    await page.keyboard.press("ArrowLeft");
    expect(await inRail(page)).toBe(true);
    // Right returns to the exact item
    await page.keyboard.press("ArrowRight");
    expect(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.sidebarMark)).toBe("1");
    await expect(page.locator(".rail")).not.toHaveClass(/is-open/);
    // Back returns too, and stays on the page
    await enterRail(page);
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.sidebarMark)).toBe("1");
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("selecting a section navigates and keeps the rail lit", async ({ page }) => {
    await open(page, "/");
    await page.keyboard.press("ArrowDown");
    await enterRail(page);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    expect(await activeId(page)).toBe("rail-movies");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/movies/);
    await expect(page.locator("#rail-movies")).toHaveAttribute("aria-current", "page");
    await expect(page.locator("#rail-home")).toHaveClass(/is-lit/);
  });

  test("only transform and opacity animate", async ({ page }) => {
    await open(page, "/");
    const props = await page.evaluate(() => [".rail-panel", ".rail-item", ".rail-label", ".rail-update"].map((s) => getComputedStyle(document.querySelector(s)!).transitionProperty));
    for (const p of props) for (const part of p.split(",").map((x) => x.trim())) expect(["transform", "opacity", "color", "box-shadow"]).toContain(part);
  });
});
