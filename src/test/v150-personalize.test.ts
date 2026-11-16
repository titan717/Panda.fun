import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { fromItem } from "../lib/intel/features";
import { applyInteraction, emptyState, rememberFeatures, type LearnerState } from "../lib/intel/learner";
import { hasSignal, personalOrder, personalOrderPinned, usePersonalPages } from "../lib/intel/personalize";
import { searchOrder, sortResults } from "../lib/useSearchState";
import type { PandaItem } from "../lib/types";

const NOW = Date.UTC(2026, 10, 15);
const DAY = 86_400_000;
const item = (n: number, o: Partial<PandaItem> = {}): PandaItem => ({
  id: `movie:${n}`, tmdbId: n, type: "movie", title: `T${n}`, year: 2020, rating: 7, poster: "p", backdrop: null, overview: "", genres: ["Drama"], language: "en", releaseDate: "2020-01-01", ...o
} as PandaItem);

function horrorFan(): LearnerState {
  const s = emptyState("p", 0);
  for (let k = 0; k < 40; k++) {
    const it = item(500 + k, { genres: ["Horror"] });
    rememberFeatures(s, fromItem(it), NOW - (40 - k) * DAY);
    applyInteraction(s, { id: it.id, kind: "complete", at: NOW - (40 - k) * DAY }, NOW - (40 - k) * DAY, Object.keys(s.features).sort());
  }
  return s;
}
const list = Array.from({ length: 12 }, (_, k) => item(k + 1, { genres: k >= 8 ? ["Horror"] : ["Comedy"], title: k === 10 ? "Dune Part Two" : `T${k + 1}` }));

describe("v1.5.0 personal ordering outside Home", () => {
  it("never changes membership and keeps the catalogue order without evidence", () => {
    expect(hasSignal(emptyState("p", 0))).toBe(false);
    expect(personalOrder(list, null)).toEqual(list);
    expect(personalOrder(list, emptyState("p", 0))).toEqual(list);
    const s = horrorFan();
    const out = personalOrder(list, s, 0.5, NOW);
    expect(new Set(out.map((i) => i.id))).toEqual(new Set(list.map((i) => i.id)));
    expect(out.length).toBe(list.length);
    // taste lifts the horror titles, but it is a blend, not a re-sort
    expect(out.slice(0, 6).some((i) => i.genres.includes("Horror"))).toBe(true);
    expect(out.indexOf(list[0]!)).toBeLessThan(6);
  });

  it("pinned items stay first and in order", () => {
    const s = horrorFan();
    const out = personalOrderPinned(list, (_, i) => i < 2, s, 0.5, NOW);
    expect(out.slice(0, 2)).toEqual(list.slice(0, 2));
  });

  it("search keeps the backend's top 3 and every title match first; explicit sorts are exact", () => {
    const s = horrorFan();
    for (const it of list) rememberFeatures(s, fromItem(it), NOW);
    const out = searchOrder(list, "dune", s);
    expect(out.slice(0, 4).map((i) => i.tmdbId)).toEqual([1, 2, 3, 11]);
    expect(searchOrder(list, "dune", emptyState("p", 0))).toBe(list);
    const byRating = sortResults(list.map((i, k) => ({ ...i, rating: k })), "rating");
    expect(byRating[0]!.rating).toBe(11);
  });

  it("paged grids personalise each page once and never reshuffle shown pages", () => {
    const p1 = list.slice(0, 6), p2 = list.slice(6);
    const { result, rerender } = renderHook(({ pages, on }) => usePersonalPages(pages, on), { initialProps: { pages: [p1], on: true } });
    const first = result.current.map((i) => i.id);
    rerender({ pages: [p1, p2], on: true });
    expect(result.current.slice(0, 6).map((i) => i.id)).toEqual(first);
    expect(result.current).toHaveLength(12);
    rerender({ pages: [p1, p2], on: false });
    expect(result.current.map((i) => i.id)).toEqual(list.map((i) => i.id));
  });
});

describe("v1.5.0 Surprise Me", () => {
  it("skips ignored, unreleased and watched titles, avoids recent repeats and stays taste-weighted", async () => {
    const { pickSurprise, resetSurpriseForTest, surpriseCandidates, IGNORED_AFTER } = await import("../lib/intel/surprise");
    resetSurpriseForTest();
    const s = horrorFan();
    const cands = Array.from({ length: 10 }, (_, k) => item(900 + k, { genres: k < 5 ? ["Horror"] : ["Comedy"], rating: 7.5 }));
    for (const c of cands) rememberFeatures(s, fromItem(c), NOW);
    rememberFeatures(s, fromItem(item(990, { year: 2031, rating: 8 })), NOW);
    s.shown["movie:900"] = IGNORED_AFTER;
    const ids = surpriseCandidates(s, { exclude: new Set(["movie:901"]), kids: false, now: NOW }).map((x) => x.f.id);
    expect(ids).not.toContain("movie:900");
    expect(ids).not.toContain("movie:901");
    expect(ids).not.toContain("movie:990");
    expect(ids.some((id) => id.startsWith("movie:5"))).toBe(false); // already watched
    const picks = Array.from({ length: 6 }, () => pickSurprise(s, { exclude: new Set(), kids: false, now: NOW, rand: () => 0 })!.id);
    expect(new Set(picks).size).toBe(6);
    // with rand at 0 the strongest fresh match comes first: the profile loves horror
    resetSurpriseForTest();
    const top = pickSurprise(s, { exclude: new Set(), kids: false, now: NOW, rand: () => 0 })!;
    expect(top.genres).toContain("Horror");
  });
});

