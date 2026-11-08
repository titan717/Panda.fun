// QA: cold start — capture the pre-JS boot splash (JS blocked) and the React splash, and time first paint.
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://127.0.0.1:4173";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
await page.route(/\.js$/, (r) => r.abort());
await page.goto(`${base}/?layout=tv`); await page.waitForTimeout(400);
await page.screenshot({ path: "/tmp/qa/boot-nojs.png" });
await page.unroute(/\.js$/);
const p2 = await ctx.newPage();
const t0 = Date.now();
await p2.goto(`${base}/?layout=tv`, { waitUntil: "commit" });
await p2.waitForSelector(".splash, .boot");
console.log("splash visible after", Date.now() - t0, "ms");
await p2.waitForTimeout(600); await p2.screenshot({ path: "/tmp/qa/boot-react.png" });
const fcp = await p2.evaluate(() => performance.getEntriesByName("first-contentful-paint")[0]?.startTime);
console.log("FCP", Math.round(fcp ?? -1), "ms");
await browser.close();
