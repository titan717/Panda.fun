import { describe, expect, it } from "vitest";
import { fromItem } from "../lib/intel/features";
import { emptyState, type LearnerState } from "../lib/intel/learner";
import { pendingInteractions } from "../lib/intel/ingest";
import { handleMessage, mergeResult, messageBytes, runJob, type JobResult, type ToWorker } from "../lib/intel/trainer";
import { INGEST_BUDGET } from "../lib/intel/runtime";
import type { HistoryEntry } from "../lib/store";
import type { PandaItem } from "../lib/types";

/**
 * v1.5.0 training benchmark: main-thread cost of training before (v1.5.0 draft: idle-callback slices on the main
 * thread) and after (Web Worker; the main thread only builds the job, serialises it and merges the sparse result).
 * Synthetic histories, measured in Node (vitest), so absolute numbers are a desktop-class CPU; a low-end TV is
 * several times slower, which is exactly why the work moved off the main thread. Run with EVAL_WRITE=1 to refresh
 * docs/eval/worker-bench.json.
 */
const NOW = Date.UTC(2026, 10, 15);
const GEN = ["Drama", "Comedy", "Action", "Horror", "Thriller", "Animation", "Romance", "Crime"];
const item = (n: number): PandaItem => ({
  id: `movie:${n}`, tmdbId: n, type: "movie", title: `T${n}`, year: 1980 + (n % 45), rating: 5 + (n % 5), poster: "p", posterLarge: null, backdrop: null, backdropLarge: null,
  overview: null, genres: [GEN[n % 8]!, GEN[(n * 3) % 8]!], language: ["en", "hi", "ko", "ja", "ta"][n % 5]!, releaseDate: "2020-01-01",
  directors: [{ id: 1000 + (n % 17), name: `D${n % 17}` }], cast: [{ id: 2000 + (n % 31), name: `A${n % 31}` }, { id: 2000 + ((n * 7) % 31), name: `B${n}` }]
} as unknown as PandaItem);
const sources = (n: number) => ({
  history: Object.fromEntries(Array.from({ length: n }, (_, k) => [`movie:${k}`, { item: item(k), position: 6000, duration: 6000, completed: k % 3 !== 0, updatedAt: NOW - k * 3600_000 } as HistoryEntry])),
  ratings: {}, watchlist: []
});
const seeded = (n: number): LearnerState => {
  const s = emptyState("p", 0);
  for (let k = 0; k < n + 200; k++) s.features[`movie:${k}`] = { ...fromItem(item(k)), at: k };
  return s;
};
const time = (f: () => void, reps = 5) => {
  const xs: number[] = [];
  for (let i = 0; i < reps; i++) { const t = performance.now(); f(); xs.push(performance.now() - t); }
  xs.sort((a, b) => a - b);
  return +xs[Math.floor(xs.length / 2)]!.toFixed(2);
};

declare const process: { env: Record<string, string | undefined>; cwd(): string };
const report: Record<string, unknown> = { note: "synthetic histories, Node/vitest timing (median of 5); main-thread milliseconds", sizes: {} };

describe("v1.5.0 worker benchmark (synthetic)", () => {
  for (const n of [50, 300, 1000]) {
    it(`history of ${n}: the worker path keeps the main thread to building, posting and merging`, () => {
      const src = sources(n);
      // before: the idle fallback trains on the main thread, INGEST_BUDGET interactions per idle slice
      let slices = 0, longest = 0;
      const total = time(() => {
        const s = seeded(n);
        slices = 0; longest = 0;
        for (;;) {
          const ev = pendingInteractions(s, src, NOW);
          if (!ev.length) break;
          const t = performance.now();
          runJob(s, { events: ev, rows: [], now: NOW }, INGEST_BUDGET);
          longest = Math.max(longest, performance.now() - t);
          slices++;
        }
      }, 3);
      // after: one job; the main thread pays for pendingInteractions + structured clone of the job + merge
      const s0 = seeded(n);
      const ev = pendingInteractions(s0, src, NOW);
      const job: ToWorker = { t: "job", epoch: 1, id: 1, features: [], drop: [], events: ev, rows: [], now: NOW };
      const initMsg: ToWorker = { t: "init", epoch: 1, state: s0 };
      const initClone = time(() => { structuredClone(initMsg); });
      const box = { state: structuredClone(s0), epoch: 1 };
      const tw = performance.now();
      const r = handleMessage(box, structuredClone(job)) as JobResult;
      const workerMs = performance.now() - tw;
      const build = time(() => { pendingInteractions(s0, src, NOW); });
      const post = time(() => { structuredClone(job); });
      const merge = time(() => { mergeResult(structuredClone(s0), r); }, 3) - time(() => { structuredClone(s0); }, 3);
      const row = {
        interactions: ev.length,
        before: { mainThreadTotalMs: total, idleSlices: slices, longestSliceMs: +longest.toFixed(2) },
        after: {
          workerMs: +workerMs.toFixed(2),
          mainThread: { buildJobMs: build, postJobMs: post, mergeResultMs: +Math.max(0, merge).toFixed(2), oneTimeInitCloneMs: initClone },
          bytes: { init: messageBytes(initMsg), job: messageBytes(job), result: messageBytes(r) }
        }
      };
      (report.sizes as Record<string, unknown>)[String(n)] = row;
      expect(r.t).toBe("done");
      expect(row.after.bytes.result).toBeLessThan(row.after.bytes.init);
    });
  }
  it("writes docs/eval/worker-bench.json when EVAL_WRITE=1", async () => {
    if (!process.env.EVAL_WRITE) return;
    const fs = (await import(/* @vite-ignore */ ["node", "fs"].join(":"))) as { writeFileSync(p: string, d: string): void };
    fs.writeFileSync(`${process.cwd()}/docs/eval/worker-bench.json`, JSON.stringify(report, null, 2) + "\n");
  });
});