describe("v1.5.0 explanations need real evidence", () => {
  it("genre streak only with 3+ recent finishes; franchise says Next only after the watched part", async () => {
    const { explainTitle } = await import("../lib/intel/learner");
    const few = emptyState("p", 0);
    for (let k = 0; k < 2; k++) { const it = item(700 + k, { genres: ["Thriller"] }); rememberFeatures(few, fromItem(it), NOW - k * DAY); applyInteraction(few, { id: it.id, kind: "complete", at: NOW - k * DAY }, NOW, Object.keys(few.features).sort()); }
    expect(explainTitle(few, fromItem(item(1, { genres: ["Thriller"], language: null })))).toBeNull();
    const many = horrorFan();
    expect(explainTitle(many, { ...fromItem(item(2, { genres: ["Horror"] })), language: null })).toMatch(/^You've enjoyed \d+ horror titles lately$/);
    const s = emptyState("p", 0);
    const watchedPart = { ...fromItem(item(800, { year: 2015 })), collection: 5, collectionName: "Saga" };
    rememberFeatures(s, watchedPart, NOW); applyInteraction(s, { id: watchedPart.id, kind: "complete", at: NOW }, NOW, Object.keys(s.features).sort());
    expect(explainTitle(s, { ...fromItem(item(801, { year: 2019 })), collection: 5, collectionName: "Saga" })).toMatch(/^Next in/);
    expect(explainTitle(s, { ...fromItem(item(802, { year: 2010 })), collection: 5, collectionName: "Saga" })).toMatch(/^Also in/);
  });
});

describe("v1.5.0 Smart Continue Watching", () => {
  it("orders by likely resume, keeps one entry per title and sinks abandoned shows without removing them", async () => {
    const { continueWatching } = await import("../lib/store");
    const H = 3600_000;
    const tv = (n: number) => item(n, { type: "tv", id: `tv:${n}` } as Partial<PandaItem>);
    const history = {
      "movie:1": { item: item(1), position: 3000, duration: 6000, completed: false, updatedAt: NOW - 5 * H },
      "movie:2": { item: item(2), position: 6000, duration: 6000, completed: true, updatedAt: NOW - H },
      "tv:3": { item: tv(3), position: 0, duration: 0, completed: false, upNext: true, season: 1, episode: 4, updatedAt: NOW - 100 * DAY },
      "tv:4": { item: tv(4), position: 0, duration: 0, completed: false, upNext: true, season: 2, episode: 1, updatedAt: NOW - 2 * DAY },
      "movie:5": { item: item(5), position: 300, duration: 6000, completed: false, updatedAt: NOW - 30 * DAY }
    } as never;
    const ids = continueWatching(history, NOW).map((h) => h.item.id);
    expect(ids).not.toContain("movie:2");
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.slice(0, 2)).toEqual(["movie:1", "tv:4"]);
    expect(ids).toContain("tv:3");
    expect(ids.indexOf("tv:3")).toBeGreaterThan(ids.indexOf("tv:4"));
  });
});

describe("v1.5.0 Taste DNA evolution", () => {
  it("reports a rising and a fading interest only when the history shows it", async () => {
    const { tasteEvolution } = await import("../lib/intel/learner");
    expect(tasteEvolution(emptyState("p", 0))).toEqual({ emerging: [], fading: [] });
    const s = emptyState("p", 0);
    const add = (n: number, g: string, at: number) => { const it = item(n, { genres: [g] }); rememberFeatures(s, fromItem(it), at); applyInteraction(s, { id: it.id, kind: "complete", at }, at, Object.keys(s.features).sort()); };
    for (let k = 0; k < 30; k++) add(1000 + k, "Horror", NOW - (200 - k) * DAY);
    for (let k = 0; k < 12; k++) add(2000 + k, "Comedy", NOW - (12 - k) * DAY);
    const e = tasteEvolution(s);
    expect(e.emerging.map((d) => d.key)).toContain("g:Comedy");
    expect(e.fading.map((d) => d.key)).toContain("g:Horror");
  });
});
