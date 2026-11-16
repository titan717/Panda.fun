import type { HistoryEntry, Rating } from "../store";
import type { FeedbackEvent } from "../reco/feedback";
import type { PandaItem } from "../types";
import { feedbackEvent, historyEvents, label, ratingEvent, type Interaction } from "./events";
import { fromItem } from "./features";
import { applyInteraction, eventKey, rememberFeatures, type LearnerState } from "./learner";
import { negativePool } from "./trainer";

/** Everything the learner reads — all of it already on the device, in the profile's own data. */
export interface IntelSources {
  history: Record<string, HistoryEntry>;
  ratings: Record<string, Rating>;
  watchlist: readonly PandaItem[];
  lists?: readonly { items: readonly PandaItem[] }[];
  feedback?: readonly FeedbackEvent[];
}

/**
 * Derive every interaction from the profile's local data, oldest first. Undated signals (ratings, saves) take the
 * time they were first seen (`stamps`), so the order is stable across replays.
 */
// Title features depend only on the item object; history entries keep the same object between store updates, so a
// replay over a long history does not rebuild them (v1.5.0 benchmark: most of the main-thread cost of a job).
const featureCache = new WeakMap<PandaItem, ReturnType<typeof fromItem>>();
const features = (i: PandaItem) => {
  let f = featureCache.get(i);
  if (!f) { f = fromItem(i); featureCache.set(i, f); }
  return f;
};

export function deriveInteractions(s: LearnerState, src: IntelSources, now: number): Interaction[] {
  const out: Interaction[] = [];
  const stamp = (k: string, fallback: number) => (s.stamps[k] ??= fallback);
  for (const h of Object.values(src.history)) {
    rememberFeatures(s, features(h.item), h.updatedAt);
    out.push(...historyEvents(h, now));
  }
  const saved = new Map<string, PandaItem>();
  for (const i of src.watchlist) saved.set(i.id, i);
  for (const l of src.lists ?? []) for (const i of l.items) if (!saved.has(i.id)) saved.set(i.id, i);
  for (const i of saved.values()) { rememberFeatures(s, features(i), 0); out.push({ id: i.id, kind: "save", at: stamp(`${i.id}|save`, now) }); }
  for (const [id, r] of Object.entries(src.ratings)) {
    const at = stamp(`${id}|${r}`, src.history[id]?.updatedAt ?? now);
    out.push(ratingEvent(id, r, at));
  }
  for (const f of src.feedback ?? []) {
    if (f.title || f.genres?.length) rememberFeatures(s, { id: f.id, type: f.type, title: f.title ?? "", genres: f.genres ?? [], language: null, year: null, rating: null, ...(s.features[f.id] ?? {}) }, 0);
    const e = feedbackEvent(f);
    if (e) out.push(e);
  }
  const keys = new Map(out.map((e) => [e, eventKey(e)]));
  return out.sort((a, b) => a.at - b.at || keys.get(a)!.localeCompare(keys.get(b)!));
}

/**
 * Apply the interactions that are new since the last run. `budget` caps the work per call (the runtime calls again
 * in the next idle slot), so a first run over a long history never blocks a frame.
 * Returns how many were applied and whether more remain.
 */
/** The interactions not applied yet (what a training job carries). */
export function pendingInteractions(s: LearnerState, src: IntelSources, now: number): Interaction[] {
  return deriveInteractions(s, src, now).filter((e) => !s.applied[eventKey(e)] && !s.forgotten[e.id] && e.at >= s.resetAt && !(label(e.kind) && !s.features[e.id]));
}

export function ingest(s: LearnerState, src: IntelSources, now: number, budget = Infinity): { applied: number; more: boolean } {
  const all = deriveInteractions(s, src, now).filter((e) => !s.applied[eventKey(e)]);
  const pool = negativePool(s);
  let applied = 0, n = 0;
  for (const e of all) {
    if (n >= budget) return { applied, more: true };
    n++;
    if (applyInteraction(s, e, now, pool)) applied++;
  }
  return { applied, more: false };
}
