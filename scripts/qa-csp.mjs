// Serves dist through vite preview with the production CSP from vercel.json injected on documents,
// then walks the main routes (phone + TV, home trailers, details, player) and reports every CSP violation.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const base = "http://127.0.0.1:4173";
const csp = JSON.parse(readFileSync("vercel.json", "utf8")).headers.flatMap((h) => h.headers).find((h) => h.key === "Content-Security-Policy").value;
const ROUTES = ["/", "/title/movie/550", "/title/tv/1396", "/search", "/settings", "/movies", "/watch/movie/550", "/watch/tv/1396/1/1"];
const state = JSON.stringify({ profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }], activeProfileId: "p1", prefs: {}, data: {} });
const browser = await chromium.launch();
let total = 0;
for (const tv of [false, true]) {
  const ctx = await browser.newContext(tv ? { viewport: { width: 1920, height: 1080 } } : { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.route(`${base}/**`, async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const res = await route.fetch();
    await route.fulfill({ response: res, headers: { ...res.headers(), "content-security-policy": csp } });
  });
  await ctx.addInitScript((s) => {
    localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1");
    window.__csp = []; document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI} ${e.sourceFile || ""}:${e.lineNumber || ""}`));
  }, state);
  const page = await ctx.newPage();
  const consoleHits = [];
  page.on("console", (m) => { if (/Content Security Policy|integrity/i.test(m.text())) consoleHits.push(m.text().slice(0, 200)); });
  for (const r of ROUTES) {
    await page.goto(base + r + (tv ? (r.includes("?") ? "&" : "?") + "layout=tv" : ""), { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(r === "/" && tv ? 9000 : 2500);
    const v = await page.evaluate(() => window.__csp.splice(0));
    const c = consoleHits.splice(0);
    if (v.length || c.length) { total += v.length + c.length; console.log(`${tv ? "tv" : "phone"} ${r}:\n  ` + [...new Set([...v, ...c])].join("\n  ")); }
  }
  await ctx.close();
}
console.log(total ? `VIOLATIONS ${total}` : "CSP OK (0 violations)");
await browser.close();
