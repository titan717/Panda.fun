import { chromium } from "playwright";
const base = process.env.BASE ?? "http://127.0.0.1:4173";
const [,, mode = "mobile", w = "390", h = "844", ...routes] = process.argv;
const state = process.env.STATE_FILE ? JSON.parse((await import("node:fs")).readFileSync(process.env.STATE_FILE, "utf8")) : { profiles: [{ id: "p1", name: "You", avatar: "smile", kids: false, createdAt: 1 }, { id: "p2", name: "Kids", avatar: "kids", kids: true, createdAt: 1 }], activeProfileId: "p1", prefs: {}, data: {} };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: mode === "mobile", isMobile: mode === "mobile" && +w < 1000 });
await ctx.addInitScript((s) => { if (!localStorage.getItem("panda:v1:state")) localStorage.setItem("panda:v1:state", s); sessionStorage.setItem("panda:splash", "1"); }, JSON.stringify(state));
const page = await ctx.newPage();
const errs = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(`[${m.type()}] ${m.text()}`); });
page.on("pageerror", (e) => errs.push(`[pageerror] ${e.message}`));
page.on("requestfailed", (r) => { const u = r.url(); if (!/youtube|ytimg|cinesrc|vidy|google/.test(u)) errs.push(`[reqfail] ${u} ${r.failure()?.errorText}`); });
page.on("response", (r) => { if (r.status() >= 400) errs.push(`[http ${r.status()}] ${r.url()}`); });
for (const r of routes) {
  const [path, keys] = r.split("|");
  const sep = path.includes("?") ? "&" : "?";
  await page.goto(`${base}${path}${mode === "tv" ? `${sep}layout=tv` : ""}`, { waitUntil: "networkidle", timeout: 60000 }).catch((e) => errs.push(`[goto] ${e.message}`));
  await page.waitForTimeout(2500);
  // "#id" or ".class" focuses an element (TV tabs switch on focus); anything else is a key press
  for (const k of (keys ?? "").split(",").filter(Boolean)) { if (/^[#.]/.test(k)) await page.focus(k).catch((e) => errs.push(`[focus] ${e.message}`)); else await page.keyboard.press(k); await page.waitForTimeout(450); }
  await page.waitForTimeout(+(process.env.SETTLE ?? 800));
  const name = `${mode}-${w}x${h}-${path.replace(/[^a-z0-9]+/gi, "_")}${keys ? "-" + keys.replace(/[^a-z0-9]+/gi, "") : ""}`.slice(0, 120);
  await page.screenshot({ path: `/tmp/qa/${name}.png` });
  console.log("shot", name);
}
console.log(errs.length ? errs.join("\n") : "NO ERRORS");
await browser.close();
