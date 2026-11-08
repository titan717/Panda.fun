import { describe, expect, it } from "vitest";
import { buildPersonalRows, pickSeeds } from "../lib/personal";
import type { HistoryEntry } from "../lib/store";
import type { PandaItem, TitleDetails } from "../lib/types";

const it_ = (n: number, rating = 7): PandaItem => ({ id: `movie:${n}`, tmdbId: n, type: "movie", title: `T${n}`, rating, poster: `p${n}.jpg`, genres: [] }) as unknown as PandaItem;
const hist = (n: number, t: number): HistoryEntry => ({ item: it_(n), updatedAt: t, position: 10, duration: 100 }) as unknown as HistoryEntry;
const det = (ids: number[]) => ({ moreLikeThis: ids.map((n) => it_(n)) }) as unknown as TitleDetails;

describe("personal home seeds", () => {
  it("orders recent history first and skips disliked titles", () => {
    const seeds = pickSeeds({ a: hist(1, 1), b: hist(2, 5), c: hist(3, 3) }, [it_(9)], { "movie:3": "dislike" });
    expect(seeds.map((s) => s.item.tmdbId)).toEqual([2, 1, 9]);
    expect(seeds[2]?.reason).toBe("saved");
  });
  it("caps at five seeds", () => {
    const h = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((n) => [String(n), hist(n, n)]));
    expect(pickSeeds(h, [], {})).toHaveLength(5);
  });
});

describe("personal home rows", () => {
  const seeds = pickSeeds({ a: hist(1, 2), b: hist(2, 1) }, [], {});
  const details = [det([10, 11, 12, 13, 14, 15, 16, 1]), det([20, 21, 22, 23, 24, 25, 10])];
  it("builds Because You Watched rows without seen titles", () => {
    const r = buildPersonalRows(seeds, details, new Set(["movie:1", "movie:2"]), {});
    expect(r.because).toHaveLength(2);
    expect(r.because[0]?.seed.tmdbId).toBe(1);
    expect(r.because[0]?.items.map((i) => i.tmdbId)).not.toContain(1);
  });
  it("ranks titles recommended by several seeds first in Top Picks", () => {
    const r = buildPersonalRows(seeds, details, new Set(), {});
    expect(r.topPicks[0]?.tmdbId).toBe(10);
  });
  it("drops disliked titles and skips thin rows", () => {
    const r = buildPersonalRows(seeds, [det([10, 11, 12]), undefined], new Set(), { "movie:10": "dislike" });
    expect(r.because).toHaveLength(0);
    expect(r.topPicks).toHaveLength(0);
  });
});
