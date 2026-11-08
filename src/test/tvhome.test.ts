import { describe, expect, it, beforeEach } from "vitest";
import { preloadImages, preloadedCount, resetPreload } from "../lib/preload";
import { cardLabel } from "../tv/TvCards";
import type { PandaItem } from "../lib/types";

const item = { id: "movie-1", tmdbId: 1, type: "movie", title: "Dune", year: 2021, rating: 7.84, genres: [], poster: null, backdrop: null, overview: "" } as unknown as PandaItem;

describe("image warm-up", () => {
  beforeEach(() => resetPreload());
  it("dedupes, skips empties and respects the limit", () => {
    expect(preloadImages(["a.jpg", "a.jpg", null, "b.jpg"])).toBe(2);
    expect(preloadImages(["a.jpg", "b.jpg"])).toBe(0);
    expect(preloadImages(["c", "d", "e"], 2)).toBe(2);
    expect(preloadedCount()).toBe(4);
  });
});

describe("card labels", () => {
  it("speaks title, year, kind, rating and position", () => {
    expect(cardLabel(item, [3, 20])).toBe("Dune, 2021, Movie, Rated 7.8, 3 of 20");
    expect(cardLabel({ ...item, type: "tv", rating: 0 } as PandaItem, undefined, "Number 1")).toBe("Dune, 2021, Series, Number 1");
  });
});
