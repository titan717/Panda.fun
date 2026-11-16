import { useSyncExternalStore } from "react";
import { getState, subscribeStore, type State } from "../store";
import { getFeedback, subscribeFeedback } from "../reco/feedback";
import type { Scored, ScorePart } from "../reco/engine";
import type { PandaItem, TitleDetails } from "../types";
import { fromDetails, fromItem, mergeFeatures, type TitleFeatures } from "./features";
import { pendingInteractions, type IntelSources } from "./ingest";
import { mergeResult, runJob, type FeatureRecord, type FromWorker, type RowOp, type ToWorker } from "./trainer";
import {
  emptyState, explainTitle, retrainBase, rememberFeatures, scoreTitle, type DenseParts, type LearnerState
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
/** A worker job that has not answered by then counts as a failure (the fallback takes over). */
export const WORKER_TIMEOUT_MS = 8000;

const idle = (f: () => void): number => {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  return ric ? ric(f, { timeout: 500 }) : (setTimeout(f, 30) as unknown as number);
};

export function sources(s: State, pid: string): IntelSources {
  const d = s.data[pid];
  return { history: d?.history ?? {}, ratings: d?.ratings ?? {}, watchlist: d?.watchlist ?? [], lists: d?.lists ?? [], feedback: getFeedback(pid) };
}

/* ---------------- training: Web Worker first, idle-callback fallback ---------------- */

/**
 * `epoch` changes whenever the model the worker mirrors stops being valid (profile switch, Forget, Reset, a worker
 * failure); a result from an older epoch is dropped, which is how a stale job is cancelled.
 */
let epoch = 0;
type Mode = "auto" | "worker" | "idle";
let mode: Mode = "auto";
let worker: Worker | null = null;
let workerEpoch = -1;
let jobSeq = 0;
let inflight: { id: number; epoch: number; rows: RowOp[]; timer: ReturnType<typeof setTimeout> } | null = null;
/** Feature records the worker mirror has, by reference (a changed record is a new object: see rememberFeatures). */
let sentFeatures = new Map<string, object>();
/** Row outcomes waiting for the next job (applied in order, before that job's interactions). */
let rowQueue: RowOp[] = [];
/** Diagnostics for Settings › Taste DNA, the benchmark and the tests. */
export const trainerStats = { mode: "auto" as Mode, jobs: 0, lastJobMs: 0, lastMainMs: 0, failures: 0, applied: 0 };

type WorkerFactory = () => Worker;
const defaultFactory: WorkerFactory = () => new Worker(new URL("./worker.ts", import.meta.url), { type: "module", name: "panda-intel" });
let factory: WorkerFactory | null = defaultFactory;

function canUseWorker() {
  if (mode === "idle" || factory === null) return false;
  // a custom factory (tests) is used as given; the real one needs Worker support and is never used under vitest
  return factory !== defaultFactory || (typeof Worker !== "undefined" && import.meta.env?.MODE !== "test");
}

function setMode(m: Mode) { mode = m; trainerStats.mode = m; }

function dropWorker(reason: string) {
  trainerStats.failures++;
  try { worker?.terminate(); } catch { /* already gone */ }
  worker = null;
  workerEpoch = -1;
  sentFeatures = new Map();
  if (inflight) { clearTimeout(inflight.timer); rowQueue = [...inflight.rows, ...rowQueue]; inflight = null; }
  // one failure is enough: this device trains in idle time on the main thread for the rest of the session
  setMode("idle");
  if (import.meta.env?.DEV) console.warn("[panda-intel] worker unavailable, using idle-time training:", reason);
  scheduleIngest();
}

function ensureWorker(): Worker | null {
  if (worker) return worker;
  if (!canUseWorker()) return null;
  try {
    const w = factory!();
    w.onmessage = (ev: MessageEvent<FromWorker>) => onWorkerMessage(ev.data);
    w.onerror = (ev) => { ev.preventDefault?.(); dropWorker(ev.message || "worker error"); };
    w.onmessageerror = () => dropWorker("message error");
    worker = w;
    setMode("worker");
    return w;
  } catch (e) {
    setMode("idle");
    if (import.meta.env?.DEV) console.warn("[panda-intel] no worker:", e);
    return null;
  }
}

function onWorkerMessage(r: FromWorker) {
  if (!inflight || r.id !== inflight.id) return;
  clearTimeout(inflight.timer);
  const job = inflight;
  inflight = null;
  if (r.t === "fail") {
    if (r.epoch === epoch && r.message !== "stale") { dropWorker(r.message); return; }
    // stale: the worker's mirror is from another epoch; re-send init with the next job
    workerEpoch = -1;
    if (r.epoch === epoch) rowQueue = [...job.rows, ...rowQueue];
    scheduleIngest();
    return;
  }
  if (r.epoch !== epoch || !cur?.loaded) { scheduleIngest(); return; }
  const t0 = performance.now();
  mergeResult(cur.state, r);
  trainerStats.jobs++; trainerStats.lastJobMs = r.ms; trainerStats.applied += r.applied;
  trainerStats.lastMainMs += performance.now() - t0;
  if (r.applied || job.rows.length) { scheduleSave(); emit(); }
  scheduleIngest();
}

/** Send what changed since the worker last saw this profile's model. */
function featureDelta(s: LearnerState): { features: FeatureRecord[]; drop: string[] } {
  const features: FeatureRecord[] = [];
  const next = new Map<string, object>();
  for (const [id, f] of Object.entries(s.features)) {
    next.set(id, f);
    if (sentFeatures.get(id) !== f) features.push(f);
  }
  const drop: string[] = [];
  for (const id of sentFeatures.keys()) if (!next.has(id)) drop.push(id);
  sentFeatures = next;
  return { features, drop };
}

/** One training step: derive what is new, then train it in the worker or, as a fallback, here in idle slices. */
function pump() {
  if (!cur?.loaded) return;
  const c = cur;
  const t0 = performance.now();
  const now = Date.now();
  const events = pendingInteractions(c.state, sources(getState(), c.pid), now);
  if (!events.length && !rowQueue.length) return;
  const w = ensureWorker();
  if (w) {
    if (inflight) return; // one job at a time: the result reschedules
    try {
      if (workerEpoch !== epoch) {
        sentFeatures = new Map(Object.entries(c.state.features));
        w.postMessage({ t: "init", epoch, state: c.state } satisfies ToWorker);
        workerEpoch = epoch;
      }
      const delta = featureDelta(c.state);
      const rows = rowQueue; rowQueue = [];
      const id = ++jobSeq;
      w.postMessage({ t: "job", epoch, id, ...delta, events, rows, now } satisfies ToWorker);
      inflight = { id, epoch, rows, timer: setTimeout(() => dropWorker("timeout"), WORKER_TIMEOUT_MS) };
      trainerStats.lastMainMs = performance.now() - t0;
    } catch (e) { dropWorker(e instanceof Error ? e.message : String(e)); }
    return;
  }
  // idle-callback fallback (old WebViews, tests, a worker that failed): the same steps, INGEST_BUDGET at a time
  const rows = rowQueue; rowQueue = [];
  const r = runJob(c.state, { events, rows, now }, INGEST_BUDGET);
  trainerStats.applied += r.applied;
  trainerStats.lastMainMs = performance.now() - t0;
  if (r.applied || rows.length) { scheduleSave(); emit(); }
  if (r.done < events.length) scheduleIngest();
}

function scheduleIngest() {
  if (idleHandle !== null || !cur?.loaded) return;
  idleHandle = idle(() => { idleHandle = null; pump(); });
}

/** The model the worker mirrors is no longer valid (new profile, Forget, Reset): stale jobs are dropped. */
function invalidate() {
  epoch++;
  if (inflight) { clearTimeout(inflight.timer); inflight = null; }
  rowQueue = [];
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; if (cur) void saveModel(cur.state); }, 1500);
}

