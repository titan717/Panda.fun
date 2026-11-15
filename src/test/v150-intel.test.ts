import { describe, expect, it } from "vitest";
import { DIM, featureKeys, fromDetails, fromItem, hash, titleSimilarity, vectorize, type TitleFeatures } from "../lib/intel/features";
import { historyEvents, INTERACTION_WEIGHTS, label } from "../lib/intel/events";
import {
  affinities, applyInteraction, DENSE_PRIOR, emptyState, explainTitle, rememberFeatures, retrainBase, revive, scoreTitle, SCHEMA
} from "../lib/intel/learner";
import { deriveInteractions, ingest } from "../lib/intel/ingest";
import { rerank, resetRuntimeForTest } from "../lib/intel/runtime";
import { generateCandidates, rankCandidates } from "../lib/reco/engine";
import { buildModel } from "../lib/reco/model";
import type { HistoryEntry } from "../lib/store";
import type { PandaItem, TitleDetails } from "../lib/types";

const NOW = Date.UTC(2026, 10, 15);
const DAY = 24 * 3600_000;
const item = (n: number, o: Partial<PandaItem> = {}): PandaItem => ({
  id: `movie:${n}`, tmdbId: n, type: "movie", title: `T${n}`, year: 2020, rating: 7, poster: "p", posterLarge: null, backdrop: null, backdropLarge: null,
  overview: null, genres: ["Drama"], language: "en", releaseDate: "2020-01-01", ...o
});
const feat = (n: number, o: Partial<TitleFeatures> = {}): TitleFeatures => ({ ...fromItem(item(n)), ...o });
const hist = (i: PandaItem, o: Partial<HistoryEntry> = {}): HistoryEntry => ({ item: i, position: 6000, duration: 6000, completed: true, updatedAt: NOW - DAY, ...o });

describe("v1.5.0 content features", () => {
  it("hashes deterministically into the fixed space", () => {
    expect(hash("g:Drama")).toBe(hash("g:Drama"));
    const v = vectorize(feat(1, { directors: [7], cast: [1, 2], collection: 9 }));
    expect(v.idx.every((i) => i >= 0 && i < DIM)).toBe(true);
    expect(Math.hypot(...v.val)).toBeCloseTo(1, 5);
  });
  it("shared director and franchise make titles closer than shared genre alone", () => {
    const a = vectorize(feat(1, { genres: ["Drama"], directors: [7], collection: 9 }));
    const b = vectorize(feat(2, { genres: ["Drama"], directors: [7], collection: 9 }));
    const c = vectorize(feat(3, { genres: ["Drama"], directors: [8] }));
    expect(titleSimilarity(a, b)).toBeGreaterThan(titleSimilarity(a, c));
  });
  it("reads people and the collection from details", () => {
    const d = { ...item(5), originalLanguage: "ko", crew: [{ id: 3, name: "Bong Joon Ho", job: "Director", profile: null }], cast: [{ id: 4, name: "Song Kang-ho", character: null, profile: null }], creators: [], collection: { id: 11, name: "Saga", overview: null, poster: null, backdrop: null, parts: [] } } as unknown as TitleDetails;
    const f = fromDetails(d);
    expect(f.directors).toEqual([3]);
    expect(f.language).toBe("ko");
    expect(featureKeys(f).map(([k]) => k)).toEqual(expect.arrayContaining(["d:3", "c:4", "col:11", "l:ko"]));
    expect(f.names?.["d:3"]).toBe("Bong Joon Ho");
  });
});

describe("v1.5.0 interaction safeguards", () => {
  it("never trains on playback failures, short samples or hides", () => {
    expect(label("playback-failed")).toBeNull();
    expect(label("sample")).toBeNull();
    expect(label("hide")).toBeNull();
    expect(INTERACTION_WEIGHTS.dislike).toBeLessThan(0);
    expect(INTERACTION_WEIGHTS.love).toBeGreaterThan(INTERACTION_WEIGHTS.like);
  });
  it("a short start is a neutral sample, not an abandon", () => {
    expect(historyEvents(hist(item(1), { completed: false, position: 60, duration: 6000, updatedAt: NOW - DAY }), NOW)[0]!.kind).toBe("sample");
  });
  it("only a movie left early for weeks is a (weak) abandon", () => {
    const e = historyEvents(hist(item(1), { completed: false, position: 400, duration: 6000, updatedAt: NOW - 30 * DAY }), NOW)[0]!;
    expect(e.kind).toBe("abandon");
    expect(Math.abs(INTERACTION_WEIGHTS.abandon)).toBeLessThan(0.2);
  });
  it("finished episodes of an unfinished show are positive, never negative", () => {
    const show = item(9, { id: "tv:9", type: "tv" });
    const ev = historyEvents(hist(show, { completed: false, position: 100, duration: 2400, updatedAt: NOW - 40 * DAY, episodes: { "1:1": { p: 1, d: 1, done: true, at: NOW - 40 * DAY }, "1:2": { p: 1, d: 1, done: true, at: NOW - 40 * DAY + 3600_000 }, "1:3": { p: 1, d: 1, done: true, at: NOW - 40 * DAY + 7200_000 } } }), NOW);
    expect(ev.map((e) => e.kind)).toEqual(["episode", "episode", "episode", "binge"]);
    expect(ev.every((e) => INTERACTION_WEIGHTS[e.kind] > 0)).toBe(true);
  });
});

