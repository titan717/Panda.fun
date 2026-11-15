import { scoreTitle, type LearnerState } from "./learner";
import type { TitleFeatures } from "./features";

/**
 * v1.5.0 Surprise Me: one title Panda has seen in this profile's rows but the profile has not opened, picked at
 * random from the 25 the on-device model likes most (so it is a surprise, not the obvious top pick). Kids profiles
 * only get Animation / Family titles. Returns null when nothing qualifies; it never invents a title.
 */
export function pickSurprise(s: LearnerState, o: { exclude: ReadonlySet<string>; kids: boolean; now?: number; rand?: () => number }): TitleFeatures | null {
  const now = o.now ?? Date.now();
  const touched = new Set(s.log.map((e) => e.id));
  const pool = Object.values(s.features).filter((f) =>
    !touched.has(f.id) && !o.exclude.has(f.id) && !s.forgotten[f.id] && (f.rating ?? 0) >= 6.5 &&
    (!o.kids || f.genres.some((g) => g === "Animation" || g === "Family")) && /^(movie|tv):\d+$/.test(f.id));
  if (!pool.length) return null;
  const top = pool.map((f) => ({ f, p: scoreTitle(s, f, null, now).p })).sort((a, b) => b.p - a.p).slice(0, 25);
  return top[Math.floor((o.rand ?? Math.random)() * top.length)]!.f;
}

export const surprisePath = (f: TitleFeatures) => `/title/${f.type}/${f.id.split(":")[1]}`;
