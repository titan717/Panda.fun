import { chromium } from "playwright";
const base = "http://127.0.0.1:4173";
const prefs = { uiScale: 90, textSize: "larger", highContrast: true, reduceMotion: true };
const state = { profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }], activeProfileId: "p1", prefs: {}, profilePrefs: { p1: prefs }, data: {} };
const browser = await chromium.launch();
for (const [mode, w, h] of [["tv", 1920, 1080], ["mobile", 390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: mode === "mobile", isMobile: mode === "mobile" });
  await ctx.addInitScript((s) => { localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1"); }, JSON.stringify(state));
  const page = await ctx.newPage();
  await page.goto(`${base}/${mode === "tv" ? "?layout=tv" : ""}`, { waitUntil: "networkidle" }); await page.waitForTimeout(2500);
  if (mode === "tv") { await page.keyboard.press("ArrowDown"); await page.waitForTimeout(1200); }
  console.log(mode, JSON.stringify(await page.evaluate(() => ({ ds: { ...document.documentElement.dataset }, fs: document.documentElement.style.getPropertyValue("--fs"), rootT: getComputedStyle(document.getElementById("root")).transform, h2: getComputedStyle(document.querySelector("h2") ?? document.body).fontSize }))));
  await page.screenshot({ path: `/tmp/qa/display-${mode}.png` });
  await ctx.close();
}
await browser.close();
