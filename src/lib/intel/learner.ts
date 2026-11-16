import { SCORE_WEIGHTS, type ScorePart } from "../reco/engine";
import {
  decay, label, LONG_HALF_LIFE_DAYS, SHORT_HALF_LIFE_DAYS, type Interaction, type InteractionKind
} from "./events";
import { cosine, DIM, dot, featureKeys, norm, slot, vectorize, type SparseVec, type TitleFeatures } from "./features";

/**
 * Panda Intelligence learner — a per-profile model trained on the device. Three parts (docs/RECOMMENDATIONS.md):
 *
 *  1. Content representation: hashed sparse title vectors (features.ts).
 *  2. Taste model: two exponentially decayed taste vectors in the same space — short-term (half-life 10 days,
 *     "what I am into this week") and long-term (half-life 1 year) — updated by every weighted interaction.
 *  3. Personal ranking model: an online logistic regression over
 *       dense features — the v1.4.0 engine's seven score parts, short/long taste similarity, franchise and novelty —
 *       plus the sparse content vector (per-feature personal weights: a director, a language, a genre pair).
 *     The dense weights start at the hand-tuned engine weights and are L2-regularised *toward* them, so a profile
 *     with no data ranks exactly like v1.4.0 and drifts away only as far as its own behaviour justifies.
 *     Trained with AdaGrad SGD on weighted interactions plus sampled negatives.
 *
 * Pure and deterministic: same interactions in the same order → identical weights (seeded sampling, no clock).
 */

export const DENSE_KEYS = [...(Object.keys(SCORE_WEIGHTS) as ScorePart[]), "tasteShort", "tasteLong", "franchise", "novelty"] as const;
export type DenseKey = (typeof DENSE_KEYS)[number];
export type DenseParts = Record<DenseKey, number>;

export const DENSE_PRIOR: DenseParts = { ...SCORE_WEIGHTS, tasteShort: 0.8, tasteLong: 0.6, franchise: 0.35, novelty: 0 };

export const LEARN = {
  /** AdaGrad base learning rates. */
  lrSparse: 0.35,
  lrDense: 0.05,
  /** L2 pull toward the prior (dense) and toward 0 (sparse), per update. */
  l2Dense: 0.02,
  l2Sparse: 0.002,
  /** Negatives sampled per positive from titles the profile saw but did not choose. */
  negatives: 3,
  negativeWeight: 0.15,
  /** Interactions kept in the visible Entertainment Memory log. */
  logMax: 500,
  /** Title feature records kept per profile. */
  featuresMax: 1500
} as const;

export interface CategoryStats { shown: number; opened: number; played: number; completed: number; hidden: number; at: number }

export interface LearnerState {
  schema: number;
  profileId: string;
  /** Sparse personal weights and their AdaGrad accumulators. */
  w: Float32Array;
  g2: Float32Array;
  dense: DenseParts;
  dg2: DenseParts;
  bias: number;
  shortT: Float32Array;
  shortAt: number;
  longT: Float32Array;
  longAt: number;
  /** Interactions applied (keys), so a replay never double-trains. */
  applied: Record<string, 1>;
  /** Visible log for Entertainment Memory. */
  log: Interaction[];
  /** Number of training examples applied (positives + negatives). */
  n: number;
  features: Record<string, TitleFeatures & { at: number }>;
  categories: Record<string, CategoryStats>;
  /** Taste DNA edits: feature key → +1 (more of this) / -1 (less of this). */
  overrides: Record<string, 1 | -1>;
  /** Interactions older than this are ignored (set by "Reset what Panda learned"). */
  resetAt: number;
  /** Titles removed from Entertainment Memory: never trained on again. */
  forgotten: Record<string, 1>;
  /** First time an undated signal (a rating, a save) was seen, so replays keep its original time. */
  stamps: Record<string, number>;
  /** Times a title was shown in a recommendation row (skip detection). */
  shown: Record<string, number>;
  updatedAt: number;
}

export const SCHEMA = 1;

