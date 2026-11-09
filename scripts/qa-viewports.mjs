import { chromium } from "playwright";
const base = "http://127.0.0.1:4173";
const VPS = [[360,640],[390,844],[430,932],[932,430],[768,1024],[820,1180],[1280,720],[1440,900],[1920,1080],[3840,2160]];
const ROUTES = process.env.ROUTES ? process.env.ROUTES.split(",") : ["/", "/title/movie/550", "/title/tv/1396", "/search", "/settings", "/settings/sources", "/movies", "/new"];
const state = JSON.stringify({ profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }], activeProfileId: "p1", prefs: {}, data: {} });
const browser = await chromium.launch();
for (const [w,h] of VPS) {
  const mobile = w < 1000;
  for (const tv of mobile ? [false] : [false, true]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile && w < 900, hasTouch: mobile });
    await ctx.route("https://api.github.com/**", (r) => r.fulfill({ contentType: "application/json", body: "{}" }));
    await ctx.addInitScript((s) => { localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1"); }, state);
    const page = await ctx.newPage();
    for (const r of ROUTES) {
      await page.goto(base + r + (tv ? (r.includes("?") ? "&" : "?") + "layout=tv" : ""), { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(1200);
      const res = await page.evaluate(() => {
        const out = [];
        const sw = document.scrollingElement.scrollWidth, cw = document.documentElement.clientWidth;
        if (sw > cw + 1) out.push(`page overflow-x ${sw}>${cw}`);
        for (const el of document.querySelectorAll("button, a, h1, h2, h3, p, span, label")) {
          const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
          const b = el.getBoundingClientRect(); if (!b.width || !b.height) continue;
          if (el.closest("[aria-hidden='true'], .tv-row-track, .m-row-track, [class*='track'], [class*='scroller'], [class*='chips'], .hero, [class*='hero'], .rail, iframe")) continue;
          // anything inside a horizontal scroller (season tabs, chip strips) is meant to run past the edge
          let sc = el.parentElement, inScroller = false;
          while (sc) { const ox = getComputedStyle(sc).overflowX; if (ox === "auto" || ox === "scroll") { inScroller = true; break; } sc = sc.parentElement; }
          if (inScroller) continue;
          if (b.right > innerWidth + 2 && b.left < innerWidth && el.children.length === 0 && el.textContent.trim()) out.push(`offscreen-right ${el.tagName}.${el.className} "${el.textContent.trim().slice(0,30)}" ${Math.round(b.right)}`);
          if (cs.textOverflow !== "ellipsis" && cs.overflow !== "visible" && el.scrollWidth > el.clientWidth + 2 && el.children.length === 0 && el.textContent.trim() && cs.whiteSpace === "nowrap") out.push(`clipped ${el.tagName}.${el.className} "${el.textContent.trim().slice(0,30)}"`);
        }
        return [...new Set(out)].slice(0, 8);
      });
      if (res.length) console.log(`${w}x${h}${tv ? " tv" : ""} ${r}:\n  ` + res.join("\n  "));
    }
    await ctx.close();
  }
}
console.log("DONE");
await browser.close();
