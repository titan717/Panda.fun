import { expect, test, type Page } from "@playwright/test";

/** Settings › Personalize Home and Display › Card size (v1.1.9, D-110/D-111). */
const STATE = JSON.stringify({
  profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }],
  activeProfileId: "p1", prefs: {}, data: {},
});

async function open(page: Page, path: string, tv: boolean) {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "v0.0.1", assets: [] }) }));
  await page.addInitScript((s) => { if (!localStorage.getItem("panda:v1:state")) localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1"); }, STATE);
  await page.goto(`${path}?layout=${tv ? "tv" : "mobile"}`, { waitUntil: "domcontentloaded" });
}
const saved = (page: Page) => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("panda:v1:state") ?? "{}");
  return { ...s.prefs, ...(s.profilePrefs?.[s.activeProfileId] ?? {}) } as { homeOrder?: string[]; homeHidden?: string[]; density?: string };
});
const order = (page: Page) => page.locator("[data-home-section]").evaluateAll((els) => els.map((e) => e.getAttribute("data-home-section")));

test("TV: reorder and hide Home sections with the remote, then reset", async ({ page }, info) => {
  test.skip(!info.project.metadata.tv, "TV only");
  await open(page, "/settings", true);
  await page.locator("#set-home").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#hp-continue")).toBeVisible();
  // move Top 10 up twice: focus stays on its Up arrow
  await page.locator("#hp-top10-up").focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("hp-top10-up");
  await page.keyboard.press("Enter");
  await expect.poll(() => order(page)).toEqual(["top10", "continue", "top-picks", "because", "watched", "rails"]);
  // at the top the Up arrow is disabled and focus hops to Down
  await expect(page.locator("#hp-top10-up")).toBeDisabled();
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("hp-top10-down");
  await page.locator("#hp-watched").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#hp-watched")).toHaveAttribute("aria-checked", "false");
  await expect.poll(async () => (await saved(page)).homeOrder?.[0]).toBe("top10");
  await expect.poll(async () => (await saved(page)).homeHidden).toContain("watched");
  await page.locator("#hp-reset").click();
  await expect.poll(() => order(page)).toEqual(["continue", "top-picks", "top10", "because", "watched", "rails"]);
  await expect(page.locator("#hp-reset")).toHaveCount(0);
});

test("Card size Compact makes posters smaller", async ({ page }, info) => {
  const tv = Boolean(info.project.metadata.tv);
  await open(page, "/settings/display", tv);
  if (tv) { await page.locator("#set-display").focus(); }
  await page.locator("#density-compact").click();
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
  await expect.poll(async () => (await saved(page)).density).toBe("compact");
  await page.locator("#density-standard").click();
  await expect(page.locator("html")).toHaveAttribute("data-density", "standard");
});
