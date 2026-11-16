import { describe, expect, it } from "vitest";
import raw from "./fixtures/intel-catalog.json";
import { buildModel } from "../lib/reco/model";
import { generateCandidates, rankCandidates } from "../lib/reco/engine";
import { emptyState, rememberFeatures } from "../lib/intel/learner";
import { ingest } from "../lib/intel/ingest";
import { rerank } from "../lib/intel/runtime";
import { fromItem, yearOf, type TitleFeatures } from "../lib/intel/features";
import { summarise, type MethodResult } from "../lib/intel/evaluate";
import { canonicalGenres } from "../lib/reco/genres";
import type { HistoryEntry } from "../lib/store";
import type { PandaItem } from "../lib/types";

/**
 * Offline comparison: v1.4.0 engine vs v1.5.0 engine + on-device model, on synthetic users over a captured
 * catalogue snapshot (src/test/fixtures/intel-catalog.json, 685 titles from /panda/discover and /panda/trending).
 * Synthetic users are NOT real viewers — see docs/RECOMMENDATIONS.md §Evaluation for what this does and does not show.
 * Run with EVAL_WRITE=1 to refresh docs/eval/intel-eval.json.
 */
type RawItem = { id: string; tmdbId: number; type: "movie" | "tv"; title: string; year: number | null; rating: number | null; poster: string | null; genres: string[]; language: string | null; releaseDate: string | null; originalLanguage?: string | null; directors?: { id: number; name: string }[]; creators?: string[]; cast?: { id: number; name: string }[]; collection?: { id: number; name: string } | null; similar?: string[] };
const R = raw as unknown as { lists: Record<string, string[]>; items: RawItem[] };
const NOW = Date.UTC(2026, 10, 15);
const DAY = 24 * 3600_000;
const items: PandaItem[] = R.items.map((i) => ({ id: i.id, tmdbId: i.tmdbId, type: i.type, title: i.title, year: i.year, rating: i.rating, poster: i.poster, posterLarge: null, backdrop: null, backdropLarge: null, overview: null, genres: i.genres, language: i.language, releaseDate: i.releaseDate }));
const byId = new Map(items.map((i) => [i.id, i]));
const rawById = new Map(R.items.map((i) => [i.id, i]));
const released = items.filter((i) => i.poster && (!i.releaseDate || Date.parse(i.releaseDate) <= NOW));
const trending = [...(R.lists["/trending?type=all&window=day"] ?? []), ...(R.lists["/trending?type=all&window=week"] ?? [])].map((id) => byId.get(id)).filter((x): x is PandaItem => Boolean(x));
const popular = new Set(trending.map((i) => i.id));

function details(id: string): TitleFeatures {
  const r = rawById.get(id)!;
  const names: Record<string, string> = {};
  for (const d of r.directors ?? []) names[`d:${d.id}`] = d.name;
  return { ...fromItem(byId.get(id)!), language: r.originalLanguage ?? r.language, directors: r.directors?.map((d) => d.id), creators: r.creators, cast: r.cast?.map((c) => c.id), collection: r.collection?.id ?? null, names };
}

function rng(seed: number) { let a = seed; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

type Kind = "genre" | "language" | "auteur" | "franchise" | "mixed";
interface User { kind: Kind; u: (i: PandaItem) => number }

const directorsWith = (n: number) => { const c = new Map<number, number>(); for (const i of R.items) for (const d of i.directors ?? []) c.set(d.id, (c.get(d.id) ?? 0) + 1); return [...c].filter(([, v]) => v >= n).map(([k]) => k).sort((a, b) => a - b); };
const collectionsWith = (n: number) => { const c = new Map<number, number>(); for (const i of R.items) if (i.collection) c.set(i.collection.id, (c.get(i.collection.id) ?? 0) + 1); return [...c].filter(([, v]) => v >= n).map(([k]) => k).sort((a, b) => a - b); };
const GENRES = ["Action", "Comedy", "Drama", "Horror", "Thriller", "Romance", "Science Fiction", "Animation", "Crime", "Fantasy", "Family", "Mystery"];
const LANGS = ["hi", "ko", "ja", "ta", "te", "ml", "fr", "es"];

function makeUser(kind: Kind, seed: number): User {
  const r = rng(seed);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)]!;
  const G = new Set([pick(GENRES), pick(GENRES)]);
  const L = pick(LANGS);
  const D = new Set([pick(directorsWith(3)), pick(directorsWith(2))]);
  const C = new Set([pick(collectionsWith(3)), pick(collectionsWith(2))]);
  const E = pick([1990, 2000, 2010, 2020]);
  const w = { genre: 1, language: kind === "language" || kind === "mixed" ? 1.6 : 0, director: kind === "auteur" || kind === "mixed" ? 2.2 : 0, franchise: kind === "franchise" || kind === "mixed" ? 2.4 : 0, era: kind === "mixed" ? 0.6 : 0.2 };
  return {
    kind,
    u: (i) => {
      const x = rawById.get(i.id)!;
      const g = canonicalGenres(i.genres).filter((z) => G.has(z)).length;
      const y = yearOf(i) ?? 0;
      return w.genre * Math.min(g, 1.5) + w.language * ((x.originalLanguage ?? i.language) === L ? 1 : 0) + w.director * ((x.directors ?? []).some((d) => D.has(d.id)) ? 1 : 0)
        + w.franchise * (x.collection && C.has(x.collection.id) ? 1 : 0) + w.era * (Math.floor(y / 10) * 10 === E ? 1 : 0) + 0.25 * (((i.rating ?? 6) - 6) / 2) + 0.35 * r();
    }
  };
}

