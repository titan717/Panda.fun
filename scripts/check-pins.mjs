#!/usr/bin/env node
/**
 * Certificate pin gate (v1.2.7, SECURITY A127-6). Connects to every pinned host and fails when its live chain
 * (leaf, intermediates and the trusted root) contains none of the SPKI pins in network_security_config.xml, and
 * warns 120 days before the pin-set expires. Run in CI on every push; refresh the pins in the same release.
 */
import { readFileSync } from "node:fs";
import { connect } from "node:tls";
import { createHash, X509Certificate } from "node:crypto";

const xml = readFileSync(new URL("../android/app/src/main/res/xml/network_security_config.xml", import.meta.url), "utf8");
const pins = new Set([...xml.matchAll(/<pin digest="SHA-256">([^<]+)<\/pin>/g)].map((m) => m[1].trim()));
const hosts = [...xml.matchAll(/<domain[^>]*>([^<]+)<\/domain>/g)].map((m) => m[1].trim());
const expiry = xml.match(/pin-set expiration="([\d-]+)"/)?.[1];
if (!pins.size || !hosts.length || !expiry) { console.error("check-pins: no pins, hosts or expiration found"); process.exit(1); }

const spki = (raw) => createHash("sha256").update(new X509Certificate(raw).publicKey.export({ type: "spki", format: "der" })).digest("base64");
function chainOf(host) {
  return new Promise((resolve, reject) => {
    const s = connect({ host, port: 443, servername: host, timeout: 15_000 }, () => {
      const out = []; const seen = new Set();
      for (let c = s.getPeerCertificate(true); c && c.raw && !seen.has(c.fingerprint256); c = c.issuerCertificate) { seen.add(c.fingerprint256); out.push({ subject: c.subject?.CN ?? c.subject?.O ?? "?", pin: spki(c.raw) }); }
      s.end(); resolve(out);
    });
    s.on("error", reject); s.on("timeout", () => { s.destroy(); reject(new Error("timeout")); });
  });
}

let failed = false;
for (const host of hosts) {
  try {
    const chain = await chainOf(host);
    const hit = chain.find((c) => pins.has(c.pin));
    if (hit) console.log(`ok   ${host}: pinned key ${hit.pin} (${hit.subject})`);
    else { failed = true; console.error(`FAIL ${host}: no pinned key in chain\n${chain.map((c) => `       ${c.pin}  ${c.subject}`).join("\n")}`); }
  } catch (e) { failed = true; console.error(`FAIL ${host}: ${e.message}`); }
}
const days = (Date.parse(`${expiry}T00:00:00Z`) - Date.now()) / 86400_000;
if (days < 0) { console.error(`FAIL pin-set expired on ${expiry}; refresh it`); failed = true; }
else if (days < 120) console.warn(`warn pin-set expires in ${Math.round(days)} days (${expiry}); refresh it in the next release`);
process.exit(failed ? 1 : 0);
