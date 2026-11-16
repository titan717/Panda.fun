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
