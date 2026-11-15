import type { HistoryEntry, Rating } from "../store";
import type { FeedbackEvent } from "../reco/feedback";

/**
 * Interactions the on-device learner trains on, and how strongly each one counts.
 *
 * Safeguards (docs/RECOMMENDATIONS.md §"What never counts against a title"):
 *  - a playback failure is never a negative signal — the title did not get a chance; it is handled by playback
 *    health (temporary suppression), not by taste;
 *  - a short sample (under 3 minutes or 8 %) is neutral: people zap, misclick and check the picture;
 *  - pausing, seeking and leaving the player are not events at all;
 *  - an unfinished episode, or a finished episode of an unfinished show, is never negative — finishing an
 *    episode is a positive step;
 *  - "Hide" removes a title from rows without touching taste (it might be a title the viewer loves but has seen);
 *  - an abandon only counts, weakly, for a movie started, left under 15 % and not resumed for 21 days.
 */
export type InteractionKind =
  | "complete" | "episode" | "binge" | "progress" | "sample" | "abandon" | "rewatch"
  | "love" | "like" | "dislike" | "save"
  | "more" | "not-interested" | "hide" | "watched" | "open" | "play"
  | "skip" | "playback-failed";

/** Signed strength: > 0 positive, < 0 negative, 0 recorded but never trained on. */
export const INTERACTION_WEIGHTS: Record<InteractionKind, number> = {
  complete: 1.0,
  episode: 0.35,
  binge: 0.8,
  progress: 0.45,
  sample: 0,
  abandon: -0.15,
  rewatch: 1.2,
  love: 1.6,
  like: 0.9,
  dislike: -1.6,
  save: 0.5,
  more: 1.2,
  "not-interested": -0.9,
  hide: 0,
  watched: 0.5,
  open: 0.12,
  play: 0.25,
  /** Shown in a recommendation row 3+ times and never opened: a very weak negative. */
  skip: -0.05,
  "playback-failed": 0
};

export interface Interaction {
  id: string;
  kind: InteractionKind;
  at: number;
  /** Optional context: row/category the interaction came from (category-level learning). */
  surface?: string;
}

export const SAMPLE_SECONDS = 180;
export const SAMPLE_SHARE = 0.08;
export const ABANDON_SHARE = 0.15;
export const ABANDON_AFTER_MS = 21 * 24 * 3600_000;
export const BINGE_EPISODES = 3;
export const BINGE_WINDOW_MS = 24 * 3600_000;

/** Classify one watch-history entry. Pure: the same entry always gives the same events. */
export function historyEvents(h: HistoryEntry, now = Date.now()): Interaction[] {
  const id = h.item.id;
  const out: Interaction[] = [];
  const at = h.updatedAt;
  if (h.item.type === "tv") {
    const eps = Object.values(h.episodes ?? {});
    const done = eps.filter((e) => e.done);
    for (const e of done) out.push({ id, kind: "episode", at: e.at });
    // binge: BINGE_EPISODES finished inside one window
    const times = done.map((e) => e.at).sort((a, b) => a - b);
    for (let i = 0; i + BINGE_EPISODES - 1 < times.length; i++) {
      if (times[i + BINGE_EPISODES - 1]! - times[i]! <= BINGE_WINDOW_MS) { out.push({ id, kind: "binge", at: times[i + BINGE_EPISODES - 1]! }); break; }
    }
    if (h.completed) out.push({ id, kind: "complete", at });
    else if (!done.length) out.push(classifyProgress(h, now));
    return out;
  }
  if (h.completed) return [{ id, kind: "complete", at }];
  return [classifyProgress(h, now)];
}

function classifyProgress(h: HistoryEntry, now: number): Interaction {
  const id = h.item.id, at = h.updatedAt;
  const share = h.duration > 0 ? h.position / h.duration : 0;
  if (h.position < SAMPLE_SECONDS || share < SAMPLE_SHARE) {
    // a short start of a movie, left for weeks: the one case an abandon counts (weakly)
    if (h.item.type === "movie" && h.duration > 0 && now - at > ABANDON_AFTER_MS && h.position >= 60) return { id, kind: "abandon", at };
    return { id, kind: "sample", at };
  }
  if (h.item.type === "movie" && share < ABANDON_SHARE && now - at > ABANDON_AFTER_MS) return { id, kind: "abandon", at };
  return { id, kind: "progress", at };
}

export function ratingEvent(id: string, r: Rating, at: number): Interaction {
  return { id, kind: r, at };
}

export function feedbackEvent(e: FeedbackEvent): Interaction | null {
  switch (e.kind) {
    case "more": return { id: e.id, kind: "more", at: e.at };
    case "not-interested": return { id: e.id, kind: "not-interested", at: e.at };
    case "hide": return { id: e.id, kind: "hide", at: e.at };
    case "watched": return { id: e.id, kind: "watched", at: e.at };
    case "open": return { id: e.id, kind: "open", at: e.at };
    case "play": return { id: e.id, kind: "play", at: e.at };
    default: return null;
  }
}

/** Training label and importance weight for an interaction, or null when it must not be trained on. */
export function label(kind: InteractionKind): { y: 0 | 1; w: number } | null {
  const v = INTERACTION_WEIGHTS[kind];
  if (!v) return null;
  return { y: v > 0 ? 1 : 0, w: Math.abs(v) };
}

/** Recency decay for the short-term taste vector: half-life in days. */
export const SHORT_HALF_LIFE_DAYS = 10;
/** Long-term taste half-life: a year-old favourite still counts, a five-year-old one barely. */
export const LONG_HALF_LIFE_DAYS = 365;

export const decay = (ageMs: number, halfLifeDays: number) => Math.pow(0.5, Math.max(0, ageMs) / (halfLifeDays * 24 * 3600_000));
