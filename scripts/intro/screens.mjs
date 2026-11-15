#!/usr/bin/env node
/**
 * Visual check for the IntroBumper port (v1.4.2). Renders the ported frame (dev harness) and the approved original
 * (`?render`, window.__render(t)) at the same times and sizes, writes PNGs and a per-pixel difference report.
 *
 *   npx vite --port 5179 --strictPort &   # dev server for the harness
 *   node scripts/intro/screens.mjs /path/to/panda-intro-canvas.html out-dir
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const original = process.argv[2];
const out = resolve(process.argv[3] ?? "docs/screenshots/v1.4.2");
const base = process.env.HARNESS ?? "http://127.0.0.1:5179";
const TIMES = [0.5, 1.6, 2.3, 3.0, 3.9, 3.8];
const SIZES = [{ name: "tv", width: 1920, height: 1080 }, { name: "phone", width: 390, height: 844 }];
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const report = [];
for (const s of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: 1 });
  const port = await ctx.newPage();
  await port.goto(`${base}/scripts/intro/bumper-render.html`);
  await port.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 });
  let orig = null;
  if (original) {
    orig = await ctx.newPage();
    await orig.goto(`${pathToFileURL(resolve(original)).href}?render`);
    await orig.waitForFunction(() => typeof window.__render === "function");
    await orig.waitForTimeout(500); // the inline logo decodes asynchronously
  }
  for (const t of TIMES) {
    const tag = t === 3.8 ? "final-frame" : `t${t.toFixed(1)}`;
    await port.evaluate((x) => window.__render(x), t);
    const a = await port.screenshot();
    writeFileSync(`${out}/port-${s.name}-${tag}.png`, a);
    if (orig) {
      await orig.evaluate((x) => window.__render(x), t);
      const b = await orig.screenshot();
      writeFileSync(`${out}/original-${s.name}-${tag}.png`, b);
      // difference measured in the browser so no image library is needed
      const diff = await port.evaluate(async ([pa, pb]) => {
        const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = src; });
        const [ia, ib] = await Promise.all([load(pa), load(pb)]);
        const c = document.createElement("canvas"); c.width = ia.width; c.height = ia.height;
        const x = c.getContext("2d"); x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, c.width, c.height).data;
        x.clearRect(0, 0, c.width, c.height); x.drawImage(ib, 0, 0); const db = x.getImageData(0, 0, c.width, c.height).data;
        let sum = 0, max = 0, over = 0;
        for (let i = 0; i < da.length; i += 4) {
          const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
          sum += d; if (d > max) max = d; if (d > 8) over++;
        }
        const n = da.length / 4;
        return { meanDiff: +(sum / n).toFixed(3), maxDiff: max, pxOver8: over, pct: +((over / n) * 100).toFixed(4) };
      }, [`data:image/png;base64,${a.toString("base64")}`, `data:image/png;base64,${b.toString("base64")}`]);
      report.push({ size: s.name, t, ...diff });
    }
  }
  await ctx.close();
}
await browser.close();
writeFileSync(`${out}/diff-report.json`, JSON.stringify(report, null, 2));
console.table(report);
