import { describe, expect, it } from "vitest";
import raw from "./fixtures/intel-catalog.json";
import { buildModel } from "../lib/reco/model";
import { generateCandidates, rankCandidates } from "../lib/reco/engine";
import { emptyState, rememberFeatures, type LearnerState } from "../lib/intel/learner";
import { ingest } from "../lib/intel/ingest";
import { rerank } from "../lib/intel/runtime";
import { fromItem } from "../lib/intel/features";
import { ndcgAtK, novelty } from "../lib/intel/evaluate";
import { canonicalGenres } from "../lib/reco/genres";
import type { HistoryEntry, Rating } from "../lib/store";
import type { PandaItem } from "../lib/types";

/**
 * v1.5.0 scenario evaluation (SYNTHETIC users over the captured catalogue snapshot — not real-world accuracy).
 * Each scenario compares the v1.4.0 engine with the engine + on-device model on identical data.
 * EVAL_WRITE=1 refreshes docs/eval/intel-scenarios.json.
 */
type RawItem = { id: string; tmdbId: number; type: "movie" | "tv"; title: string; year: number | null; rating: number | null; poster: string | null; genres: string[]; language: string | null; releaseDate: string | null };
const R = raw as unknown as { lists: Record<string, string[]>; items: RawItem[] };
const NOW = Date.UTC(2026, 10, 15);
const DAY = 86_400_000;
const items: PandaItem[] = R.items.map((i) => ({ ...i, posterLarge: null, backdrop: null, backdropLarge: null, overview: null } as PandaItem));
const byId = new Map(items.map((i) => [i.id, i]));
const released = items.filter((i) => i.poster && (!i.releaseDate || Date.parse(i.releaseDate) <= NOW));
const trending = [...(R.lists["/trending?type=all&window=day"] ?? []), ...(R.lists["/trending?type=all&window=week"] ?? [])].map((id) => byId.get(id)).filter((x): x is PandaItem => Boolean(x));
const popular = new Set(trending.map((i) => i.id));
const K = 10;
const has = (i: PandaItem, g: string) => canonicalGenres(i.genres).includes(g);
function rng(seed: number) { let a = seed; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const GENRES = ["Action", "Comedy", "Horror", "Romance", "Science Fiction", "Animation", "Crime", "Fantasy", "Mystery", "Thriller"];

interface Watch { item: PandaItem; at: number }
function rankFor(watch: Watch[], ratings: Record<string, Rating>, method: "engine" | "intel", state?: LearnerState) {
  const history: Record<string, HistoryEntry> = Object.fromEntries(watch.map((w) => [w.item.id, { item: w.item, position: 100, duration: 100, completed: true, updatedAt: w.at } as HistoryEntry]));
  const model = buildModel({ taste: null, history, watchlist: [], ratings });
  const cands = generateCandidates({ similar: [], trending, rails: [{ id: "catalogue", items: released }] });
  if (method === "engine") return { list: rankCandidates(cands, model, { suppressed: new Set(), now: NOW }).map((s) => s.c.item), ms: 0 };
  const st = state ?? emptyState("eval", NOW - 400 * DAY);
  for (const i of released) if (!st.features[i.id]) rememberFeatures(st, fromItem(i), 0);
  ingest(st, { history, ratings, watchlist: [] }, NOW);
  const t0 = performance.now();
  const list = rankCandidates(cands, model, { suppressed: new Set(), now: NOW, rerank: (l) => rerank(l, st, NOW) }).map((s) => s.c.item);
  return { list, ms: performance.now() - t0, state: st };
}
const share = (l: PandaItem[], f: (i: PandaItem) => boolean) => l.slice(0, K).filter(f).length / K;
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const r3 = (v: number) => Math.round(v * 1000) / 1000;
declare const process: { env: Record<string, string | undefined>; cwd(): string };

function pickGenres(seed: number): [string, string] {
  const r = rng(seed);
  const a = GENRES[Math.floor(r() * GENRES.length)]!;
  let b = a; while (b === a) b = GENRES[Math.floor(r() * GENRES.length)]!;
  return [a, b];
}
const pool = (g: string, not?: string) => released.filter((i) => has(i, g) && (!not || !has(i, not))).sort((x, y) => (y.rating ?? 0) - (x.rating ?? 0) || x.id.localeCompare(y.id));

const USERS = 12;
const report: Record<string, unknown> = { note: "Synthetic users over a captured catalogue snapshot (src/test/fixtures/intel-catalog.json). Compares methods on identical data; NOT real-world accuracy.", k: K, usersPerScenario: USERS };
const latency: number[] = [];

describe("v1.5.0 scenario evaluation (synthetic — not real-world accuracy)", () => {
  it("cold start: no history gives the engine's own order (no invented personalisation)", () => {
    const e = rankFor([], {}, "engine").list, m = rankFor([], {}, "intel");
    latency.push(m.ms);
    const same = e.slice(0, K).map((i) => i.id).join() === m.list.slice(0, K).map((i) => i.id).join();
    report.coldStart = { identicalTop10: same, popularShareTop10: r3(share(m.list, (i) => popular.has(i.id))) };
    expect(same).toBe(true);
  });

  it("sparse history (2 titles) and repeat rate", () => {
    const eng: number[] = [], intel: number[] = [], repeat: number[] = [];
    for (let u = 0; u < USERS; u++) {
      const [g] = pickGenres(u + 11);
      const watch = pool(g).slice(u % 5, (u % 5) + 2).map((item, n) => ({ item, at: NOW - (2 - n) * DAY }));
      const e = rankFor(watch, {}, "engine").list, m = rankFor(watch, {}, "intel");
      latency.push(m.ms);
      eng.push(share(e, (i) => has(i, g))); intel.push(share(m.list, (i) => has(i, g)));
      repeat.push(share(m.list, (i) => watch.some((w) => w.item.id === i.id)));
    }
    report.sparse = { genreShareTop10: { engine: r3(mean(eng)), intel: r3(mean(intel)) } };
    report.repeatRate = { intel: r3(mean(repeat)) };
    expect(mean(repeat)).toBe(0);
    expect(mean(intel)).toBeGreaterThanOrEqual(mean(eng) - 0.05);
  });

  it("changing interests: recent taste outweighs an old one", () => {
    const res = { engine: { recent: [] as number[], old: [] as number[], ndcg: [] as number[] }, intel: { recent: [] as number[], old: [] as number[], ndcg: [] as number[] } };
    for (let u = 0; u < USERS; u++) {
      const [a, b] = pickGenres(u + 101);
      const old = pool(a, b).slice(0, 8).map((item, n) => ({ item, at: NOW - (200 - n * 8) * DAY }));
      const recentAll = pool(b, a);
      const recent = recentAll.slice(0, 6).map((item, n) => ({ item, at: NOW - (10 - n) * DAY }));
      const relevant = new Set(recentAll.slice(6, 40).map((i) => i.id));
      for (const [k, method] of [["engine", "engine"], ["intel", "intel"]] as const) {
        const l = rankFor([...old, ...recent], {}, method).list;
        res[k].recent.push(share(l, (i) => has(i, b))); res[k].old.push(share(l, (i) => has(i, a) && !has(i, b))); res[k].ndcg.push(ndcgAtK(l, relevant, K));
      }
    }
    const sum = (x: { recent: number[]; old: number[]; ndcg: number[] }) => ({ recentGenreShare: r3(mean(x.recent)), oldGenreShare: r3(mean(x.old)), ndcgRecent: r3(mean(x.ndcg)) });
    report.changingInterests = { engine: sum(res.engine), intel: sum(res.intel) };
    expect(mean(res.intel.recent)).toBeGreaterThanOrEqual(mean(res.intel.old));
  });

  it("negative feedback: disliked genres sink", () => {
    const eng: number[] = [], intel: number[] = [];
    for (let u = 0; u < USERS; u++) {
      const [g, bad] = pickGenres(u + 201);
      const liked = pool(g, bad).slice(0, 8).map((item, n) => ({ item, at: NOW - (20 - n) * DAY }));
      const disliked = pool(bad, g).slice(0, 4);
      const watch = [...liked, ...disliked.map((item, n) => ({ item, at: NOW - (5 - n) * DAY }))];
      const ratings = Object.fromEntries(disliked.map((i) => [i.id, "dislike" as Rating]));
      eng.push(share(rankFor(watch, ratings, "engine").list, (i) => has(i, bad) && !has(i, g)));
      intel.push(share(rankFor(watch, ratings, "intel").list, (i) => has(i, bad) && !has(i, g)));
    }
    report.negativeFeedback = { dislikedGenreShareTop10: { engine: r3(mean(eng)), intel: r3(mean(intel)) } };
    expect(mean(intel)).toBeLessThanOrEqual(mean(eng) + 0.02);
  });

  it("hidden gems: well-rated, less popular titles in the profile's genres", () => {
    const res = { engine: { ndcg: [] as number[], nov: [] as number[] }, intel: { ndcg: [] as number[], nov: [] as number[] } };
    for (let u = 0; u < USERS; u++) {
      const [g] = pickGenres(u + 301);
      const watch = pool(g).slice(0, 8).map((item, n) => ({ item, at: NOW - (10 - n) * DAY }));
      const relevant = new Set(released.filter((i) => has(i, g) && (i.rating ?? 0) >= 7.2 && !popular.has(i.id) && !watch.some((w) => w.item.id === i.id)).map((i) => i.id));
      for (const k of ["engine", "intel"] as const) { const l = rankFor(watch, {}, k).list; res[k].ndcg.push(ndcgAtK(l, relevant, K)); res[k].nov.push(novelty(l, popular, K)); }
    }
    report.hiddenGems = Object.fromEntries((["engine", "intel"] as const).map((k) => [k, { ndcg: r3(mean(res[k].ndcg)), novelty: r3(mean(res[k].nov)) }]));
    expect(mean(res.intel.ndcg)).toBeGreaterThanOrEqual(mean(res.engine.ndcg) - 0.05);
  });

  it("multi-profile: one profile's learning never changes another's ranking", () => {
    const [ga, gb] = pickGenres(401);
    const wa = pool(ga, gb).slice(0, 8).map((item, n) => ({ item, at: NOW - (10 - n) * DAY }));
    const wb = pool(gb, ga).slice(0, 8).map((item, n) => ({ item, at: NOW - (10 - n) * DAY }));
    const a1 = rankFor(wa, {}, "intel", emptyState("A", NOW - 400 * DAY)).list.slice(0, K).map((i) => i.id);
    rankFor(wb, {}, "intel", emptyState("B", NOW - 400 * DAY));
    const a2 = rankFor(wa, {}, "intel", emptyState("A", NOW - 400 * DAY)).list.slice(0, K).map((i) => i.id);
    report.multiProfile = { isolated: a1.join() === a2.join() };
    expect(a1).toEqual(a2);
  });

  it("latency of the on-device rerank over the candidate list", async () => {
    const s = [...latency].sort((a, b) => a - b);
    report.latencyMs = { note: "Node, full candidate list (~600 titles), includes engine ranking", median: r3(s[Math.floor(s.length / 2)] ?? 0), p90: r3(s[Math.floor(s.length * 0.9)] ?? 0), samples: s.length };
    if (process.env.EVAL_WRITE) {
      const fs = (await import(/* @vite-ignore */ ["node", "fs"].join(":"))) as { writeFileSync(p: string, d: string): void };
      fs.writeFileSync(`${process.cwd()}/docs/eval/intel-scenarios.json`, JSON.stringify(report, null, 2) + "\n");
    }
    console.log(JSON.stringify(report, null, 1));
    expect(s.length).toBeGreaterThan(0);
  });
});