async function activate(pid: string | null) {
  if (cur?.pid === pid) return;
  if (cur && saveTimer) { clearTimeout(saveTimer); saveTimer = null; void saveModel(cur.state); }
  lastParts.clear();
  invalidate();
  if (!pid) { cur = null; emit(); return; }
  cur = { pid, state: emptyState(pid, Date.now()), loaded: false, status: "loading" };
  emit();
  const r = await loadModel(pid);
  if (cur?.pid !== pid) return;
  cur = { pid, state: r.state ?? emptyState(pid, Date.now()), loaded: true, status: r.status };
  invalidate();
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

/** Row outcomes train the ranking weights in the next job (the worker, or the idle fallback). */
function queueRow(r: RowOp) {
  rowQueue.push(r);
  if (rowQueue.length > 200) rowQueue.splice(0, rowQueue.length - 200);
  scheduleIngest();
}

/** A recommended title was on screen in a row. Three sightings without an open is a (weak) skip. */
export function noteShown(id: string) {
  const s = intelState();
  if (!s) return;
  const n = (s.shown[id] = (s.shown[id] ?? 0) + 1);
  if (n === SKIP_AFTER && !s.log.some((e) => e.id === id)) {
    const f = s.features[id];
    const parts = lastParts.get(id);
    if (f && parts) queueRow({ f, parts, chosen: false, now: Date.now() });
  }
}

/** A recommended title was opened from a row: the ranking weights learn from its engine parts. */
export function noteOpened(id: string) {
  const s = intelState();
  if (!s) return;
  const f = s.features[id];
  const parts = lastParts.get(id);
  if (f && parts) queueRow({ f, parts, chosen: true, now: Date.now() });
}

/**
 * Category-level learning (Home feed): a rail was seen, a title was opened from it, or the viewer hid a title there.
 * Counted per profile in the same on-device model; the feed ranks rails by these counts (src/lib/feed/rank.ts).
 * Does not emit: the feed freezes its order for the visit, so rows never move under the D-pad focus.
 */
export function noteCategory(id: string, what: "shown" | "opened" | "played" | "hidden", now = Date.now()) {
  const s = intelState();
  if (!s || !id) return;
  const c = s.categories[id] ?? { shown: 0, opened: 0, played: 0, completed: 0, hidden: 0, at: 0 };
  c[what]++;
  c.at = Math.max(c.at, now);
  s.categories[id] = c;
  scheduleSave();
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
  invalidate();
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
  invalidate();
  await deleteModel(pid);
  await saveModel(s);
  emit();
}

export function resetRuntimeForTest(state?: LearnerState) {
  cur = state ? { pid: state.profileId, state, loaded: true, status: "test" } : null;
  lastParts.clear();
  invalidate();
  emit();
}

/**
 * Tests and diagnostics: swap the worker factory (null = no worker, i.e. the idle fallback), reset the mode, and run
 * the next training step now instead of in idle time.
 */
export function setWorkerFactoryForTest(f: WorkerFactory | null) {
  try { worker?.terminate(); } catch { /* ignore */ }
  worker = null; workerEpoch = -1; sentFeatures = new Map(); inflight = null; rowQueue = [];
  factory = f;
  setMode("auto");
  Object.assign(trainerStats, { jobs: 0, lastJobMs: 0, lastMainMs: 0, failures: 0, applied: 0 });
}
export function trainNowForTest() { if (idleHandle !== null) { clearIdle(idleHandle); idleHandle = null; } pump(); }
export const trainerBusy = () => inflight !== null || rowQueue.length > 0;

function clearIdle(h: number) {
  const cic = (globalThis as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback;
  if (cic) cic(h); else clearTimeout(h as unknown as ReturnType<typeof setTimeout>);
}
