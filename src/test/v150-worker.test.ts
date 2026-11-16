import { afterEach, describe, expect, it } from "vitest";
import { fromItem } from "../lib/intel/features";
import { emptyState, type LearnerState } from "../lib/intel/learner";
import { pendingInteractions } from "../lib/intel/ingest";
import { handleMessage, mergeResult, messageBytes, runJob, type FromWorker, type ToWorker } from "../lib/intel/trainer";
import {
  intelState, noteOpened, rerank, resetRuntimeForTest, setWorkerFactoryForTest, trainerBusy, trainerStats, trainNowForTest
} from "../lib/intel/runtime";
import type { HistoryEntry } from "../lib/store";
import type { PandaItem } from "../lib/types";
import type { Scored } from "../lib/reco/engine";

const NOW = Date.UTC(2026, 10, 15);
const DAY = 24 * 3600_000;
const item = (n: number, o: Partial<PandaItem> = {}): PandaItem => ({
  id: `movie:${n}`, tmdbId: n, type: "movie", title: `T${n}`, year: 2020, rating: 7, poster: "p", posterLarge: null, backdrop: null, backdropLarge: null,
  overview: null, genres: [["Drama", "Comedy", "Action", "Horror"][n % 4]!], language: ["en", "hi", "ko"][n % 3]!, releaseDate: "2020-01-01", ...o
});
const hist = (i: PandaItem, o: Partial<HistoryEntry> = {}): HistoryEntry => ({ item: i, position: 6000, duration: 6000, completed: true, updatedAt: NOW - DAY, ...o });
const sources = (n: number) => ({ history: Object.fromEntries(Array.from({ length: n }, (_, k) => [`movie:${k}`, hist(item(k), { updatedAt: NOW - k * 3600_000 })])), ratings: {}, watchlist: [] });
const clone = <T,>(v: T): T => structuredClone(v);

/** An in-process stand-in for the real Worker: same handler, structured-clone boundary, asynchronous replies. */
class FakeWorker {
  onmessage: ((ev: MessageEvent<FromWorker>) => void) | null = null;
  onerror: ((ev: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  box = { state: null as LearnerState | null, epoch: -1 };
  sent: ToWorker[] = [];
  terminated = false;
  constructor(private mode: "ok" | "throw" | "silent" = "ok") {}
  postMessage(m: ToWorker) {
    this.sent.push(m);
    const copy = clone(m);
    setTimeout(() => {
      if (this.terminated) return;
      if (this.mode === "silent") return;
      if (this.mode === "throw" && copy.t === "job") { this.onerror?.({ message: "boom", preventDefault() {} } as ErrorEvent); return; }
      const r = handleMessage(this.box, copy);
      if (r) this.onmessage?.({ data: clone(r) } as MessageEvent<FromWorker>);
    }, 0);
  }
  terminate() { this.terminated = true; }
}

const flush = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 1)); };

afterEach(() => { setWorkerFactoryForTest(null); resetRuntimeForTest(); });

describe("v1.5.0 training core (worker and fallback run the same steps)", () => {
  it("a worker job merged into the main model equals training in place", () => {
    const a = emptyState("p1", 0), b = emptyState("p1", 0);
    const src = sources(80);
    const ea = pendingInteractions(a, src, NOW), eb = pendingInteractions(b, src, NOW);
    runJob(a, { events: ea, rows: [], now: NOW });
    const box = { state: clone(b), epoch: 1 };
    const r = handleMessage(box, { t: "job", epoch: 1, id: 1, features: [], drop: [], events: eb, rows: [], now: NOW });
    expect(r?.t).toBe("done");
    mergeResult(b, r as Extract<FromWorker, { t: "done" }>);
    expect(Array.from(b.w)).toEqual(Array.from(a.w));
    expect(Array.from(b.shortT)).toEqual(Array.from(a.shortT));
    expect(Array.from(b.longT)).toEqual(Array.from(a.longT));
    expect(b.dense).toEqual(a.dense);
    expect(b.n).toBe(a.n);
    expect(b.log).toEqual(a.log);
    expect(b.applied).toEqual(a.applied);
  });
  it("messages stay small: the result carries only changed weights", () => {
    const s = emptyState("p1", 0);
    const src = sources(30);
    runJob(s, { events: pendingInteractions(s, src, NOW), rows: [], now: NOW });
    const box = { state: clone(s), epoch: 1 };
    const one = { id: "movie:999|complete", kind: "complete" as const, at: NOW, id2: 0 };
    void one;
    const f = { ...fromItem(item(999)), at: NOW };
    const job: ToWorker = { t: "job", epoch: 1, id: 2, features: [f], drop: [], events: [{ id: "movie:999", kind: "complete", at: NOW }], rows: [], now: NOW };
    const r = handleMessage(box, job)!;
    // the four 16k-float vectors would be 256 KB in full; one interaction touches a few hundred slots
    expect(messageBytes(r)).toBeLessThan(40_000);
    expect(messageBytes(job)).toBeLessThan(2_000);
  });
  it("a job for another epoch is refused as stale (profile switched meanwhile)", () => {
    const box = { state: emptyState("p1", 0), epoch: 3 };
    const r = handleMessage(box, { t: "job", epoch: 2, id: 9, features: [], drop: [], events: [], rows: [], now: NOW });
    expect(r).toEqual({ t: "fail", epoch: 2, id: 9, message: "stale" });
  });
});

