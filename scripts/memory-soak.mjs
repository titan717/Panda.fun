// TV memory soak (v1.1.6): browse Home with the remote, open and close Details many times, and
// report the JS heap after forced GC plus DOM node / listener counts. Usage:
//   node scripts/memory-soak.mjs [cycles=12]   (needs `vite preview` on :4173)
import { chromium } from "playwright";

const base = process.env.BASE ?? "http://127.0.0.1:4173";
const cycles = Number(process.argv[2] ?? 12);
const state = { profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }], activeProfileId: "p1", prefs: { trailerAutoplay: false }, profilePrefs: { p1: { trailerAutoplay: false } }, data: {} };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
await ctx.addInitScript((s) => { if (!localStorage.getItem("panda:v1:state")) localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1"); }, JSON.stringify(state));
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Performance.enable");

async function measure(label) {
  await cdp.send("HeapProfiler.collectGarbage");
  await page.waitForTimeout(300);
  const { metrics } = await cdp.send("Performance.getMetrics");
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
  const cache = await page.evaluate(() => (window.__pandaCacheSize ? window.__pandaCacheSize() : null));
  const row = { label, heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), nodes: m.Nodes, listeners: m.JSEventListeners, swrEntries: cache };
  console.log(JSON.stringify(row));
  return row;
}

await page.goto(`${base}/?layout=tv#/`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const start = await measure("home");
const rows = [];
for (let c = 0; c < cycles; c++) {
  // move along a row, then down a row
  for (let i = 0; i < 8; i++) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(260); }
  await page.keyboard.press("ArrowDown"); await page.waitForTimeout(500);
  // open Details and come back
  await page.keyboard.press("Enter"); await page.waitForTimeout(1600);
  await page.keyboard.press("Escape"); await page.waitForTimeout(900);
  if (c % 4 === 3) rows.push(await measure(`cycle ${c + 1}`));
}
const end = await measure("end");
console.log(JSON.stringify({ summary: { startHeapMB: start.heapMB, endHeapMB: end.heapMB, growthMB: +(end.heapMB - start.heapMB).toFixed(1), startNodes: start.nodes, endNodes: end.nodes, startListeners: start.listeners, endListeners: end.listeners } }));
await browser.close();
