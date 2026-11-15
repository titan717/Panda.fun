import type { PandaItem } from "../types";
import { canonicalGenres } from "./genres";
import type { PreferenceModel } from "./model";

/**
 * v1.4.0 recommendation engine — four stages, all on the device:
 *   1. candidate generation  (similar-title lists of the profile's seeds, trending, popular, home rails, genre lists)
 *   2. filtering             (finished, in progress, disliked, hidden, unreleased, no artwork, kids rules, and titles
 *                             whose playback failed on every provider on this platform — temporary suppression)
 *   3. scoring               (a transparent weighted sum; every part is kept for the explanation and diagnostics)
 *   4. diversification       (maximal marginal relevance, so a row is not ten copies of one idea)
 * It is a deterministic weighted model, not "AI": same inputs, same rows (docs/RECOMMENDATIONS.md).
 */

export type CandidateOrigin = "similar" | "trending" | "popular" | "rail" | "genre" | "new";

export interface Candidate {
  item: PandaItem;
  origins: Set<CandidateOrigin>;
  /** Seeds that list this title as similar, with the title's position in that seed's list. */
  similar: { seedId: string; seedTitle: string; why: PreferenceModel["seeds"][number]["why"]; weight: number; rank: number }[];
  /** Best (lowest) position in a trending / popular list. */
  trendRank: number | null;
}

export interface CandidateInput {
  /** Per seed: the "More Like This" list of its details payload. */
  similar: { seed: PreferenceModel["seeds"][number]; items: readonly PandaItem[] }[];
  trending?: readonly PandaItem[];
  popular?: readonly PandaItem[];
  rails?: readonly { id: string; items: readonly PandaItem[] }[];
  genre?: readonly PandaItem[];
  recent?: readonly PandaItem[];
}

export function generateCandidates(inp: CandidateInput): Map<string, Candidate> {
  const out = new Map<string, Candidate>();
  const get = (i: PandaItem) => {
    let c = out.get(i.id);
    if (!c) { c = { item: i, origins: new Set(), similar: [], trendRank: null }; out.set(i.id, c); }
    return c;
  };
  for (const s of inp.similar) s.items.forEach((i, rank) => {
    const c = get(i);
    c.origins.add("similar");
    if (!c.similar.some((x) => x.seedId === s.seed.item.id)) c.similar.push({ seedId: s.seed.item.id, seedTitle: s.seed.item.title, why: s.seed.why, weight: s.seed.weight, rank });
  });
  const trend = (list: readonly PandaItem[] | undefined, o: CandidateOrigin) => list?.forEach((i, rank) => {
    const c = get(i); c.origins.add(o);
    c.trendRank = c.trendRank === null ? rank : Math.min(c.trendRank, rank);
  });
  trend(inp.trending, "trending");
  trend(inp.popular, "popular");
  for (const r of inp.rails ?? []) for (const i of r.items) get(i).origins.add("rail");
  for (const i of inp.genre ?? []) get(i).origins.add("genre");
  for (const i of inp.recent ?? []) get(i).origins.add("new");
  return out;
}

export interface FilterContext {
  model: PreferenceModel;
  /** "type:tmdbId" keys suppressed by playback health on this platform. */
  suppressed: Set<string>;
  /** Kids profiles: only kid-safe titles. */
  allow?: (i: PandaItem) => boolean;
  now?: number;
}

export type FilterReason = "excluded" | "in-progress" | "saved" | "suppressed" | "unreleased" | "no-artwork" | "not-allowed";

export function filterReason(c: Candidate, ctx: FilterContext, o: { keepSaved?: boolean } = {}): FilterReason | null {
  const i = c.item;
  if (ctx.model.exclude.has(i.id)) return "excluded";
  if (ctx.model.inProgress.has(i.id)) return "in-progress";
  if (!o.keepSaved && ctx.model.saved.has(i.id)) return "saved";
  if (ctx.suppressed.has(`${i.type}:${i.tmdbId}`)) return "suppressed";
  const now = ctx.now ?? Date.now();
  if (i.releaseDate && Date.parse(i.releaseDate) > now) return "unreleased";
  if (!i.poster) return "no-artwork";
  if (ctx.allow && !ctx.allow(i)) return "not-allowed";
  return null;
}

/** Scoring weights (docs/RECOMMENDATIONS.md). */
export const SCORE_WEIGHTS = { genre: 1.0, similar: 1.3, type: 0.5, quality: 0.45, popularity: 0.35, freshness: 0.3, language: 0.25 } as const;
export type ScorePart = keyof typeof SCORE_WEIGHTS;

export interface Scored { c: Candidate; score: number; parts: Record<ScorePart, number>; genres: string[]; reason: Reason | null }

export type Reason =
  | { kind: "similar"; text: string; seedId: string }
  | { kind: "genre"; text: string; genre: string }
  | { kind: "trending"; text: string }
  | { kind: "quality"; text: string }
  | { kind: "new"; text: string };

const clip = (x: number, a = -1, b = 1) => Math.max(a, Math.min(b, x));

