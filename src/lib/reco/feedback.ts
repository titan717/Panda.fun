import type { MediaType } from "../types";

/**
 * Recommendation feedback events, local to the device and kept per profile (localStorage `panda:v1:recofeedback`).
 *  - more:            "More like this": the title becomes a strong seed and its genres gain weight.
 *  - not-interested:  removed from recommendations; its genres lose a little weight.
 *  - hide:            removed from recommendations, no taste change.
 *  - watched:         "Already watched": removed, counts as a light positive signal.
 *  - open / play:     implicit: opened or played from a recommendation row (small positive signal).
 * Impressions live in metrics.ts (they do not change the model). Nothing leaves the device.
 */
export type FeedbackKind = "more" | "not-interested" | "hide" | "watched" | "open" | "play";
export interface FeedbackEvent { id: string; type: MediaType; kind: FeedbackKind; at: number; genres?: string[]; title?: string }

const KEY = "panda:v1:recofeedback";
const MAX = 300;
const KINDS: readonly FeedbackKind[] = ["more", "not-interested", "hide", "watched", "open", "play"];

type Store = Record<string, FeedbackEvent[]>;
let cache: Store | null = null;
const subs = new Set<() => void>();

function valid(e: unknown): e is FeedbackEvent {
  const x = e as Partial<FeedbackEvent> | null;
  return Boolean(x && typeof x.id === "string" && (x.type === "movie" || x.type === "tv") && KINDS.includes(x.kind as FeedbackKind) && typeof x.at === "number");
}

function read(): Store {
  if (cache) return cache;
  const out: Store = {};
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "null") as unknown;
    if (p && typeof p === "object") for (const [k, v] of Object.entries(p as Record<string, unknown>)) if (Array.isArray(v)) out[k] = v.filter(valid).slice(-MAX);
  } catch { /* corrupt: start clean */ }
  cache = out;
  return out;
}

function write(s: Store) {
  cache = s;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* full: keep in memory */ }
  subs.forEach((f) => f());
}

export function recordFeedback(profileId: string | null | undefined, e: Omit<FeedbackEvent, "at"> & { at?: number }) {
  const pid = profileId ?? "_";
  const s = read();
  const list = [...(s[pid] ?? []), { ...e, genres: e.genres?.slice(0, 6), title: e.title?.slice(0, 80), at: e.at ?? Date.now() }].slice(-MAX);
  write({ ...s, [pid]: list });
}

/** Undo the last explicit feedback on a title (e.g. an "Undo" toast). */
export function undoFeedback(profileId: string | null | undefined, id: string) {
  const pid = profileId ?? "_";
  const s = read();
  const list = s[pid] ?? [];
  const i = list.map((x) => x.id === id && x.kind !== "open" && x.kind !== "play").lastIndexOf(true);
  if (i < 0) return;
  write({ ...s, [pid]: [...list.slice(0, i), ...list.slice(i + 1)] });
}

export function getFeedback(profileId: string | null | undefined): FeedbackEvent[] { return read()[profileId ?? "_"] ?? []; }
export function clearFeedback(profileId?: string | null) {
  if (profileId === undefined) { write({}); return; }
  const s = { ...read() }; delete s[profileId ?? "_"]; write(s);
}
export function subscribeFeedback(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }
export function resetFeedbackCacheForTest() { cache = null; }
