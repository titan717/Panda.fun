// Generates every launcher icon, TV banner and PWA icon from the Panda mark (src/components/Icon.tsx)
// on the splash gradient (BLUEPRINT_SPEC §2). Run: node scripts/gen-brand.mjs
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const font = readFileSync("node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2").toString("base64");
const MARK = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
<circle cx="16" cy="15" r="10" fill="#171820" stroke="#f7f5ff" stroke-width="2.5"/>
<circle cx="48" cy="15" r="10" fill="#171820" stroke="#f7f5ff" stroke-width="2.5"/>
<rect x="11" y="12" width="42" height="42" rx="20" fill="#f7f5ff"/>
<ellipse cx="22" cy="30" rx="8" ry="11" transform="rotate(28 22 30)" fill="#171820"/>
<ellipse cx="42" cy="30" rx="8" ry="11" transform="rotate(-28 42 30)" fill="#171820"/>
<circle cx="24" cy="29" r="2.4" fill="#f7f5ff"/><circle cx="40" cy="29" r="2.4" fill="#f7f5ff"/>
<path d="M29 39c1.8-2.2 4.2-2.2 6 0-1 3.4-5 4.1-6 0Z" fill="#171820"/>
<circle cx="18" cy="40" r="3" fill="#d9ccff"/><circle cx="46" cy="40" r="3" fill="#d9ccff"/></svg>`;
const GRAD = "linear-gradient(160deg, #0b2a6b 0%, #13306e 48%, #3a1d5a 72%, #7a1430 100%)";
writeFileSync("public/icon.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b2a6b"/><stop offset=".48" stop-color="#13306e"/><stop offset=".72" stop-color="#3a1d5a"/><stop offset="1" stop-color="#7a1430"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#g)"/><g transform="translate(9 10) scale(.72)">${MARK.replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g></svg>\n`);

// kind: square (full-bleed), round (circle), fg (transparent adaptive foreground), bg (adaptive background), banner
function html(kind, w, h, markPct) {
  const bg = kind === "fg" ? "transparent" : GRAD;
  const radius = kind === "round" ? "50%" : "0";
  const body = kind === "bg" ? "" : kind === "banner"
    ? `<div style="display:flex;align-items:center;gap:${w * 0.04}px">
         <div style="width:${h * 0.44}px;height:${h * 0.44}px">${MARK}</div>
         <div style="font:500 ${h * 0.2}px Inter;letter-spacing:-0.01em;color:#cfe3f2">Panda<span style="color:#8fb3d9">.fun</span></div></div>`
    : `<div style="width:${w * markPct}px;height:${w * markPct}px;margin-top:${markPct === 1 ? 0 : w * 0.03}px">${MARK}</div>`;
  return `<!doctype html><style>@font-face{font-family:Inter;src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:100 900}
  html,body{margin:0;background:transparent}svg{width:100%;height:100%;display:block}
  #c{width:${w}px;height:${h}px;border-radius:${radius};overflow:hidden;background:${bg};display:flex;align-items:center;justify-content:center;
  box-shadow:${kind === "fg" || kind === "bg" ? "none" : `inset 0 0 ${w * 0.12}px rgba(0,0,0,.25)`}}</style><div id="c">${body}</div>`;
}

const RES = "android/app/src/main/res";
const jobs = [];
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, s] of Object.entries(dens)) {
  jobs.push([`${RES}/mipmap-${d}/ic_launcher.png`, "square", 48 * s, 48 * s, 0.66]);
  jobs.push([`${RES}/mipmap-${d}/ic_launcher_round.png`, "round", 48 * s, 48 * s, 0.6]);
  jobs.push([`${RES}/mipmap-${d}/ic_launcher_foreground.png`, "fg", 108 * s, 108 * s, 0.44]);
  jobs.push([`${RES}/mipmap-${d}/ic_launcher_background.png`, "bg", 108 * s, 108 * s, 0]);
}
jobs.push([`${RES}/drawable-xhdpi/splash_mark.png`, "fg", 180, 180, 1]);
jobs.push([`${RES}/drawable-xxhdpi/splash_mark.png`, "fg", 270, 270, 1]);
jobs.push([`${RES}/drawable-xhdpi/tv_banner.png`, "banner", 320, 180]);
jobs.push([`${RES}/drawable-xxhdpi/tv_banner.png`, "banner", 480, 270]);
jobs.push([`${RES}/drawable-xxxhdpi/tv_banner.png`, "banner", 640, 360]);
jobs.push([`public/tv-banner-320x180.png`, "banner", 320, 180]);
jobs.push([`public/pwa-192x192.png`, "square", 192, 192, 0.66]);
jobs.push([`public/pwa-512x512.png`, "square", 512, 512, 0.66]);
jobs.push([`public/pwa-maskable-512x512.png`, "square", 512, 512, 0.5]);
jobs.push([`public/apple-touch-icon.png`, "square", 180, 180, 0.66]);
jobs.push([`/tmp/favicon-32.png`, "square", 32, 32, 0.74]);

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [out, kind, w, h, pct] of jobs) {
  mkdirSync(out.slice(0, out.lastIndexOf("/")), { recursive: true });
  await page.setViewportSize({ width: Math.round(w), height: Math.round(h) });
  await page.setContent(html(kind, Math.round(w), Math.round(h), pct ?? 0.6), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.locator("#c").screenshot({ path: out, omitBackground: true });
  console.log("wrote", out);
}
await browser.close();