describe("v1.5.0 runtime training in a Web Worker", () => {
  it("trains through the worker, off the main thread, and the model learns", async () => {
    const w = new FakeWorker();
    setWorkerFactoryForTest(() => w as unknown as Worker);
    const s = emptyState("p1", 0);
    // the runtime reads the active profile's data from the store; feed the same interactions through features
    resetRuntimeForTest(s);
    const src = sources(40);
    for (const h of Object.values(src.history)) s.features[h.item.id] = { ...fromItem(h.item), at: h.updatedAt };
    // queue a row outcome (the one main-thread mutation of weights) and let the worker apply it
    const sc = { c: { item: item(1), trendRank: null }, score: 0, parts: { genre: 1, similar: 0, type: 0, quality: 0.2, popularity: 0, freshness: 0, language: 0 }, reason: null } as unknown as Scored;
    rerank([sc]);
    const before = s.n;
    noteOpened("movie:1");
    expect(trainerBusy()).toBe(true);
    trainNowForTest();
    expect(trainerStats.mode).toBe("worker");
    expect(w.sent[0]!.t).toBe("init");
    expect(w.sent[1]!.t).toBe("job");
    // nothing changed on the main thread yet: the worker has the job
    expect(s.n).toBe(before);
    await flush();
    expect(intelState()!.n).toBeGreaterThan(before);
    expect(trainerStats.jobs).toBe(1);
    expect(trainerBusy()).toBe(false);
  });
  it("drops a stale result when the profile changes mid-job (no cross-profile training)", async () => {
    const w = new FakeWorker();
    setWorkerFactoryForTest(() => w as unknown as Worker);
    const a = emptyState("pA", 0);
    resetRuntimeForTest(a);
    a.features["movie:1"] = { ...fromItem(item(1)), at: 1 };
    const sc = { c: { item: item(1), trendRank: null }, score: 0, parts: { genre: 1 }, reason: null } as unknown as Scored;
    rerank([sc]);
    noteOpened("movie:1");
    trainNowForTest();
    const b = emptyState("pB", 0);
    resetRuntimeForTest(b); // switch profile while A's job is in the worker
    await flush();
    expect(intelState()!.profileId).toBe("pB");
    expect(b.n).toBe(0);
    expect(Array.from(b.w).some((x) => x !== 0)).toBe(false);
  });
  it("falls back to idle-time training when the worker errors, without losing the queued outcome", async () => {
    const w = new FakeWorker("throw");
    setWorkerFactoryForTest(() => w as unknown as Worker);
    const s = emptyState("p1", 0);
    resetRuntimeForTest(s);
    s.features["movie:1"] = { ...fromItem(item(1)), at: 1 };
    rerank([{ c: { item: item(1), trendRank: null }, score: 0, parts: { genre: 1 }, reason: null } as unknown as Scored]);
    noteOpened("movie:1");
    trainNowForTest();
    await flush();
    expect(trainerStats.mode).toBe("idle");
    expect(trainerStats.failures).toBe(1);
    expect(w.terminated).toBe(true);
    trainNowForTest();
    expect(intelState()!.n).toBeGreaterThan(0);
  });
  it("without Worker support (old Android WebViews) it trains on the main thread in idle slices", () => {
    setWorkerFactoryForTest(null);
    const s = emptyState("p1", 0);
    resetRuntimeForTest(s);
    s.features["movie:1"] = { ...fromItem(item(1)), at: 1 };
    rerank([{ c: { item: item(1), trendRank: null }, score: 0, parts: { genre: 1 }, reason: null } as unknown as Scored]);
    noteOpened("movie:1");
    trainNowForTest();
    expect(intelState()!.n).toBe(1);
    expect(trainerStats.mode).not.toBe("worker");
  });
});

describe("worker message hardening", () => {
  it("never writes prototype keys from a job", async () => {
    const { safeKey } = await import("../lib/intel/trainer");
    expect(safeKey("tmdb:movie:1")).toBe(true);
    for (const k of ["__proto__", "constructor", "prototype", 5, null]) expect(safeKey(k)).toBe(false);
  });
});
