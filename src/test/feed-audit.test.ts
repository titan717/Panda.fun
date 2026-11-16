// @vitest-environment node
import { describe, it } from "vitest";
import { CATEGORIES, categoryPaths } from "../lib/feed/catalog";
import { DEFAULT_API_BASE } from "../lib/api";

/**
 * Live catalogue audit of every Home feed category (opt-in: FEED_AUDIT=1, it calls the public Panda API).
 * For each rail: how many titles page 1 returns, how many pass its rating floor, the mean rating, the share of
 * titles with artwork, and the highest overlap with any other rail (Jaccard on title ids). Writes
 * docs/eval/feed-audit.json. Rails with fewer than 12 usable titles or ≥ 0.6 overlap are flagged.
 */
declare const process: { env: Record<string, string | undefined>; cwd(): string };
type Item = { id: string; rating: number | null; poster: string | null };

describe("feed category audit (live API, opt-in)", () => {
  it("audits every category", { timeout: 300_000 }, async () => {
    if (!process.env.FEED_AUDIT) return;
    const results = new Map<string, Item[]>();
    const errors: Record<string, string> = {};
    const queue = [...CATEGORIES];
    await Promise.all(Array.from({ length: 4 }, async () => {
      for (;;) {
        const c = queue.shift();
        if (!c) return;
        try {
          const items: Item[] = [];
          for (const path of categoryPaths(c)) {
            const r = await fetch(`${DEFAULT_API_BASE}${path}`, { headers: { Accept: "application/json" } });
            const b = (await r.json()) as { success: boolean; data?: { results?: Item[] } };
            items.push(...(b.data?.results ?? []));
            if (!b.success) errors[c.id] = `HTTP ${r.status}`;
          }
          results.set(c.id, items);
        } catch (e) { errors[c.id] = String(e); results.set(c.id, []); }
      }
    }));
    const rows = CATEGORIES.map((c) => {
      const all = results.get(c.id) ?? [];
      const min = c.source.kind === "discover" ? c.source.minRating : undefined;
      const usable = all.filter((i) => i.poster && (min === undefined || (i.rating ?? 0) >= min));
      const ids = new Set(usable.map((i) => i.id));
      let maxOverlap = 0, with_ = "";
      for (const o of CATEGORIES) {
        if (o.id === c.id) continue;
        const other = new Set((results.get(o.id) ?? []).map((i) => i.id));
        const inter = [...ids].filter((x) => other.has(x)).length;
        const j = inter / Math.max(1, new Set([...ids, ...other]).size);
        if (j > maxOverlap) { maxOverlap = j; with_ = o.id; }
      }
      const rated = usable.filter((i) => i.rating);
      return {
        id: c.id, title: c.title, family: c.family, returned: all.length, usable: usable.length,
        meanRating: rated.length ? +(rated.reduce((a, i) => a + (i.rating ?? 0), 0) / rated.length).toFixed(2) : null,
        maxOverlap: +maxOverlap.toFixed(2), overlapWith: with_,
        flag: usable.length < 12 ? "thin" : maxOverlap >= 0.6 ? "duplicate" : null,
        error: errors[c.id] ?? null
      };
    });
    const fs = (await import(/* @vite-ignore */ ["node", "fs"].join(":"))) as { writeFileSync(p: string, d: string): void };
    const report = { at: new Date().toISOString(), api: DEFAULT_API_BASE, categories: rows.length, flagged: rows.filter((r) => r.flag).map((r) => `${r.id}: ${r.flag} (${r.usable} usable, overlap ${r.maxOverlap} with ${r.overlapWith})`), rows };
    fs.writeFileSync(`${process.cwd()}/docs/eval/feed-audit.json`, JSON.stringify(report, null, 2) + "\n");
    console.log(report.flagged.join("\n"));
  });
});
