import { chromium } from "playwright";
const base = "http://127.0.0.1:4173";
const state = { profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }], activeProfileId: "p1", prefs: {}, data: {} };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
await ctx.addInitScript((s) => { localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1"); }, JSON.stringify(state));
const page = await ctx.newPage(); globalThis.document = null;
await page.goto(`${base}/?layout=tv`, { waitUntil: "networkidle" }); await page.waitForTimeout(2000);
for (const k of ["ArrowDown", "ArrowDown", "ArrowRight", "ArrowRight"]) {
  await page.keyboard.press(k); const t0 = Date.now();
  let ok = false;
  for (let i = 0; i < 40 && !ok; i++) { await page.waitForTimeout(100); ok = await page.evaluate(() => { const l = [...document.querySelectorAll(".tv-backdrop-layer img")].pop(); return Boolean(l && l.complete && l.naturalWidth); }); }
  console.log(k, ok, Date.now() - t0, document ? "" : "", JSON.stringify(await page.evaluate(() => ({ focus: document.activeElement?.getAttribute("aria-label"), layers: [...document.querySelectorAll(".tv-backdrop-layer img")].map((i) => [i.src.slice(-20), getComputedStyle(i).opacity, i.className]) }))));
}
await browser.close();
