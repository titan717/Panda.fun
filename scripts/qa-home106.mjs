import { chromium } from "playwright";
const base = "http://127.0.0.1:4173";
const state = { profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }], activeProfileId: "p1", prefs: {}, data: {} };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
await ctx.addInitScript((s) => { localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1"); }, JSON.stringify(state));
const page = await ctx.newPage();
// skeleton: hold API responses
await page.route(/apikinoma/, async (r) => { await new Promise((x) => setTimeout(x, 6000)); r.continue().catch(() => {}); });
await page.goto(`${base}/?layout=tv`); await page.waitForTimeout(1800);
await page.screenshot({ path: "/tmp/qa/h106-skeleton.png" });
await page.unroute(/apikinoma/);
await page.waitForTimeout(7000);
await page.keyboard.press("ArrowDown"); await page.waitForTimeout(400);
await page.keyboard.press("ArrowDown"); await page.waitForTimeout(2500);
await page.screenshot({ path: "/tmp/qa/h106-row2.png" });
console.log(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")));
await browser.close();
