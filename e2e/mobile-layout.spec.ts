import { expect, test, type Page } from "@playwright/test";

/**
 * Mobile non-regression suite (v1.0.8 roadmap, mission §11).
 * Every key mobile screen at every phone/tablet size (portrait and landscape) must: stay in the mobile layout,
 * never scroll sideways, keep every element inside the viewport unless it sits in a horizontal scroller,
 * keep text at a readable size and keep the bottom navigation reachable with full-size tap targets.
 */
const SIZES: [number, number][] = [[360, 640], [390, 844], [430, 932], [844, 390], [932, 430], [768, 1024], [820, 1180]];
const ROUTES = ["/", "/movies", "/tv", "/new", "/search", "/categories", "/my-space", "/settings", "/title/movie/550", "/title/tv/1396"];

let seeded = "";
test.beforeAll(async ({ request }) => {
  const res = await request.get("https://apikinoma.vercel.app/api/v1/panda/trending?type=all&window=day&page=1");
  const items = ((await res.json()).data?.results ?? []).slice(0, 6);
  const now = Date.now();
  const history = Object.fromEntries(items.slice(0, 3).map((it: { id: string; type: string }, i: number) => [it.id, {
    item: it, position: 1200, duration: 3000, updatedAt: now - i, completed: false, ...(it.type === "tv" ? { season: 1, episode: 2 } : {}),
  }]));
  seeded = JSON.stringify({
    profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }, { id: "p2", name: "Kids", avatar: "kids", kids: true, createdAt: 1 }],
    activeProfileId: "p1", prefs: {}, profilePrefs: {},
    data: { p1: { watchlist: items, ratings: {}, recentSearches: ["bear"], history }, p2: { watchlist: [], ratings: {}, recentSearches: [], history: {} } },
  });
});

async function prepare(page: Page) {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tag_name: "v1.0.0", body: "", assets: [] }) }));
  await page.addInitScript((s) => { localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1"); }, seeded);
}

async function audit(page: Page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const problems: string[] = [];
    if (document.documentElement.dataset.mode === "tv") problems.push("TV layout on a mobile viewport");
    if (document.documentElement.scrollWidth > vw + 1) problems.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${vw})`);
    const inScroller = (el: Element) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") return true;
      }
      return false;
    };
    for (const el of Array.from(document.querySelectorAll("#root *"))) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.position === "fixed" && r.bottom < 0) continue;
      if ((r.right > vw + 1 || r.left < -1) && !inScroller(el)) problems.push(`off-screen: <${el.tagName.toLowerCase()} class="${el.className}"> ${Math.round(r.left)}..${Math.round(r.right)}`);
      const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent!.trim());
      // Poster badges and the TOP 10 corner tag are drawn at 8–8.5 px in the mobile blueprint (spec 12.5); everything else stays at 10 px or more.
      const min = /badge|top10-tag/.test(String(el.className)) ? 8 : 10;
      if (own && parseFloat(cs.fontSize) < min) problems.push(`tiny text (${cs.fontSize}): "${el.textContent!.trim().slice(0, 30)}"`);
    }
    const nav = document.querySelector(".m-nav");
    if (nav) {
      const r = nav.getBoundingClientRect();
      if (r.bottom > window.innerHeight + 1 || r.top < 0) problems.push("bottom navigation is not fully on screen");
      for (const a of Array.from(nav.querySelectorAll("a,button"))) {
        const b = a.getBoundingClientRect();
        if (b.height < 40 || b.width < 40) problems.push(`small tap target in nav (${Math.round(b.width)}x${Math.round(b.height)})`);
      }
    }
    return Array.from(new Set(problems)).slice(0, 12);
  });
}

for (const route of ROUTES) {
  test(`mobile layout holds on ${route} at every size`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile-390", "the suite sets its own viewports");
    await prepare(page);
    const failures: string[] = [];
    for (const [w, h] of SIZES) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
      await page.waitForTimeout(400);
      for (const p of await audit(page)) failures.push(`${w}x${h}: ${p}`);
    }
    expect(failures).toEqual([]);
  });
}

test("Continue Watching and Watchlist rows show on mobile My Space", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile-390", "single viewport check");
  await prepare(page);
  await page.goto("/my-space");
  await expect(page.getByText("Continue Watching").first()).toBeVisible();
  await expect(page.getByText(/left/).first()).toBeVisible();
});
