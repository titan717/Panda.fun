import type { MediaType, PandaItem, TitleDetails } from "../types";
import { canonicalGenres } from "../reco/genres";

/**
 * Content features for Panda Intelligence (docs/RECOMMENDATIONS.md §"On-device learning").
 *
 * Every title becomes a sparse vector in a fixed hashed space (feature hashing, D = 2^14). The vocabulary is open —
 * a new director or language needs no retraining or schema change — and the vector is cheap enough to compute on a
 * low-end Android TV in microseconds. Namespaces:
 *   g:<genre>            canonical genre                         weight 1
 *   gg:<a>|<b>           genre pair (captures "dark comedy")     weight 0.5
 *   t:<type>             movie / tv                              weight 0.6
 *   l:<lang>             original language                       weight 0.8
 *   e:<decade>           release decade                          weight 0.5
 *   r:<bucket>           rating bucket (<6, 6–7, 7–8, 8+)        weight 0.4
 *   d:<id> / cr:<id>     director / creator (when details known) weight 1
 *   c:<id>               top-billed cast (first 5)               weight 0.45 each
 *   col:<id>             collection / franchise                  weight 1
 * The vector is L2-normalised, so titles with rich details are not "louder" than titles with only list data.
 */

export const DIM = 1 << 14;

/** What the learner knows about a title. List payloads give the basics; details add people and franchise. */
export interface TitleFeatures {
  id: string;
  type: MediaType;
  title: string;
  genres: string[];
  language: string | null;
  year: number | null;
  rating: number | null;
  directors?: number[];
  creators?: string[];
  cast?: number[];
  collection?: number | null;
  collectionName?: string | null;
  /** Names for explanations ("Because you like films by Denis Villeneuve"). id → name. */
  names?: Record<string, string>;
}

export interface SparseVec { idx: number[]; val: number[] }

/** FNV-1a, 32-bit. Deterministic across engines (no Math.random, no locale). */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export const slot = (key: string) => hash(key) & (DIM - 1);

const decade = (y: number | null) => (y ? `${Math.floor(y / 10) * 10}s` : null);
const ratingBucket = (r: number | null) => (r == null || r <= 0 ? null : r < 6 ? "lt6" : r < 7 ? "6-7" : r < 8 ? "7-8" : "8+");

export function yearOf(i: Pick<PandaItem, "year" | "releaseDate">): number | null {
  return i.year ?? (i.releaseDate ? new Date(i.releaseDate).getUTCFullYear() || null : null);
}

export function fromItem(i: PandaItem): TitleFeatures {
  return { id: i.id, type: i.type, title: i.title, genres: canonicalGenres(i.genres), language: i.language, year: yearOf(i), rating: i.rating };
}

export function fromDetails(d: TitleDetails): TitleFeatures {
  const directorCrew = (d.crew ?? []).filter((c) => /^(director)$/i.test(c.job)).slice(0, 3);
  const names: Record<string, string> = {};
  for (const c of directorCrew) names[`d:${c.id}`] = c.name;
  const cast = (d.cast ?? []).slice(0, 5);
  for (const c of cast) names[`c:${c.id}`] = c.name;
  if (d.collection) names[`col:${d.collection.id}`] = d.collection.name;
  return {
    ...fromItem(d),
    language: d.originalLanguage ?? d.language,
    directors: directorCrew.map((c) => c.id),
    creators: (d.creators ?? []).slice(0, 3),
    cast: cast.map((c) => c.id),
    collection: d.collection?.id ?? null,
    collectionName: d.collection?.name ?? null,
    names
  };
}

/** Merge what is known: details win, list data fills gaps. */
export function mergeFeatures(a: TitleFeatures | undefined, b: TitleFeatures): TitleFeatures {
  if (!a) return b;
  return {
    ...a, ...b,
    directors: b.directors ?? a.directors, creators: b.creators ?? a.creators, cast: b.cast ?? a.cast,
    collection: b.collection !== undefined ? b.collection : a.collection,
    collectionName: b.collectionName ?? a.collectionName,
    names: { ...(a.names ?? {}), ...(b.names ?? {}) }
  };
}

/** The named feature keys of a title with their raw weights (before hashing) — also used by explanations. */
export function featureKeys(f: TitleFeatures): [string, number][] {
  const out: [string, number][] = [];
  const g = [...f.genres].sort();
  for (const x of g) out.push([`g:${x}`, 1]);
  for (let a = 0; a < g.length; a++) for (let b = a + 1; b < g.length && b < 4; b++) out.push([`gg:${g[a]}|${g[b]}`, 0.5]);
  out.push([`t:${f.type}`, 0.6]);
  if (f.language) out.push([`l:${f.language}`, 0.8]);
  const e = decade(f.year); if (e) out.push([`e:${e}`, 0.5]);
  const r = ratingBucket(f.rating); if (r) out.push([`r:${r}`, 0.4]);
  for (const d of f.directors ?? []) out.push([`d:${d}`, 1]);
  for (const c of f.creators ?? []) out.push([`cr:${c.toLowerCase()}`, 1]);
  for (const c of f.cast ?? []) out.push([`c:${c}`, 0.45]);
  if (f.collection) out.push([`col:${f.collection}`, 1]);
  return out;
}

export function vectorize(f: TitleFeatures): SparseVec {
  const acc = new Map<number, number>();
  for (const [k, w] of featureKeys(f)) { const s = slot(k); acc.set(s, (acc.get(s) ?? 0) + w); }
  const norm = Math.sqrt([...acc.values()].reduce((a, v) => a + v * v, 0)) || 1;
  const idx = [...acc.keys()].sort((a, b) => a - b);
  return { idx, val: idx.map((i) => acc.get(i)! / norm) };
}

export function dot(v: SparseVec, w: ArrayLike<number>): number {
  let s = 0;
  for (let k = 0; k < v.idx.length; k++) s += v.val[k]! * (w[v.idx[k]!] ?? 0);
  return s;
}

/** Cosine of a sparse unit vector with a dense vector (whose norm is passed in to avoid recomputing it). */
export function cosine(v: SparseVec, w: ArrayLike<number>, wNorm: number): number {
  return wNorm > 1e-9 ? dot(v, w) / wNorm : 0;
}

export function norm(w: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < w.length; i++) s += w[i]! * w[i]!;
  return Math.sqrt(s);
}

/** Cosine similarity of two titles' feature vectors ("More like this", franchise neighbours). */
export function titleSimilarity(a: SparseVec, b: SparseVec): number {
  let i = 0, j = 0, s = 0;
  while (i < a.idx.length && j < b.idx.length) {
    const x = a.idx[i]!, y = b.idx[j]!;
    if (x === y) { s += a.val[i]! * b.val[j]!; i++; j++; } else if (x < y) i++; else j++;
  }
  return s;
}
