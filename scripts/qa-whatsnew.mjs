// QA: simulate an update (seen version older than installed) and capture the What's New sheet.
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://127.0.0.1:4173";
const state = { profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }], activeProfileId: "p1", prefs: {}, data: {} };
const browser = await chromium.launch();
for (const [mode, w, h] of [["tv", 1920, 1080], ["mobile", 390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mode === "mobile", hasTouch: mode === "mobile" });
  await ctx.addInitScript((s) => { localStorage.setItem("panda:v1:state", s); if (!sessionStorage.getItem("qa:seeded")) { localStorage.setItem("panda:seen-version", "1.0.3"); sessionStorage.setItem("qa:seeded", "1"); } sessionStorage.setItem("panda:splash", "1"); }, JSON.stringify(state));
  const page = await ctx.newPage();
  await page.goto(`${base}/${mode === "tv" ? "?layout=tv" : ""}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const open = await page.locator(".whatsnew").count();
  await page.screenshot({ path: `/tmp/qa/whatsnew-${mode}.png` });
  await page.keyboard.press("Enter"); await page.waitForTimeout(500);
  console.log(mode, "sheet shown:", open, "closed after OK:", (await page.locator(".whatsnew").count()) === 0);
  await page.goto(`${base}/settings/whats-new${mode === "tv" ? "?layout=tv" : ""}`, { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
  console.log(mode, "sheet again on reload:", await page.locator(".whatsnew").count());
  await page.screenshot({ path: `/tmp/qa/whatsnew-page-${mode}.png` });
  await ctx.close();
}
await browser.close();
