import { DIM, type TitleFeatures } from "./features";
import type { Interaction } from "./events";
import { applyInteraction, applyRowOutcome, eventKey, LEARN, type CategoryStats, type DenseParts, type LearnerState } from "./learner";

/**
 * v1.5.0 Panda Intelligence training core, shared by the Web Worker (src/lib/intel/worker.ts) and the main-thread
 * idle fallback (src/lib/intel/runtime.ts), so both paths run exactly the same deterministic steps:
 *
 *   1. row outcomes (a title opened from a recommendation row, or scrolled past three times), in the order queued;
 *   2. new interactions, oldest first, each with negatives sampled from the profile's sorted title pool.
 *
 * The worker keeps a mirror of the active profile's model. The main thread owns everything that is not trained
 * (title features, Taste DNA edits, category counts, shown counts) and sends only what changed:
 *   main → worker  init {epoch, state}                      (profile activated, model forgotten / reset / recovered)
 *   main → worker  job  {epoch, id, features, drop, events, rows, now}
 *   worker → main  done {epoch, id, deltas for the four weight vectors, dense weights, new log entries, ...}
 *   worker → main  fail {epoch, id, message}
 * A result whose epoch is not the current one (profile switched, model reset) is dropped by the main thread.
 */

export interface RowOp { f: TitleFeatures; parts: Partial<DenseParts>; chosen: boolean; now: number }
export interface TrainJob { events: Interaction[]; rows: RowOp[]; now: number }

/** The negative-sampling pool: sorted, so it does not depend on the order titles were first seen in. */
export const negativePool = (s: LearnerState) => Object.keys(s.features).sort();

/** Run one job on `s` in place. Returns the number of interactions applied. */
export function runJob(s: LearnerState, job: TrainJob, budget = Infinity): { applied: number; done: number } {
  for (const r of job.rows) applyRowOutcome(s, r.f, r.parts, r.chosen, r.now);
  const pool = negativePool(s);
  let applied = 0, done = 0;
  for (const e of job.events) {
    if (done >= budget) break;
    done++;
    if (applyInteraction(s, e, job.now, pool)) applied++;
  }
  return { applied, done };
}

/* ---------------- messages ---------------- */

export interface VecDelta { idx: Uint32Array; val: Float32Array }
export type FeatureRecord = TitleFeatures & { at: number };

export type ToWorker =
  | { t: "init"; epoch: number; state: LearnerState }
  | { t: "job"; epoch: number; id: number; features: FeatureRecord[]; drop: string[]; events: Interaction[]; rows: RowOp[]; now: number };

export interface JobResult {
  t: "done";
  epoch: number;
  id: number;
  w: VecDelta; g2: VecDelta; shortT: VecDelta; longT: VecDelta;
  dense: DenseParts; dg2: DenseParts; bias: number;
  shortAt: number; longAt: number; n: number; updatedAt: number;
  /** interactions newly applied, in order (keys go into `applied`; non-samples into the visible log) */
  newly: Interaction[];
  /** category counts added by these interactions (bumpCategory) */
  cats: Record<string, CategoryStats>;
  applied: number;
  ms: number;
}
export type FromWorker = JobResult | { t: "fail"; epoch: number; id: number; message: string };

const VECS = ["w", "g2", "shortT", "longT"] as const;

function diff(before: Float32Array, after: Float32Array): VecDelta {
  const idx: number[] = [];
  for (let i = 0; i < after.length; i++) if (after[i] !== before[i]) idx.push(i);
  const out = { idx: new Uint32Array(idx.length), val: new Float32Array(idx.length) };
  for (let k = 0; k < idx.length; k++) { out.idx[k] = idx[k]!; out.val[k] = after[idx[k]!]!; }
  return out;
}

/** Keys that would reach Object.prototype when used as a plain-object property name. */
export function safeKey(k: unknown): k is string {
  return typeof k === "string" && k !== "__proto__" && k !== "constructor" && k !== "prototype";
}