interface Case { user: User; train: PandaItem[]; test: Set<string> }

function makeCases(perKind = 12): Case[] {
  const out: Case[] = [];
  let seed = 1;
  for (const kind of ["genre", "language", "auteur", "franchise", "mixed"] as Kind[]) for (let n = 0; n < perKind; n++) {
    const user = makeUser(kind, seed++ * 7919);
    const liked = [...released].map((i) => [i, user.u(i)] as const).sort((a, b) => b[1] - a[1] || a[0].id.localeCompare(b[0].id)).slice(0, 15).map(([i]) => i);
    const r = rng(seed * 31);
    const shuffled = liked.map((i) => [i, r()] as const).sort((a, b) => a[1] - b[1]).map(([i]) => i);
    out.push({ user, train: shuffled.slice(0, 10), test: new Set(shuffled.slice(10).map((i) => i.id)) });
  }
  return out;
}

function rank(c: Case, method: "popularity" | "engine" | "intel", candidateDetails: boolean): PandaItem[] {
  if (method === "popularity") return [...new Map([...trending, ...[...released].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))].map((i) => [i.id, i])).values()].filter((i) => !c.train.some((t) => t.id === i.id));
  const history: Record<string, HistoryEntry> = Object.fromEntries(c.train.map((item, n) => [item.id, { item, position: 100, duration: 100, completed: true, updatedAt: NOW - (c.train.length - n) * DAY } as HistoryEntry]));
  const model = buildModel({ taste: null, history, watchlist: [], ratings: {} });
  const similar = model.seeds.slice(0, 4).map((seed) => ({ seed, items: (rawById.get(seed.item.id)?.similar ?? []).map((id) => byId.get(id)).filter((x): x is PandaItem => Boolean(x)) }));
  const cands = generateCandidates({ similar, trending, rails: [{ id: "catalogue", items: released }] });
  if (method === "engine") return rankCandidates(cands, model, { suppressed: new Set(), now: NOW }).map((s) => s.c.item);
  const st = emptyState("eval", NOW - 30 * DAY);
  // watched titles: details were opened before playing, so people and franchise are known
  for (const t of c.train) rememberFeatures(st, details(t.id), 0);
  // candidates: with details (upper bound, e.g. after idle enrichment) or list data only (cold, realistic)
  for (const i of released) if (!st.features[i.id]) rememberFeatures(st, candidateDetails ? details(i.id) : fromItem(i), 0);
  ingest(st, { history, ratings: {}, watchlist: [] }, NOW);
  return rankCandidates(cands, model, { suppressed: new Set(), now: NOW, rerank: (l) => rerank(l, st, NOW) }).map((s) => s.c.item);
}

const fmt = (m: MethodResult): MethodResult => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Math.round(v * 1000) / 1000])) as unknown as MethodResult;
// the suite runs under Node; the app's tsconfig has no Node types, so only what is used is declared here
declare const process: { env: Record<string, string | undefined>; cwd(): string };

describe("v1.5.0 offline evaluation (synthetic users — not real-world accuracy)", () => {
  const cases = makeCases();
  const run = (method: "popularity" | "engine" | "intel", cd: boolean, filter?: Kind) => {
    const cs = cases.filter((c) => !filter || c.user.kind === filter);
    return summarise(cs.map((c) => rank(c, method, cd)), cs.map((c) => c.test), popular, released.length);
  };
  const report = {
    note: "Synthetic users over a captured catalogue snapshot; compares ranking methods on identical data. Not real-world accuracy.",
    users: cases.length, catalogue: released.length, k: 10,
    all: { popularity: fmt(run("popularity", false)), engine: fmt(run("engine", false)), intelListOnly: fmt(run("intel", false)), intelWithDetails: fmt(run("intel", true)) },
    byKind: Object.fromEntries((["genre", "language", "auteur", "franchise", "mixed"] as Kind[]).map((k) => [k, { engine: fmt(run("engine", false, k)), intelListOnly: fmt(run("intel", false, k)), intelWithDetails: fmt(run("intel", true, k)) }]))
  };
  it("writes docs/eval/intel-eval.json when EVAL_WRITE=1", async () => {
    if (!process.env.EVAL_WRITE) return;
    const fs = (await import(/* @vite-ignore */ ["node", "fs"].join(":"))) as { writeFileSync(p: string, d: string): void };
    fs.writeFileSync(`${process.cwd()}/docs/eval/intel-eval.json`, JSON.stringify(report, null, 2) + "\n");
  });

  it("the on-device model does not rank worse than the v1.4.0 engine overall", () => {
    expect(report.all.intelListOnly.ndcg).toBeGreaterThanOrEqual(report.all.engine.ndcg);
    expect(report.all.intelWithDetails.ndcg).toBeGreaterThanOrEqual(report.all.engine.ndcg);
  });
  it("both personal methods beat popularity", () => {
    expect(report.all.engine.ndcg).toBeGreaterThan(report.all.popularity.ndcg);
  });
  it("prints the report", () => {
    console.log(JSON.stringify(report, null, 1));
    expect(report.users).toBe(60);
  });
});