/** A fresh model that keeps what is not learned (features, edits, reset point, forgotten titles, stamps). */
export function retrainBase(s: LearnerState): LearnerState {
  return { ...emptyState(s.profileId, s.updatedAt), features: s.features, overrides: s.overrides, resetAt: s.resetAt, forgotten: s.forgotten, stamps: s.stamps, shown: s.shown };
}

export function emptyState(profileId: string, now = 0): LearnerState {
  return {
    schema: SCHEMA, profileId,
    w: new Float32Array(DIM), g2: new Float32Array(DIM),
    dense: { ...DENSE_PRIOR }, dg2: Object.fromEntries(DENSE_KEYS.map((k) => [k, 0])) as DenseParts, bias: 0,
    shortT: new Float32Array(DIM), shortAt: now, longT: new Float32Array(DIM), longAt: now,
    applied: {}, log: [], n: 0, features: {}, categories: {}, overrides: {}, resetAt: 0, forgotten: {}, stamps: {}, shown: {}, updatedAt: now
  };
}

export const eventKey = (e: Interaction) => (e.kind === "episode" || e.kind === "open" || e.kind === "play" || e.kind === "skip" ? `${e.id}|${e.kind}|${e.at}` : `${e.id}|${e.kind}`);

const sigmoid = (z: number) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));

