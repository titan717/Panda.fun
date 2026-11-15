import type { CategoryDef } from "./catalog";
import type { CategoryStats } from "../intel/learner";

/**
 * Category-level ranking for the Home feed (pure, deterministic for a given day).
 *
 *   score = prior
 *         + 0.9 × onboarding genre match           (the profile's answers; the only signal on a new profile)
 *         + 1.2 × learned genre / language affinity (the on-device taste model, src/lib/intel)
 *         + 0.6 × preferred-language match         (Top 10 language, the most-watched language)
 *         + 2.0 × category engagement − its prior  (opens of titles from this rail ÷ times the rail was seen, smoothed)
 *         − 0.6 per "hide" from this rail
 *         + up to 0.35 exploration                 (a per-profile, per-day jitter so the long tail gets a turn)
 *
 * then a greedy diversity pass: a rail loses 0.45 when the previous rail has the same family, 1.3 when the previous
 * rail shares its genre or language and 0.8 when one of the two before that does, so the feed alternates genres,
 * languages and rail kinds even for a profile with one strong favourite.
 */
export interface RankContext {
  /** onboarding genres (canonical names) */
  tasteGenres: readonly string[];
  /** learned affinity per canonical genre and per language code, roughly −1..1 */
  genreAffinity: ReadonlyMap<string, number>;
  langAffinity: ReadonlyMap<string, number>;
  preferredLangs: readonly string[];
  stats: Readonly<Record<string, CategoryStats>>;
  /** stable per profile and day: `${profileId}|${yyyy-mm-dd}` */
  seed: string;
  /** what the profile mostly watches, from onboarding */
  contentType?: "movie" | "tv" | "both";
}

const ENGAGE_PRIOR = 0.15;

export function engagement(s: CategoryStats | undefined): number {
  if (!s) return 0;
  const good = s.opened + 2 * s.played + 3 * s.completed;
  return (good + ENGAGE_PRIOR * 4) / (s.shown + 4) - ENGAGE_PRIOR;
}

/** FNV-1a → [0, 1): the exploration jitter, stable for a profile within a day. */
export function jitter(seed: string, id: string): number {
  let h = 0x811c9dc5;
  const s = `${seed}|${id}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return ((h >>> 0) % 10_000) / 10_000;
}

export function categoryScore(c: CategoryDef, ctx: RankContext): number {
  let z = c.prior;
  if (c.genres.some((g) => ctx.tasteGenres.includes(g))) z += 0.9;
  const ga = c.genres.length ? Math.max(...c.genres.map((g) => ctx.genreAffinity.get(g) ?? 0)) : 0;
  const la = c.lang ? ctx.langAffinity.get(c.lang) ?? 0 : 0;
  z += 1.2 * Math.max(-1, Math.min(1.5, ga + la));
  if (c.lang && ctx.preferredLangs.includes(c.lang)) z += 0.6;
  if (ctx.contentType && ctx.contentType !== "both") {
    const t = c.source.type;
    if (t !== "all" && t !== ctx.contentType) z -= 0.35;
  }
  const s = ctx.stats[c.id];
  z += 2 * engagement(s);
  if (s?.hidden) z -= 0.6 * s.hidden;
  z += 0.35 * jitter(ctx.seed, c.id);
  return z;
}

/** Order categories for the feed: score, then the diversity pass. Returns every category, best first. */
export function rankCategories(defs: readonly CategoryDef[], ctx: RankContext): CategoryDef[] {
  const pool = defs.map((c) => ({ c, z: categoryScore(c, ctx) }));
  const out: CategoryDef[] = [];
  while (pool.length) {
    let best = 0, bestZ = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const { c, z } = pool[i]!;
      let adj = z;
      const prev = out[out.length - 1];
      if (prev && prev.family === c.family) adj -= 0.45;
      const clash = (r: CategoryDef | undefined) => Boolean(r && ((c.lang && r.lang === c.lang) || r.genres.some((g) => c.genres.includes(g))));
      if (clash(out[out.length - 1])) adj -= 1.3;
      else if (clash(out[out.length - 2]) || clash(out[out.length - 3])) adj -= 0.8;
      if (adj > bestZ || (adj === bestZ && c.id < pool[best]!.c.id)) { best = i; bestZ = adj; }
    }
    out.push(pool[best]!.c);
    pool.splice(best, 1);
  }
  return out;
}

export const dayKey = (now: number) => new Date(now).toISOString().slice(0, 10);
