import { useSyncExternalStore } from "react";
import { getState, subscribeStore, type State } from "../store";
import { getFeedback, subscribeFeedback } from "../reco/feedback";
import type { Scored, ScorePart } from "../reco/engine";
import type { PandaItem, TitleDetails } from "../types";
import { fromDetails, fromItem, mergeFeatures, type TitleFeatures } from "./features";
import { ingest, type IntelSources } from "./ingest";
import {
  applyRowOutcome, emptyState, explainTitle, retrainBase, rememberFeatures, scoreTitle, type DenseParts, type LearnerState
} from "./learner";
import { deleteModel, loadModel, pruneModels, saveModel } from "./store";

/**
 * Panda Intelligence runtime: owns the active profile's model, keeps it trained on new local interactions in idle
 * time, persists it, and exposes it to the recommendation engine and the UI. Nothing here makes a network call.
 */

interface Current { pid: string; state: LearnerState; loaded: boolean; status: string }
let cur: Current | null = null;
let version = 0;
const subs = new Set<() => void>();
const emit = () => { version++; subs.forEach((f) => f()); };
let started = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let idleHandle: number | null = null;
/** The engine parts each title had when it was last ranked, for row-outcome training. */
const lastParts = new Map<string, Partial<DenseParts>>();
export const SKIP_AFTER = 3;
export const INGEST_BUDGET = 60;

const idle = (f: () => void): number => {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  return ric ? ric(f, { timeout: 500 }) : (setTimeout(f, 30) as unknown as number);
};

function sources(s: State, pid: string): IntelSources {
  const d = s.data[pid];
  return { history: d?.history ?? {}, ratings: d?.ratings ?? {}, watchlist: d?.watchlist ?? [], lists: d?.lists ?? [], feedback: getFeedback(pid) };
}

function scheduleIngest() {
  if (idleHandle !== null || !cur?.loaded) return;
  idleHandle = idle(() => {
    idleHandle = null;
    if (!cur) return;
    const r = ingest(cur.state, sources(getState(), cur.pid), Date.now(), INGEST_BUDGET);
    if (r.applied) { scheduleSave(); emit(); }
    if (r.more) scheduleIngest();
  });
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; if (cur) void saveModel(cur.state); }, 1500);
}

async function activate(pid: string | null) {
  if (cur?.pid === pid) return;
  if (cur && saveTimer) { clearTimeout(saveTimer); saveTimer = null; void saveModel(cur.state); }
  lastParts.clear();
  if (!pid) { cur = null; emit(); return; }
  cur = { pid, state: emptyState(pid, Date.now()), loaded: false, status: "loading" };
  emit();
  const r = await loadModel(pid);
  if (cur?.pid !== pid) return;
  cur = { pid, state: r.state ?? emptyState(pid, Date.now()), loaded: true, status: r.status };
  emit();
  scheduleIngest();
}

/** Start once, after the store has loaded. Safe to call more than once. */
export function startIntel() {
  if (started) return;
  started = true;
  let pid = getState().activeProfileId;
  let profiles = getState().profiles.map((p) => p.id).join(",");
  void activate(pid);
  subscribeStore(() => {
    const s = getState();
    if (s.activeProfileId !== pid) { pid = s.activeProfileId; void activate(pid); }
    else scheduleIngest();
    const ids = s.profiles.map((p) => p.id).join(",");
    if (ids !== profiles) { profiles = ids; void pruneModels(new Set(s.profiles.map((p) => p.id))); }
  });
  subscribeFeedback(scheduleIngest);
}

export function subscribeIntel(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }
export const intelVersion = () => version;
export const intelState = (): LearnerState | null => (cur?.loaded ? cur.state : null);
export const intelStatus = () => cur?.status ?? "off";

/** Re-render on every model update; returns the active profile's model (null while it loads). */
export function useIntel(): LearnerState | null {
  useSyncExternalStore(subscribeIntel, intelVersion, intelVersion);
  return intelState();
}

/** The model version: changes on every update (the state object itself is mutated in place). */
export function useIntelVersion(): number {
  return useSyncExternalStore(subscribeIntel, intelVersion, intelVersion);
}