describe("v1.5.0 per-profile learner", () => {
  const train = (likes: TitleFeatures[], dislikes: TitleFeatures[] = [], pool: TitleFeatures[] = []) => {
    const s = emptyState("p1", NOW - 100 * DAY);
    for (const f of [...likes, ...dislikes, ...pool]) rememberFeatures(s, f, 0);
    const ids = Object.keys(s.features);
    likes.forEach((f, n) => applyInteraction(s, { id: f.id, kind: "complete", at: NOW - (likes.length - n) * DAY }, NOW, ids));
    dislikes.forEach((f) => applyInteraction(s, { id: f.id, kind: "dislike", at: NOW - DAY }, NOW, ids));
    return s;
  };
  it("an empty model ranks exactly like the v1.4.0 engine", () => {
    const items = Array.from({ length: 30 }, (_, n) => item(n + 1, { rating: 5 + (n % 5), genres: n % 2 ? ["Comedy"] : ["Drama"], year: 2000 + n }));
    const m = buildModel({ taste: { genres: ["Comedy"], contentType: "both", popularity: "mix", era: "mix" }, history: {}, watchlist: [], ratings: {} });
    const c = generateCandidates({ similar: [], trending: items.slice(0, 10), rails: [{ id: "x", items }] });
    const base = rankCandidates(c, m, { suppressed: new Set(), now: NOW }).map((s) => s.c.item.id);
    const st = emptyState("p1", NOW);
    const re = rankCandidates(c, m, { suppressed: new Set(), now: NOW, rerank: (l) => rerank(l, st, NOW) }).map((s) => s.c.item.id);
    expect(re).toEqual(base);
  });
  it("learns a director it was never told about", () => {
    const likes = [1, 2, 3, 4].map((n) => feat(n, { directors: [77], genres: ["Thriller"] }));
    const pool = Array.from({ length: 20 }, (_, n) => feat(100 + n, { directors: [n], genres: ["Thriller"] }));
    const s = train(likes, [], pool);
    const same = scoreTitle(s, feat(50, { directors: [77], genres: ["Thriller"] }), null, NOW).logit;
    const other = scoreTitle(s, feat(51, { directors: [999], genres: ["Thriller"] }), null, NOW).logit;
    expect(same).toBeGreaterThan(other);
  });
  it("dislikes push similar titles down", () => {
    const s = train([feat(1, { genres: ["Comedy"] })], [feat(2, { genres: ["Horror"], language: "ja" })]);
    expect(scoreTitle(s, feat(3, { genres: ["Horror"], language: "ja" }), null, NOW).logit).toBeLessThan(scoreTitle(s, feat(4, { genres: ["Comedy"] }), null, NOW).logit);
  });
  it("short-term taste follows the latest binge while long-term remembers", () => {
    const s = emptyState("p1", NOW - 400 * DAY);
    const old = [1, 2, 3, 4, 5].map((n) => feat(n, { genres: ["Western"] }));
    const recent = [6, 7, 8].map((n) => feat(n, { genres: ["Animation"], language: "ja" }));
    for (const f of [...old, ...recent]) rememberFeatures(s, f, 0);
    old.forEach((f, n) => applyInteraction(s, { id: f.id, kind: "complete", at: NOW - 200 * DAY + n * DAY }, NOW));
    recent.forEach((f, n) => applyInteraction(s, { id: f.id, kind: "complete", at: NOW - 3 * DAY + n * 3600_000 }, NOW));
    const w = scoreTitle(s, feat(20, { genres: ["Western"] }), null, NOW).dense;
    const a = scoreTitle(s, feat(21, { genres: ["Animation"], language: "ja" }), null, NOW).dense;
    expect(a.tasteShort!).toBeGreaterThan(w.tasteShort!);
    expect(w.tasteLong!).toBeGreaterThan(0);
  });
  it("is deterministic and never double-trains a replayed interaction", () => {
    const a = train([feat(1), feat(2)]), b = train([feat(1), feat(2)]);
    expect(Array.from(a.w.slice(0, 5000))).toEqual(Array.from(b.w.slice(0, 5000)));
    expect(applyInteraction(a, { id: "movie:1", kind: "complete", at: NOW - 2 * DAY }, NOW)).toBe(false);
  });
  it("dense weights start at the engine prior and stay finite", () => {
    const s = train([feat(1), feat(2), feat(3)]);
    for (const [k, v] of Object.entries(s.dense)) expect(Number.isFinite(v), k).toBe(true);
    expect(emptyState("x").dense).toEqual(DENSE_PRIOR);
  });
  it("explains with a real shared feature only", () => {
    const s = train([feat(1, { title: "Arrival", directors: [42], names: { "d:42": "Denis Villeneuve" } }), feat(2, { directors: [42] })], [], [feat(3)]);
    expect(explainTitle(s, feat(9, { directors: [42] }))).toBe("From Denis Villeneuve, director of Arrival");
    expect(explainTitle(s, feat(10, { directors: [5] }))).toBeNull();
  });
  it("Taste DNA lists named affinities from chosen titles", () => {
    const s = train([feat(1, { genres: ["Crime"], language: "ko" }), feat(2, { genres: ["Crime"], language: "ko" })]);
    const keys = affinities(s).map((a) => a.key);
    expect(keys).toEqual(expect.arrayContaining(["g:Crime", "l:ko"]));
    expect(affinities(s).find((a) => a.key === "l:ko")!.name).toBe("Korean");
  });
  it("Taste DNA edits change the ranking", () => {
    const s = train([feat(1)]);
    const before = scoreTitle(s, feat(5, { language: "ta" }), null, NOW).logit;
    s.overrides["l:ta"] = 1;
    expect(scoreTitle(s, feat(5, { language: "ta" }), null, NOW).logit).toBeGreaterThan(before);
  });
  it("a forgotten title is never trained on again", () => {
    const s = train([feat(1), feat(2)]);
    const base = retrainBase(s);
    base.forgotten["movie:1"] = 1;
    expect(applyInteraction(base, { id: "movie:1", kind: "complete", at: NOW }, NOW)).toBe(false);
    expect(applyInteraction(base, { id: "movie:2", kind: "complete", at: NOW }, NOW)).toBe(true);
  });
});