/** Worker side: apply one message to the mirror. Pure apart from the mirror it is given; exported for tests. */
export function handleMessage(box: { state: LearnerState | null; epoch: number }, m: ToWorker, clock: () => number = () => Date.now()): FromWorker | null {
  if (m.t === "init") { box.state = m.state; box.epoch = m.epoch; return null; }
  const s = box.state;
  if (!s || m.epoch !== box.epoch) return { t: "fail", epoch: m.epoch, id: m.id, message: "stale" };
  const t0 = clock();
  for (const id of m.drop) if (safeKey(id)) delete s.features[id];
  for (const f of m.features) if (safeKey(f.id)) s.features[f.id] = f;
  const before = { w: s.w.slice(), g2: s.g2.slice(), shortT: s.shortT.slice(), longT: s.longT.slice() };
  const cats: Record<string, CategoryStats> = JSON.parse(JSON.stringify(s.categories));
  const was = m.events.map((e) => Boolean(s.applied[eventKey(e)]));
  const r = runJob(s, { events: m.events, rows: m.rows, now: m.now });
  const newly = m.events.filter((e, i) => !was[i] && s.applied[eventKey(e)]);
  const catDelta: Record<string, CategoryStats> = {};
  for (const [id, c] of Object.entries(s.categories)) {
    if (!safeKey(id)) continue;
    const b = cats[id] ?? { shown: 0, opened: 0, played: 0, completed: 0, hidden: 0, at: 0 };
    if (c.opened !== b.opened || c.played !== b.played || c.completed !== b.completed || c.hidden !== b.hidden || c.at !== b.at) {
      catDelta[id] = { shown: 0, opened: c.opened - b.opened, played: c.played - b.played, completed: c.completed - b.completed, hidden: c.hidden - b.hidden, at: c.at };
    }
  }
  return {
    t: "done", epoch: m.epoch, id: m.id,
    w: diff(before.w, s.w), g2: diff(before.g2, s.g2), shortT: diff(before.shortT, s.shortT), longT: diff(before.longT, s.longT),
    dense: { ...s.dense }, dg2: { ...s.dg2 }, bias: s.bias, shortAt: s.shortAt, longAt: s.longAt, n: s.n, updatedAt: s.updatedAt,
    newly, cats: catDelta, applied: r.applied, ms: clock() - t0
  };
}

/** Transferable buffers of a result (zero-copy postMessage). */
export const transferables = (r: FromWorker): ArrayBuffer[] => (r.t === "done" ? VECS.flatMap((k) => [r[k].idx.buffer as ArrayBuffer, r[k].val.buffer as ArrayBuffer]) : []);

/** Main side: merge a worker result into the authoritative model (the trained fields only). */
export function mergeResult(s: LearnerState, r: JobResult) {
  for (const k of VECS) {
    const v = s[k], d = r[k];
    if (v.length !== DIM) continue;
    for (let i = 0; i < d.idx.length; i++) v[d.idx[i]!] = d.val[i]!;
  }
  s.dense = r.dense; s.dg2 = r.dg2; s.bias = r.bias;
  s.shortAt = r.shortAt; s.longAt = r.longAt; s.n = r.n; s.updatedAt = Math.max(s.updatedAt, r.updatedAt);
  for (const e of r.newly) {
    s.applied[eventKey(e)] = 1;
    if (e.kind !== "sample") s.log.push(e);
  }
  if (s.log.length > LEARN.logMax) s.log.splice(0, s.log.length - LEARN.logMax);
  for (const [id, d] of Object.entries(r.cats)) {
    const c = s.categories[id] ?? { shown: 0, opened: 0, played: 0, completed: 0, hidden: 0, at: 0 };
    c.opened += d.opened; c.played += d.played; c.completed += d.completed; c.hidden += d.hidden; c.at = Math.max(c.at, d.at);
    s.categories[id] = c;
  }
}

/** Approximate size of a message in bytes (for the benchmark and the docs). */
export function messageBytes(m: unknown): number {
  let n = 0;
  const walk = (v: unknown) => {
    if (v == null) return;
    if (ArrayBuffer.isView(v)) { n += v.byteLength; return; }
    if (typeof v === "string") { n += v.length * 2; return; }
    if (typeof v === "number" || typeof v === "boolean") { n += 8; return; }
    if (Array.isArray(v)) { for (const x of v) walk(x); return; }
    if (typeof v === "object") for (const [k, x] of Object.entries(v as Record<string, unknown>)) { n += k.length * 2; walk(x); }
  };
  walk(m);
  return n;
}
