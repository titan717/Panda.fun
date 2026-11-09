#!/usr/bin/env node
// Source ad scoring (docs/SOURCES.md). Loads each source's real embed for a movie, an episode and an
// anime episode inside a local host page (the same iframe sandbox Panda uses), then counts popups,
// top-level navigation attempts, intent:/market: attempts, requests to known ad and tracker hosts
// (StevenBlack unified hosts, MIT) and the time to the first playback event. Clicks the frame
// centre twice, like a viewer pressing play, because most ad scripts arm on the first click.
// Usage: node scripts/source-adscore.mjs [--seconds 25] [--out docs/sources/adscore.json]
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { gunzipSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SECONDS = Number(arg("--seconds", "25"));
const OUT = arg("--out", "docs/sources/adscore.json");
const ONLY = arg("--only", "");

const blocked = new Set(gunzipSync(readFileSync("android/app/src/main/assets/shield/hosts.txt.gz")).toString().split("\n").filter(Boolean));
const isAd = (host) => { const p = host.split("."); for (let i = 0; i < p.length - 1; i++) if (blocked.has(p.slice(i).join("."))) return true; return false; };

const STRICT = "allow-scripts allow-same-origin allow-presentation";
// [id, kind, url, sandbox, origin of events]
const CASES = [
  ["cinesrc", "movie", "https://cinesrc.st/embed/movie/550?autoplay=true&controls=false", STRICT],
  ["cinesrc", "tv", "https://cinesrc.st/embed/tv/1399?s=1&e=1&autoplay=true&controls=false", STRICT],
  ["vidlink", "movie", "https://vidlink.pro/movie/550?autoplay=true&title=false&poster=true&primaryColor=00D1FF&secondaryColor=1C2440&iconColor=FFFFFF", STRICT],
  ["vidlink", "tv", "https://vidlink.pro/tv/1399/1/1?autoplay=true&title=false&poster=true&primaryColor=00D1FF&secondaryColor=1C2440&iconColor=FFFFFF", STRICT],
  ["vidlink", "anime", "https://vidlink.pro/anime/21/1/sub?fallback=true&autoplay=true&title=false", STRICT],
  ["vidlink-open", "movie", "https://vidlink.pro/movie/550?autoplay=true&title=false", null],
  ["vidy", "movie", "https://www.vidy.st/movie/550?autoplay=true", null],
  ["vidy", "tv", "https://www.vidy.st/tv/1399/1/1?autoplay=true", null],
  ["vidy", "anime", "https://www.vidy.st/anime/21/1?autoplay=true", null]
].filter((c) => !ONLY || c[0].startsWith(ONLY));

const host = (src, sandbox) => `<!doctype html><html><body style="margin:0;background:#000">
<iframe id="f" src="${src}" ${sandbox ? `sandbox="${sandbox}"` : ""} allow="autoplay; encrypted-media; fullscreen" referrerpolicy="origin"
 style="border:0;width:1280px;height:720px"></iframe>
<script>window.__ev=[];window.__t0=performance.now();addEventListener("message",e=>{let d=e.data;if(typeof d==="string"){try{d=JSON.parse(d)}catch{}}
const type=d&&(d.type||d.event)||"";const ev=d&&d.data&&d.data.event||"";window.__ev.push({t:performance.now()-window.__t0,o:e.origin,type:String(type),ev:String(ev)})});</script></body></html>`;

const server = createServer((req, res) => {
  const u = new URL(req.url, "http://localhost");
  res.setHeader("content-type", "text/html");
  res.end(host(u.searchParams.get("src"), u.searchParams.get("sb")));
});
await new Promise((r) => server.listen(5179, r));

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const results = [];
for (const [id, kind, src, sandbox] of CASES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const r = { id, kind, sandbox: sandbox ? "strict" : "none", popups: 0, topNav: 0, intent: 0, adRequests: 0, adHosts: [], requests: 0, firstEvent: null, firstPlay: null, events: 0, error: null };
  const adHosts = new Set();
  ctx.on("page", (p) => { if (p !== page) { r.popups++; p.close().catch(() => {}); } });
  ctx.on("request", (q) => {
    r.requests++;
    const url = q.url();
    if (/^(intent|market):/i.test(url)) r.intent++;
    try { const h = new URL(url).hostname; if (isAd(h)) { r.adRequests++; adHosts.add(h); } } catch { /* data: */ }
  });
  page.on("framenavigated", (f) => { if (f === page.mainFrame() && !f.url().startsWith("http://localhost:5179")) r.topNav++; });
  // block real top navigation so the run continues and count it
  await page.route("**/*", (route) => {
    const q = route.request();
    if (q.isNavigationRequest() && q.frame() === page.mainFrame() && !q.url().startsWith("http://localhost:5179")) { r.topNav++; return route.abort(); }
    return route.continue();
  });
  try {
    await page.goto(`http://localhost:5179/?src=${encodeURIComponent(src)}${sandbox ? `&sb=${encodeURIComponent(sandbox)}` : ""}`);
    await page.waitForTimeout(6000);
    for (let i = 0; i < 2; i++) { await page.mouse.click(640, 360).catch(() => {}); await page.waitForTimeout(1500); }
    await page.waitForTimeout(Math.max(0, SECONDS * 1000 - 9000));
    const ev = await page.evaluate(() => window.__ev).catch(() => []);
    r.events = ev.length;
    r.firstEvent = ev[0] ? Math.round(ev[0].t) / 1000 : null;
    const play = ev.find((e) => /play|timeupdate/i.test(e.type + " " + e.ev));
    r.firstPlay = play ? Math.round(play.t) / 1000 : null;
    r.eventTypes = [...new Set(ev.map((e) => e.type + (e.ev ? ":" + e.ev : "")))].slice(0, 12);
    // Some players keep firing play events behind a "Please Disable Sandbox" wall, so read the frame text too.
    for (const f of page.frames()) {
      const t = await f.evaluate(() => document.body?.innerText ?? "").catch(() => "");
      if (/disable sandbox|sandbox detected|sandboxed/i.test(t)) r.refused = true;
    }
    if (r.refused) r.firstPlay = null;
    await page.screenshot({ path: `docs/screenshots/sources/${id}-${kind}.png` }).catch(() => {});
  } catch (e) { r.error = String(e.message ?? e).slice(0, 160); }
  r.adHosts = [...adHosts].slice(0, 15);
  results.push(r);
  console.log(JSON.stringify(r));
  await ctx.close();
}
await browser.close();
server.close();
mkdirSync(dirname(OUT), { recursive: true });

/**
 * Tier rule (docs/SOURCES.md): ad behaviour first.
 *   1 = plays in Panda's strict sandbox with no popup, redirect or app launch
 *   2 = plays only without a sandbox, but opened no popup, redirect or app launch
 *   3 = opens popups or redirects (consumed by the Android app's native shield)
 *   4 = heavy: more than 2 popups/redirects, or never started playing
 * The Panda backend reads `tiers` from this file on main (GET /panda/sources/ranking).
 */
export function tierOf(rows) {
  const played = rows.filter((r) => r.firstPlay !== null && r.firstPlay !== undefined);
  const strictPlay = played.some((r) => r.sandbox === "strict");
  const ref = strictPlay ? played.filter((r) => r.sandbox === "strict") : played;
  if (!ref.length) return 4;
  const noise = Math.max(...ref.map((r) => (r.popups ?? 0) + (r.topNav ?? 0) + (r.intent ?? 0)));
  if (noise > 2) return 4;
  if (noise > 0) return 3;
  return strictPlay ? 1 : 2;
}
const groups = {};
for (const r of results) (groups[r.id.replace(/-open$/, "")] ??= []).push(r);
const tiers = Object.fromEntries(Object.entries(groups).map(([id, rows]) => {
  const tier = tierOf(rows);
  const used = rows.filter((r) => r.firstPlay != null);
  const pick = used.length ? used : rows;
  return [id, { tier, popups: Math.max(...pick.map((r) => r.popups ?? 0)), navigations: Math.max(...pick.map((r) => (r.topNav ?? 0) + (r.intent ?? 0))), adRequests: Math.max(...pick.map((r) => r.adRequests ?? 0)), sandbox: used.some((r) => r.sandbox === "strict"), firstPlay: Math.min(...pick.map((r) => r.firstPlay ?? 99)) }];
}));
writeFileSync(OUT, JSON.stringify({ measuredAt: new Date().toISOString(), seconds: SECONDS, tiers, results }, null, 2) + "\n");
