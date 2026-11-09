import { expect, test, type Page } from "@playwright/test";

/** v1.2.5 Home polish: rows follow focus, Top 10 numerals, row headers and card states. */
const STATE = JSON.stringify({ profiles: [{ id: "pa", name: "Ana", avatar: "smile", kids: false, createdAt: 1 }], activeProfileId: "pa", prefs: { trailerAutoplay: false }, data: { pa: {} } });

async function boot(page: Page, layout: "tv" | "mobile") {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "v0.0.1", assets: [] }) }));
  await page.addInitScript((s) => { localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1"); }, STATE);
  await page.goto(`/?layout=${layout}`, { waitUntil: "domcontentloaded" });
}

const activeBox = (page: Page) => page.evaluate(() => {
  const a = document.activeElement as HTMLElement | null;
  const r = a?.getBoundingClientRect();
  return { id: a?.id ?? "", left: r?.left ?? 0, right: r?.right ?? 0, vw: innerWidth };
});

test("TV: moving along a row scrolls it, so the focused card stays on screen inside the safe margin", async ({ page }, info) => {
  test.skip(!info.project.metadata.tv, "TV screen");
  await boot(page, "tv");
  await expect(page.locator("#trending-0")).toBeAttached({ timeout: 30_000 });
  await page.locator("#trending-0").focus();
  await page.keyboard.press("ArrowRight"); // let lrud take over from a real key
  for (let i = 0; i < 8; i++) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(120); }
  await expect.poll(async () => (await activeBox(page)).id).toBe("trending-9");
  await page.waitForTimeout(700); // smooth scroll + expand
  const b = await activeBox(page);
  expect(b.left).toBeGreaterThan(0);
  // 120 tu overscan margin minus a little slack for the scale-up
  expect(b.right).toBeLessThanOrEqual(b.vw - (120 * b.vw) / 1920 + 4);
});

test("TV: Top 10 numerals are outlined, sit behind their poster and \"10\" gets the wide slot", async ({ page }, info) => {
  test.skip(!info.project.metadata.tv, "TV screen");
  await boot(page, "tv");
  const nums = page.locator(".tv-row--top10 .top10-num");
  await expect(nums.first()).toBeAttached({ timeout: 30_000 });
  const n = await nums.count();
  expect(n).toBeGreaterThan(0);
  const style = await nums.first().evaluate((el) => { const cs = getComputedStyle(el); return { stroke: cs.getPropertyValue("-webkit-text-stroke-width"), color: cs.color, weight: cs.fontWeight }; });
  expect(parseFloat(style.stroke)).toBeGreaterThan(0);
  expect(style.weight).toBe("800");
  if (n >= 10) {
    const wide = page.locator(".tv-row--top10 .tv-card-wrap").nth(9);
    await expect(wide).toHaveClass(/is-wide-rank/);
    // the poster starts after the numeral's "1"
    const [num, card] = await Promise.all([wide.locator(".top10-num").boundingBox(), wide.locator(".tv-card").boundingBox()]);
    expect(card!.x - num!.x).toBeGreaterThan(num!.width * 0.45);
  }
});

test("phone: row headers keep a 44 px chevron, one line, and the Top 10 numeral never covers its poster", async ({ page }, info) => {
  test.skip(Boolean(info.project.metadata.tv), "phone screen");
  await boot(page, "mobile");
  const more = page.locator(".m-row-more").first();
  await expect(more).toBeVisible({ timeout: 30_000 });
  const mb = await more.boundingBox();
  expect(mb!.width).toBeGreaterThanOrEqual(44);
  expect(mb!.height).toBeGreaterThanOrEqual(44);
  const heads = await page.locator(".m-row-head .m-row-title").evaluateAll((els) => els.map((e) => { const cs = getComputedStyle(e); return { ws: cs.whiteSpace, h: e.getBoundingClientRect().height, lh: parseFloat(cs.lineHeight) }; }));
  for (const h of heads) { expect(h.ws).toBe("nowrap"); expect(h.h).toBeLessThanOrEqual(h.lh + 1); }
  const ranked = page.locator(".m-poster.has-rank");
  await expect(ranked.first()).toBeAttached({ timeout: 30_000 });
  await ranked.first().evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(300);
  const z = await ranked.first().evaluate((el) => {
    const media = el.querySelector(".m-poster-media")!.getBoundingClientRect();
    const rank = el.querySelector(".m-rank")!;
    // the topmost element over the numeral's right edge, inside the poster, is the poster
    const x = media.left + 3, y = media.bottom - 10;
    const top = document.elementFromPoint(x, y);
    return { poster: Boolean(top?.closest(".m-poster-media")), rankZ: getComputedStyle(rank).zIndex };
  });
  expect(z.rankZ).toBe("auto");
  expect(z.poster).toBe(true);
  if (await ranked.count() >= 10) await expect(ranked.nth(9)).toHaveClass(/is-wide-rank/);
});

test("phone: keyboard focus rings the artwork, not the whole Top 10 slot", async ({ page }, info) => {
  test.skip(Boolean(info.project.metadata.tv), "phone screen");
  await boot(page, "mobile");
  const card = page.locator(".m-poster.has-rank").first();
  await expect(card).toBeAttached({ timeout: 30_000 });
  await card.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const ring = await card.evaluate((el) => ({ card: getComputedStyle(el).outlineStyle, media: getComputedStyle(el.querySelector(".m-poster-media")!).outlineStyle, fv: el.matches(":focus-visible") }));
  if (ring.fv) { expect(ring.card).toBe("none"); expect(ring.media).toBe("solid"); }
});
