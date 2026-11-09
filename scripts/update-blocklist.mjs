#!/usr/bin/env node
// Refreshes the Android ad shield host list (docs/AD_SHIELD.md, layer 4).
// Source: StevenBlack/hosts "unified hosts" (adware + malware), MIT licence,
// https://github.com/StevenBlack/hosts. Output keeps only host names, gzipped.
// On any network failure the committed copy is kept, so builds never break offline.
import { gzipSync, gunzipSync } from "node:zlib";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const SOURCE = "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts";
const OUT = "android/app/src/main/assets/shield/hosts.txt.gz";
// Provider ad/click hosts Panda observed in instrumented playback (2026-11-08). Always included.
const OBSERVED = ["adexchangerapid.com", "usrpubtrk.com", "roadster24.com", "offer.alibaba.com"];
// Never blocked, whatever the list says (the app, its API and the two playback providers).
const NEVER = /(^|\.)(appassets\.androidplatform\.net|apikinoma\.vercel\.app|cinesrc\.st|vidy\.st|vidlink\.pro|themoviedb\.org|tmdb\.org|youtube\.com|youtube-nocookie\.com|ytimg\.com|googlevideo\.com|gstatic\.com|github\.com|githubusercontent\.com)$/;

export function parseHosts(text) {
  const out = new Set();
  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    const host = (parts.length >= 2 && /^(0\.0\.0\.0|127\.0\.0\.1)$/.test(parts[0]) ? parts[1] : parts[0]).toLowerCase();
    if (!host.includes(".") || host === "0.0.0.0" || /^[\d.]+$/.test(host) || NEVER.test(host)) continue;
    out.add(host);
  }
  for (const h of OBSERVED) out.add(h);
  return [...out].sort();
}

async function main() {
  let hosts;
  try {
    const res = await fetch(SOURCE, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    hosts = parseHosts(await res.text());
    if (hosts.length < 10000) throw new Error(`only ${hosts.length} hosts, refusing to shrink the list`);
  } catch (e) {
    if (existsSync(OUT)) {
      const kept = gunzipSync(readFileSync(OUT)).toString().split("\n").filter(Boolean).length;
      console.warn(`[blocklist] refresh failed (${e.message}); keeping committed list with ${kept} hosts`);
      return;
    }
    throw e;
  }
  mkdirSync(dirname(OUT), { recursive: true });
  const header = `# Panda.fun ad shield host list. Generated ${new Date().toISOString().slice(0, 10)} from ${SOURCE} (MIT, (c) Steven Black) + Panda observed hosts.\n`;
  writeFileSync(OUT, gzipSync(header + hosts.join("\n") + "\n", { level: 9 }));
  console.log(`[blocklist] wrote ${hosts.length} hosts to ${OUT}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
