import { scoreTitle, type LearnerState } from "./learner";
import type { TitleFeatures } from "./features";
import { label } from "./events";

/**
 * v1.5.0 Surprise Me: one title Panda has seen in this profile's rows (so it is real catalogue data) that the
 * profile has not opened, watched, hidden or forgotten.
 *
 *  - Repeatedly ignored titles (shown IGNORED_AFTER+ times, never opened) are skipped.
 *  - Unreleased titles are skipped (nothing to play yet); kids profiles only get Animation / Family titles.
 *  - The pool is the TOP model-ranked candidates; each gets a small novelty lift when its genres are outside the
 *    profile's recent finishes, so a surprise can stretch the profile without ignoring its taste.
 *  - The pick is weighted by that score (not uniform, not always the top one), and the last RECENT picks on this
 *    device are not repeated while alternatives exist.
 * Returns null when nothing qualifies; it never invents a title.
 */
export const IGNORED_AFTER = 4;
export const TOP = 25;
export const RECENT = 8;
const NOVELTY = 0.03; // a tie-breaker towards the unfamiliar, never stronger than a clear taste gap

const recent: string[] = [];
export function resetSurpriseForTest() { recent.length = 0; }

export function surpriseCandidates(s: LearnerState, o: { exclude: ReadonlySet<string>; kids: boolean; now?: number }): { f: TitleFeatures; score: number }[] {
  const now = o.now ?? Date.now();
  const year = new Date(now).getUTCFullYear();
  const touched = new Set(s.log.map((e) => e.id));
  const recentGenres = new Set(s.log.filter((e) => label(e.kind)?.y === 1).slice(-12).flatMap((e) => s.features[e.id]?.genres ?? []));
  const pool = Object.values(s.features).filter((f) =>
    !touched.has(f.id) && !o.exclude.has(f.id) && !s.forgotten[f.id] && (f.rating ?? 0) >= 6.5 &&
    (s.shown[f.id] ?? 0) < IGNORED_AFTER && !(f.year && f.year > year) &&
    (!o.kids || f.genres.some((g) => g === "Animation" || g === "Family")) && /^(movie|tv):\d+$/.test(f.id));
  return pool.map((f) => {
    const novel = recentGenres.size > 0 && f.genres.length > 0 && !f.genres.some((g) => recentGenres.has(g));
    return { f, score: scoreTitle(s, f, null, now).p + (novel ? NOVELTY : 0) };
  }).sort((a, b) => b.score - a.score || a.f.id.localeCompare(b.f.id)).slice(0, TOP);
}

export function pickSurprise(s: LearnerState, o: { exclude: ReadonlySet<string>; kids: boolean; now?: number; rand?: () => number }): TitleFeatures | null {
  const top = surpriseCandidates(s, o);
  if (!top.length) return null;
  const fresh = top.filter((x) => !recent.includes(x.f.id));
  const pool = fresh.length ? fresh : top;
  // weight ∝ score²: a strong match is more likely, a weaker one still possible
  const w = pool.map((x) => Math.max(0.01, x.score) ** 2);
  let r = (o.rand ?? Math.random)() * w.reduce((a, b) => a + b, 0);
  let pick = pool[pool.length - 1]!.f;
  for (let i = 0; i < pool.length; i++) { r -= w[i]!; if (r <= 0) { pick = pool[i]!.f; break; } }
  recent.push(pick.id);
  if (recent.length > RECENT) recent.shift();
  return pick;
}

export const surprisePath = (f: TitleFeatures) => `/title/${f.type}/${f.id.split(":")[1]}`;
