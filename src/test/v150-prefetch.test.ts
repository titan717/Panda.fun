import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyState } from "../lib/intel/learner";
import { fromItem } from "../lib/intel/features";
import { intelState, resetRuntimeForTest } from "../lib/intel/runtime";
import {
  CONCURRENCY, MAX_PER_RUN, MAX_PER_SESSION, cancelPrefetch, detailCandidates, prefetchIdle, prefetchStats, resetPrefetchForTest, schedulePrefetch, setDetailsCache
} from "../lib/intel/prefetch";
import type { PandaItem, TitleDetails } from "../lib/types";

const item = (n: number): PandaItem => ({ id: `movie:${n}`, tmdbId: n, type: "movie", title: `T${n}`, year: 2020, rating: 7, poster: "p", posterLarge: null, backdrop: null, backdropLarge: null, overview: null, genres: ["Drama"], language: "en", releaseDate: "2020-01-01" });
const details = (n: number): TitleDetails => ({ ...item(n), crew: [{ id: 9, name: "Dir", job: "Director" }], cast: [{ id: 7, name: "Act", character: "X" }], directors: [{ id: 9, name: "Dir" }] } as unknown as TitleDetails);
const src = (n: number) => ({ history: Object.fromEntries(Array.from({ length: n }, (_, k) => [`movie:${k}`, { item: item(k), updatedAt: 1000 + k }])), ratings: {}, watchlist: [] });

afterEach(() => { resetPrefetchForTest(); setDetailsCache(null); resetRuntimeForTest(); vi.useRealTimers(); });

describe("v1.5.0 details prefetch", () => {
  it("picks recently watched titles that lack people first, and skips titles that already have them", () => {
    const s = emptyState("p", 0);
    s.features["movie:4"] = { ...fromItem(item(4)), directors: [9], cast: [7], at: 1 } as never;
    const c = detailCandidates(s, src(6));
    expect(c[0]).toBe("movie:5");
    expect(c).not.toContain("movie:4");
  });
  it("fetches at most MAX_PER_RUN, CONCURRENCY at a time, never twice, and reuses cached details", async () => {
    const s = emptyState("p", 0);
    resetRuntimeForTest(s);
    let active = 0, peak = 0;
    const calls: string[] = [];
    resetPrefetchForTest(async (path) => {
      calls.push(path); active++; peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 3));
      active--;
      return details(Number(path.split("/").pop()));
    });
    const cached = new Map<string, TitleDetails>([["/panda/title/movie/39", details(39)]]);
    setDetailsCache({ get: (k) => cached.get(k), put: (k, d) => cached.set(k, d) });
    expect(schedulePrefetch(src(40), 0)).toBe(true);
    await prefetchIdle();
    expect(prefetchStats.reused).toBe(1);
    expect(calls.length).toBe(MAX_PER_RUN - 1);
    expect(peak).toBeLessThanOrEqual(CONCURRENCY);
    expect(calls).not.toContain("/panda/title/movie/39");
    // the model learned the people of the fetched titles
    expect(intelState()!.features["movie:38"]?.directors?.length).toBeGreaterThan(0);
    // a second run does not refetch the same titles
    schedulePrefetch(src(40), 0);
    await prefetchIdle();
    expect(new Set(calls).size).toBe(calls.length);
    expect(calls.length).toBeLessThanOrEqual(MAX_PER_SESSION);
  });
  it("cancelling (profile switch) aborts in-flight requests and stores nothing", async () => {
    const s = emptyState("p", 0);
    resetRuntimeForTest(s);
    const signals: AbortSignal[] = [];
    resetPrefetchForTest((_path, signal) => new Promise((resolve, reject) => {
      signals.push(signal);
      signal.addEventListener("abort", () => reject(new Error("aborted")));
      setTimeout(() => resolve(details(1)), 50);
    }));
    schedulePrefetch(src(10), 0);
    await new Promise((r) => setTimeout(r, 5));
    expect(signals.length).toBe(CONCURRENCY);
    cancelPrefetch();
    await prefetchIdle();
    await new Promise((r) => setTimeout(r, 60));
    expect(signals.every((x) => x.aborted)).toBe(true);
    expect(prefetchStats.fetched).toBe(0);
  });
  it("does nothing on Data Saver or a 1 GB device", () => {
    const conn = Object.getOwnPropertyDescriptor(navigator, "connection");
    Object.defineProperty(navigator, "connection", { value: { saveData: true }, configurable: true });
    expect(schedulePrefetch(src(5), 0)).toBe(false);
    if (conn) Object.defineProperty(navigator, "connection", conn); else delete (navigator as { connection?: unknown }).connection;
    Object.defineProperty(navigator, "deviceMemory", { value: 1, configurable: true });
    expect(schedulePrefetch(src(5), 0)).toBe(false);
    delete (navigator as { deviceMemory?: unknown }).deviceMemory;
  });
});