export function scoreCandidate(c: Candidate, m: PreferenceModel, now = Date.now()): Scored {
  const i = c.item;
  const genres = canonicalGenres(i.genres);
  const aff = genres.map((g) => m.genres.get(g) ?? 0);
  const genre = aff.length ? clip(0.6 * Math.max(...aff) + 0.4 * (aff.reduce((a, b) => a + b, 0) / aff.length)) : 0;
  const similar = clip(c.similar.reduce((a, s) => a + s.weight * (1 - Math.min(s.rank, 39) / 40), 0) / 2, 0, 1);
  const type = (m.type[i.type] ?? 0.5) - 0.5;
  const quality = i.rating == null ? 0 : clip((i.rating - 6.5) / 2.5);
  const pop = c.trendRank === null ? 0 : 1 - Math.min(c.trendRank, 29) / 30;
  // "popular" leans into what's hot, "gems" away from it (quality carries the gems), "mix" is mildly positive
  const popularity = m.popularity === "popular" ? pop : m.popularity === "gems" ? -0.6 * pop : 0.4 * pop;
  const year = i.year ?? (i.releaseDate ? new Date(i.releaseDate).getUTCFullYear() : null);
  const age = year === null ? null : new Date(now).getUTCFullYear() - year;
  const freshness = age === null ? 0 : m.era === "new" ? clip(1 - age / 6, -0.5, 1) : m.era === "classic" ? clip((age - 10) / 15, -0.5, 1) : clip(0.3 - age / 40, -0.3, 0.3);
  const language = i.language ? clip((m.languages.get(i.language) ?? 0) * 2 - (m.languages.size && !m.languages.has(i.language) ? 0.2 : 0), -0.3, 1) : 0;
  const parts: Record<ScorePart, number> = { genre, similar, type, quality, popularity, freshness, language };
  const score = (Object.keys(parts) as ScorePart[]).reduce((a, k) => a + SCORE_WEIGHTS[k] * parts[k], 0);
  return { c, score, parts, genres, reason: explain(c, parts, genres, m) };
}

/**
 * The honest reason for a pick: the largest positive contribution that has a real, checkable cause.
 * Returns null when nothing stands out — then the UI shows no reason at all rather than a made-up one.
 */
export function explain(c: Candidate, parts: Record<ScorePart, number>, genres: string[], m: PreferenceModel): Reason | null {
  const contrib = (Object.keys(parts) as ScorePart[]).map((k) => [k, SCORE_WEIGHTS[k] * parts[k]] as const).filter(([, v]) => v > 0.12).sort((a, b) => b[1] - a[1]);
  for (const [k] of contrib) {
    if (k === "similar" && c.similar.length) {
      const s = [...c.similar].sort((a, b) => b.weight * (1 - b.rank / 40) - a.weight * (1 - a.rank / 40))[0]!;
      const verb = s.why === "loved" ? "you loved" : s.why === "saved" ? "you saved" : s.why === "more" ? "you asked for more like" : "you watched";
      return { kind: "similar", text: `Because ${verb} ${s.seedTitle}`, seedId: s.seedId };
    }
    if (k === "genre") {
      const g = genres.filter((x) => (m.genres.get(x) ?? 0) > 0).sort((a, b) => (m.genres.get(b) ?? 0) - (m.genres.get(a) ?? 0))[0];
      if (!g) continue;
      const w = m.genreWhy.get(g);
      const text = w === "picked" ? `You picked ${g}` : w === "rated" ? `You rate ${g} highly` : w === "saved" ? `You save a lot of ${g}` : `You watch a lot of ${g}`;
      return { kind: "genre", text, genre: g };
    }
    if (k === "popularity" && c.origins.has("trending")) return { kind: "trending", text: "Trending now" };
    if (k === "quality" && c.item.rating != null && c.item.rating >= 7.5) return { kind: "quality", text: `Rated ${c.item.rating.toFixed(1)}` };
    if (k === "freshness" && c.item.year && m.era === "new") return { kind: "new", text: `New in ${c.item.year}` };
  }
  return null;
}

/** Similarity of two titles for diversification: shared genres, same type, same seed. */
export function similarity(a: Scored, b: Scored): number {
  const A = new Set(a.genres), B = new Set(b.genres);
  const inter = [...A].filter((g) => B.has(g)).length;
  const union = new Set([...A, ...B]).size || 1;
  const seedA = new Set(a.c.similar.map((s) => s.seedId));
  const sharedSeed = b.c.similar.some((s) => seedA.has(s.seedId)) ? 1 : 0;
  return 0.6 * (inter / union) + 0.25 * (a.c.item.type === b.c.item.type ? 1 : 0) + 0.15 * sharedSeed;
}

/** Maximal marginal relevance: λ·relevance − (1−λ)·max similarity to what is already picked. Deterministic. */
export function mmr(list: readonly Scored[], k: number, lambda = 0.72, pool = 80): Scored[] {
  const cand = [...list].sort((a, b) => b.score - a.score || a.c.item.id.localeCompare(b.c.item.id)).slice(0, pool);
  if (!cand.length) return [];
  const hi = cand[0]!.score, lo = cand[cand.length - 1]!.score;
  const rel = (s: Scored) => (hi === lo ? 1 : (s.score - lo) / (hi - lo));
  const out: Scored[] = [];
  while (out.length < k && cand.length) {
    let best = 0, bestV = -Infinity;
    cand.forEach((s, n) => {
      const sim = out.length ? Math.max(...out.map((o) => similarity(s, o))) : 0;
      const v = lambda * rel(s) - (1 - lambda) * sim;
      if (v > bestV) { bestV = v; best = n; }
    });
    out.push(cand.splice(best, 1)[0]!);
  }
  return out;
}

export interface RankOptions { suppressed: Set<string>; allow?: (i: PandaItem) => boolean; now?: number; keepSaved?: boolean }

/** Stages 2 + 3: filter and score every candidate, highest first. */
export function rankCandidates(cands: Map<string, Candidate>, m: PreferenceModel, o: RankOptions): Scored[] {
  const ctx: FilterContext = { model: m, suppressed: o.suppressed, allow: o.allow, now: o.now };
  return [...cands.values()].filter((c) => filterReason(c, ctx, { keepSaved: o.keepSaved }) === null).map((c) => scoreCandidate(c, m, o.now)).sort((a, b) => b.score - a.score || a.c.item.id.localeCompare(b.c.item.id));
}