describe("v1.5.0 ingest and storage", () => {
  it("derives interactions from local data and applies only new ones within the budget", () => {
    const s = emptyState("p1", 0);
    const history = Object.fromEntries(Array.from({ length: 10 }, (_, n) => [`movie:${n}`, hist(item(n))]));
    const src = { history, ratings: { "movie:1": "love" as const }, watchlist: [item(50)] };
    expect(deriveInteractions(s, src, NOW).length).toBe(12);
    const r1 = ingest(s, src, NOW, 5);
    expect(r1).toEqual({ applied: 5, more: true });
    const r2 = ingest(s, src, NOW);
    expect(r2.applied).toBe(7);
    expect(ingest(s, src, NOW).applied).toBe(0);
  });
  it("events before a reset are ignored", () => {
    const s = emptyState("p1", 0);
    s.resetAt = NOW;
    expect(ingest(s, { history: { "movie:1": hist(item(1)) }, ratings: {}, watchlist: [] }, NOW).applied).toBe(0);
  });
  it("revive rejects other profiles, newer schemas and corrupt arrays", () => {
    const s = emptyState("p1", 0);
    expect(revive(s, "p1")).not.toBeNull();
    expect(revive(s, "p2")).toBeNull();
    expect(revive({ ...s, schema: SCHEMA + 1 }, "p1")).toBeNull();
    const bad = emptyState("p1", 0); bad.w[0] = NaN;
    expect(revive(bad, "p1")).toBeNull();
    expect(revive({ ...s, w: [1, 2] }, "p1")).toBeNull();
    expect(revive(null, "p1")).toBeNull();
  });
  it("training a long history stays fast on the main thread budget", () => {
    const s = emptyState("p1", 0);
    const history = Object.fromEntries(Array.from({ length: 400 }, (_, n) => [`movie:${n}`, hist(item(n, { genres: [["Drama", "Comedy", "Action", "Horror"][n % 4]!], language: ["en", "hi", "ko"][n % 3]! }), { updatedAt: NOW - n * 3600_000 })]));
    const t0 = performance.now();
    ingest(s, { history, ratings: {}, watchlist: [] }, NOW, 60);
    const ms = performance.now() - t0;
    // one idle slice (60 interactions incl. sampled negatives); generous bound for slow CI machines
    expect(ms).toBeLessThan(250);
    resetRuntimeForTest();
  });
});