/** Details opened anywhere (Details page, a seed lookup): their people and franchise become features. */
export function noteDetails(d: TitleDetails | undefined) {
  if (!d || !cur) return;
  const f = fromDetails(d);
  const had = cur.state.features[d.id];
  if (had?.directors && had.cast) return;
  rememberFeatures(cur.state, mergeFeatures(had, f), Date.now());
  scheduleIngest();
  scheduleSave();
}

/** A recommended title was on screen in a row. Three sightings without an open is a (weak) skip. */
export function noteShown(id: string) {
  const s = intelState();
  if (!s) return;
  const n = (s.shown[id] = (s.shown[id] ?? 0) + 1);
  if (n === SKIP_AFTER && !s.log.some((e) => e.id === id)) {
    const f = s.features[id];
    const parts = lastParts.get(id);
    if (f && parts) { applyRowOutcome(s, f, parts, false, Date.now()); scheduleSave(); }
  }
}

/** A recommended title was opened from a row: the ranking weights learn from its engine parts. */
export function noteOpened(id: string) {
  const s = intelState();
  if (!s) return;
  const f = s.features[id];
  const parts = lastParts.get(id);
  if (f && parts) { applyRowOutcome(s, f, parts, true, Date.now()); scheduleSave(); emit(); }
}

/**
 * Re-rank the engine's scored list with the profile's model. The engine score stays the prior: with an untrained
 * model the order is unchanged. Adds the personal reason where a real one exists.
 */
export function rerank(list: Scored[], state: LearnerState | null = intelState(), now = Date.now()): Scored[] {
  if (!state || !list.length) return list;
  const out = list.map((sc) => {
    const item = sc.c.item;
    const f: TitleFeatures = mergeFeatures(fromItem(item), state.features[item.id] ?? fromItem(item));
    const parts = { ...(sc.parts as Record<ScorePart, number>), novelty: sc.c.trendRank === null ? 1 : 0 };
    lastParts.set(item.id, parts);
    if (!state.features[item.id] && Object.keys(state.features).length < 1400) rememberFeatures(state, fromItem(item), 0);
    const r = scoreTitle(state, f, parts, now, { novelty: parts.novelty });
    const why = explainTitle(state, f);
    return { ...sc, score: r.logit, reason: why ? { kind: "personal" as const, text: why } : sc.reason };
  });
  return out.sort((a, b) => b.score - a.score || a.c.item.id.localeCompare(b.c.item.id));
}

/** Predicted enjoyment in [0, 1] for one title (Taste DNA, natural-language search ordering). */
export function predict(item: PandaItem, state: LearnerState | null = intelState(), now = Date.now()): number | null {
  if (!state) return null;
  return scoreTitle(state, mergeFeatures(fromItem(item), state.features[item.id] ?? fromItem(item)), null, now).p;
}

/** Taste DNA edit: more (+1) / less (-1) of a feature, or clear (null). */
export function setOverride(key: string, v: 1 | -1 | null) {
  const s = intelState();
  if (!s) return;
  if (v === null) delete s.overrides[key]; else s.overrides[key] = v;
  scheduleSave(); emit();
}

/** Entertainment Memory: forget one title (it is never trained on again) and retrain from the rest. */
export function forgetTitle(id: string) {
  if (!cur?.loaded) return;
  const base = retrainBase(cur.state);
  base.forgotten[id] = 1;
  cur.state = base;
  emit(); scheduleIngest(); scheduleSave();
}

/** "Reset what Panda learned": a fresh model; everything recorded so far is ignored from now on. */
export async function resetIntel() {
  if (!cur) return;
  const pid = cur.pid;
  const s = emptyState(pid, Date.now());
  s.resetAt = Date.now();
  // keep the catalogue metadata and the first-seen times, so old ratings and saves stay "old" after the reset
  s.features = cur.state.features;
  s.stamps = cur.state.stamps;
  cur = { pid, state: s, loaded: true, status: "reset" };
  await deleteModel(pid);
  await saveModel(s);
  emit();
}

export function resetRuntimeForTest(state?: LearnerState) {
  cur = state ? { pid: state.profileId, state, loaded: true, status: "test" } : null;
  lastParts.clear();
  emit();
}