/** Deterministic PRNG (mulberry32) seeded from a string. */
function rng(seed: string) {
  let a = 0;
  for (let i = 0; i < seed.length; i++) a = (Math.imul(a ^ seed.charCodeAt(i), 2654435761) + i) | 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Bring a taste vector's decay forward to `now` (lazy: decay is applied in one multiply when time moves on). */
function ageTaste(v: Float32Array, from: number, now: number, halfLife: number): number {
  if (now <= from) return from;
  const f = decay(now - from, halfLife);
  if (f < 0.9999) for (let i = 0; i < v.length; i++) if (v[i] !== 0) v[i] = v[i]! * f;
  return now;
}

// The record last produced from a given features object: re-remembering the same object (a replay over the same
// history) is then a no-op instead of a rebuild.
const mergedFrom = new WeakMap<TitleFeatures, TitleFeatures & { at: number }>();
export function rememberFeatures(s: LearnerState, f: TitleFeatures, at: number) {
  const cur = s.features[f.id];
  if (cur && mergedFrom.get(f) === cur && cur.at >= at) return;
  const rec = { ...(cur ?? {}), ...f, directors: f.directors ?? cur?.directors, cast: f.cast ?? cur?.cast, creators: f.creators ?? cur?.creators, collection: f.collection !== undefined ? f.collection : cur?.collection, collectionName: f.collectionName ?? cur?.collectionName, names: { ...(cur?.names ?? {}), ...(f.names ?? {}) }, at: Math.max(at, cur?.at ?? 0) };
  s.features[f.id] = rec;
  mergedFrom.set(f, rec);
  if (cur) return; // the number of titles did not change
  const ids = Object.keys(s.features);
  if (ids.length > LEARN.featuresMax) {
    const drop = ids.sort((a, b) => s.features[a]!.at - s.features[b]!.at).slice(0, ids.length - LEARN.featuresMax);
    for (const id of drop) delete s.features[id];
  }
}

/** One weighted logistic-regression step on (x, dense) with label y. */
function sgd(s: LearnerState, x: SparseVec, d: Partial<DenseParts> | null, y: 0 | 1, w: number) {
  const p = sigmoid(logit(s, x, d));
  const g = (p - y) * w;
  for (let k = 0; k < x.idx.length; k++) {
    const i = x.idx[k]!;
    const gi = g * x.val[k]! + LEARN.l2Sparse * s.w[i]!;
    s.g2[i] = s.g2[i]! + gi * gi;
    s.w[i] = s.w[i]! - (LEARN.lrSparse / Math.sqrt(1e-6 + s.g2[i]!)) * gi;
  }
  if (d) for (const k of DENSE_KEYS) {
    const v = d[k];
    if (v === undefined) continue;
    const gk = g * v + LEARN.l2Dense * (s.dense[k] - DENSE_PRIOR[k]);
    s.dg2[k] += gk * gk;
    s.dense[k] -= (LEARN.lrDense / Math.sqrt(1e-6 + s.dg2[k])) * gk;
  }
  s.bias -= 0.05 * g;
  s.n++;
}

/** Linear score: bias + personal sparse weights + dense weights · dense parts (+ Taste DNA edits). */
export function logit(s: LearnerState, x: SparseVec, d: Partial<DenseParts> | null): number {
  let z = s.bias + dot(x, s.w);
  if (d) for (const k of DENSE_KEYS) z += (d[k] ?? 0) * s.dense[k];
  return z;
}

export interface TasteSims { tasteShort: number; tasteLong: number }

export function tasteSims(s: LearnerState, x: SparseVec, now: number): TasteSims {
  // cosine is scale-invariant, so the lazy decay of the stored vectors does not change it
  void now;
  return { tasteShort: cosine(x, s.shortT, norm(s.shortT)), tasteLong: cosine(x, s.longT, norm(s.longT)) };
}

/**
 * Apply one interaction. Returns false when it was skipped (already applied, before a reset, neutral, or the title's
 * features are unknown). Neutral interactions (samples, playback failures, hides) are logged but never trained on.
 */
export function applyInteraction(s: LearnerState, e: Interaction, now = e.at, pool?: readonly string[]): boolean {
  const key = eventKey(e);
  if (s.applied[key] || e.at < s.resetAt || s.forgotten[e.id]) return false;
  const f = s.features[e.id];
  const l = label(e.kind);
  // a trainable interaction on a title whose features are not known yet waits for them (it is not marked applied)
  if (l && !f) return false;
  s.applied[key] = 1;
  if (e.kind !== "sample") { s.log.push(e); if (s.log.length > LEARN.logMax) s.log.splice(0, s.log.length - LEARN.logMax); }
  bumpCategory(s, e);
  s.updatedAt = Math.max(s.updatedAt, e.at);
  if (!l || !f) return true;
  const x = vectorize(f);
  // taste vectors: signed, recency-weighted accumulation (negatives pull away)
  const v = (l.y ? 1 : -1) * l.w;
  s.shortAt = ageTaste(s.shortT, s.shortAt, Math.max(s.shortAt, e.at), SHORT_HALF_LIFE_DAYS);
  s.longAt = ageTaste(s.longT, s.longAt, Math.max(s.longAt, e.at), LONG_HALF_LIFE_DAYS);
  const age = Math.max(0, s.shortAt - e.at);
  const ws = v * decay(age, SHORT_HALF_LIFE_DAYS), wl = v * decay(Math.max(0, s.longAt - e.at), LONG_HALF_LIFE_DAYS);
  for (let k = 0; k < x.idx.length; k++) { const i = x.idx[k]!; s.shortT[i] = s.shortT[i]! + ws * x.val[k]!; s.longT[i] = s.longT[i]! + wl * x.val[k]!; }
  // personal ranking model: the example itself, then sampled negatives for positives (implicit feedback)
  const d = denseFromFeatures(s, f, x, now);
  sgd(s, x, d, l.y, l.w);
  if (l.y === 1 && pool?.length) {
    const r = rng(key);
    const positive = new Set(s.log.filter((x) => (label(x.kind)?.y ?? 0) === 1).map((x) => x.id));
    for (let k = 0, tries = 0; k < LEARN.negatives && tries < LEARN.negatives * 4; tries++) {
      const id = pool[Math.floor(r() * pool.length)]!;
      const nf = s.features[id];
      if (!nf || positive.has(id) || id === e.id) continue;
      const nx = vectorize(nf);
      sgd(s, nx, denseFromFeatures(s, nf, nx, now), 0, LEARN.negativeWeight);
      k++;
    }
  }
  return true;
}

/**
 * Train the ranking weights from a recommendation row: the engine's parts for a title the viewer chose (y = 1) or
 * scrolled past repeatedly (y = 0). This is where the dense weights learn this profile's balance of similarity,
 * quality, popularity, freshness and language.
 */
export function applyRowOutcome(s: LearnerState, f: TitleFeatures, parts: Partial<DenseParts>, chosen: boolean, now: number) {
  const x = vectorize(f);
  sgd(s, x, { ...parts, ...tasteSims(s, x, now) }, chosen ? 1 : 0, chosen ? 0.6 : 0.2);
}

function bumpCategory(s: LearnerState, e: Interaction) {
  if (!e.surface || e.surface === "__proto__" || e.surface === "constructor" || e.surface === "prototype") return;
  const c = s.categories[e.surface] ?? { shown: 0, opened: 0, played: 0, completed: 0, hidden: 0, at: 0 };
  const k: Partial<Record<InteractionKind, keyof CategoryStats>> = { open: "opened", play: "played", complete: "completed", hide: "hidden", "not-interested": "hidden" };
  const f = k[e.kind];
  if (f) (c[f] as number)++;
  c.at = Math.max(c.at, e.at);
  s.categories[e.surface] = c;
}

/** Dense parts computable from a title's own features (the engine parts that need candidate context stay 0). */
export function denseFromFeatures(s: LearnerState, f: TitleFeatures, x: SparseVec, now: number): Partial<DenseParts> {
  const quality = f.rating == null ? 0 : Math.max(-1, Math.min(1, (f.rating - 6.5) / 2.5));
  return { quality, ...tasteSims(s, x, now), franchise: franchiseAffinity(s, f) };
}

/** 1 when the profile finished or loved another part of this title's collection, else 0. */
export function franchiseAffinity(s: LearnerState, f: TitleFeatures): number {
  if (!f.collection) return 0;
  for (const e of s.log) {
    if (e.id === f.id) continue;
    const g = s.features[e.id];
    if (g?.collection === f.collection && (label(e.kind)?.y ?? 0) === 1) return 1;
  }
  return 0;
}

export interface IntelScore { logit: number; p: number; dense: Partial<DenseParts>; personal: number }

/** Score one title with this profile's model, given the engine parts computed for it (or none). */
export function scoreTitle(s: LearnerState, f: TitleFeatures, engineParts: Partial<Record<ScorePart, number>> | null, now: number, extra: Partial<DenseParts> = {}): IntelScore {
  const x = vectorize(f);
  const d: Partial<DenseParts> = { ...(engineParts ?? {}), ...tasteSims(s, x, now), franchise: franchiseAffinity(s, f), ...extra };
  let z = logit(s, x, d);
  const ov = overrideBoost(s, f);
  z += ov;
  return { logit: z, p: sigmoid(z), dense: d, personal: dot(x, s.w) + ov };
}

function overrideBoost(s: LearnerState, f: TitleFeatures): number {
  if (!Object.keys(s.overrides).length) return 0;
  let z = 0;
  for (const [k] of featureKeys(f)) { const o = s.overrides[k]; if (o) z += o * 0.9; }
  return z;
}

/** Named affinities: per feature key seen on this profile's titles, the learned weight + long-term taste. */
export function affinities(s: LearnerState): { key: string; name: string; score: number; titles: string[] }[] {
  const keys = new Map<string, { name: string; titles: Set<string> }>();
  const positive = new Set(s.log.filter((e) => (label(e.kind)?.y ?? 0) === 1).map((e) => e.id));
  for (const id of positive) {
    const f = s.features[id];
    if (!f) continue;
    for (const [k] of featureKeys(f)) {
      if (k.startsWith("gg:") || k.startsWith("r:") || k.startsWith("t:")) continue;
      const cur = keys.get(k) ?? { name: displayName(k, f), titles: new Set<string>() };
      cur.titles.add(f.title);
      keys.set(k, cur);
    }
  }
  const lt = norm(s.longT) || 1;
  return [...keys].map(([key, v]) => ({ key, name: v.name, titles: [...v.titles].slice(0, 3), score: s.w[slot(key)]! * 0.5 + s.longT[slot(key)]! / lt + (s.overrides[key] ?? 0) }))
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
}

export function displayName(key: string, f?: Pick<TitleFeatures, "names">): string {
  const [ns, ...rest] = key.split(":");
  const v = rest.join(":");
  const named = f?.names?.[key];
  if (named) return named;
  if (ns === "l") return languageLabel(v);
  if (ns === "e") return v;
  if (ns === "cr") return v.replace(/\b\w/g, (c) => c.toUpperCase());
  return v;
}

const LANGS: Record<string, string> = { en: "English", hi: "Hindi", ta: "Tamil", te: "Telugu", ml: "Malayalam", kn: "Kannada", bn: "Bengali", mr: "Marathi", ko: "Korean", ja: "Japanese", zh: "Chinese", es: "Spanish", fr: "French", de: "German", it: "Italian", pt: "Portuguese", tr: "Turkish", th: "Thai", ru: "Russian", ar: "Arabic", sv: "Swedish", da: "Danish", no: "Norwegian", pl: "Polish", id: "Indonesian", tl: "Tagalog", cn: "Cantonese", nl: "Dutch", fa: "Persian", he: "Hebrew", ur: "Urdu", pa: "Punjabi" };
export const languageLabel = (code: string) => LANGS[code] ?? code.toUpperCase();

/**
 * The honest "Why Panda picked this": a named feature this title shares with titles the profile chose, with a
 * positive learned contribution. Returns null when nothing real stands out (the engine's reason is used instead).
 */
export function explainTitle(s: LearnerState, f: TitleFeatures): string | null {
  const x = new Map(featureKeys(f));
  const best: { k: string; v: number; via: TitleFeatures }[] = [];
  const positive = s.log.filter((e) => (label(e.kind)?.y ?? 0) === 1 && e.id !== f.id);
  for (const k of x.keys()) {
    if (!/^(d|c|col|cr|l):/.test(k)) continue;
    const via = positive.map((e) => s.features[e.id]).find((g) => g && featureKeys(g).some(([gk]) => gk === k));
    if (!via) continue;
    const v = s.w[slot(k)]! + (s.overrides[k] ?? 0);
    if (v > 0.05 || k.startsWith("col:")) best.push({ k, v: v + (k.startsWith("col:") ? 1 : k.startsWith("d:") ? 0.3 : 0), via });
  }
  best.sort((a, b) => b.v - a.v || a.k.localeCompare(b.k));
  const top = best[0];
  if (!top) return genreStreak(s, f, positive);
  const name = displayName(top.k, { names: { ...(top.via.names ?? {}), ...(f.names ?? {}) } });
  // "Next" only when this title really comes after the one watched (release years); otherwise just "also in"
  if (top.k.startsWith("col:")) return f.year && top.via.year && f.year >= top.via.year ? `Next in ${name}, after ${top.via.title}` : `Also in ${name}, like ${top.via.title}`;
  if (top.k.startsWith("d:")) return `From ${name}, director of ${top.via.title}`;
  if (top.k.startsWith("cr:")) return `From ${name}, creator of ${top.via.title}`;
  if (top.k.startsWith("c:")) return `With ${name}, from ${top.via.title}`;
  if (top.k.startsWith("l:")) return `More ${name} picks, like ${top.via.title}`;
  return null;
}

/** Evidence threshold for the genre-streak explanation: this many positive titles of the genre in the window. */
export const STREAK_MIN = 3;
const STREAK_WINDOW = 45 * 24 * 3600_000;

/** "You've finished 4 thrillers lately": only when the profile really did, recently, and the model agrees. */
function genreStreak(s: LearnerState, f: TitleFeatures, positive: LearnerState["log"]): string | null {
  const since = (positive[positive.length - 1]?.at ?? 0) - STREAK_WINDOW;
  let best: { g: string; n: number } | null = null;
  for (const g of f.genres) {
    const w = s.w[slot(`g:${g}`)]! + (s.overrides[`g:${g}`] ?? 0);
    if (w <= 0.05) continue;
    const ids = new Set(positive.filter((e) => e.at >= since && (e.kind === "complete" || e.kind === "binge" || e.kind === "love" || e.kind === "like" || e.kind === "rewatch") && s.features[e.id]?.genres.includes(g)).map((e) => e.id));
    if (ids.size >= STREAK_MIN && (!best || ids.size > best.n)) best = { g, n: ids.size };
  }
  return best ? `You've enjoyed ${best.n} ${best.g.toLowerCase()} titles lately` : null;
}

/** Validate a stored record; anything off returns null and the caller rebuilds from local history. */
export function revive(raw: unknown, profileId: string): LearnerState | null {
  const r = raw as Partial<LearnerState> | null;
  if (!r || typeof r !== "object" || r.profileId !== profileId) return null;
  if (typeof r.schema !== "number" || r.schema > SCHEMA) return null;
  const arr = (a: unknown) => (a instanceof Float32Array && a.length === DIM ? a : null);
  const w = arr(r.w), g2 = arr(r.g2), st = arr(r.shortT), lt = arr(r.longT);
  if (!w || !g2 || !st || !lt) return null;
  for (const v of [w, st, lt]) for (let i = 0; i < v.length; i += 97) if (!Number.isFinite(v[i]!)) return null;
  const dense = r.dense && DENSE_KEYS.every((k) => Number.isFinite((r.dense as DenseParts)[k])) ? r.dense : null;
  if (!dense) return null;
  return {
    ...emptyState(profileId), ...r, w, g2, shortT: st, longT: lt, dense: { ...DENSE_PRIOR, ...dense },
    dg2: { ...emptyState(profileId).dg2, ...(r.dg2 ?? {}) }, schema: SCHEMA,
    applied: r.applied ?? {}, log: Array.isArray(r.log) ? r.log : [], features: r.features ?? {}, categories: r.categories ?? {}, overrides: r.overrides ?? {},
    forgotten: r.forgotten ?? {}, stamps: r.stamps ?? {}, shown: r.shown ?? {}
  } as LearnerState;
}

/**
 * v1.5.0 short- vs long-term taste: for each genre, language and decade the profile has watched, its weight in the
 * short-term taste vector (half-life of days) and in the long-term one (months), each as a share of the vector's
 * length. `delta > 0` is an emerging interest, `delta < 0` one that is fading. Only keys the profile has positive
 * interactions with are listed, and only once there are at least `minEvents` of them.
 */
export interface Drift { key: string; name: string; short: number; long: number; delta: number }
export function tasteDrift(s: LearnerState, minEvents = 8): Drift[] {
  const positives = s.log.filter((e) => (label(e.kind)?.y ?? 0) === 1);
  if (positives.length < minEvents) return [];
  const keys = new Map<string, string>();
  for (const e of positives) {
    const f = s.features[e.id];
    if (!f) continue;
    for (const [k] of featureKeys(f)) if (k.startsWith("g:") || k.startsWith("l:") || k.startsWith("e:")) if (!keys.has(k)) keys.set(k, displayName(k, f));
  }
  const ns = norm(s.shortT) || 1, nl = norm(s.longT) || 1;
  return [...keys].map(([key, name]) => {
    const st = Math.max(0, s.shortT[slot(key)]! / ns), lt = Math.max(0, s.longT[slot(key)]! / nl);
    return { key, name, short: st, long: lt, delta: st - lt };
  }).sort((a, b) => b.delta - a.delta || a.key.localeCompare(b.key));
}

/** Thresholds shared by the "New Interest" rail and Taste DNA's evolution section. */
export const DRIFT_DELTA = 0.12;
export const DRIFT_MIN = 0.25;

/** Taste evolution: interests rising lately (short-term ≫ long-term) and ones fading. Empty with too little history. */
export function tasteEvolution(s: LearnerState, max = 4): { emerging: Drift[]; fading: Drift[] } {
  const d = tasteDrift(s);
  return {
    emerging: d.filter((x) => x.delta > DRIFT_DELTA && x.short > DRIFT_MIN).slice(0, max),
    fading: [...d].reverse().filter((x) => x.delta < -DRIFT_DELTA && x.long > DRIFT_MIN).slice(0, max)
  };
}
