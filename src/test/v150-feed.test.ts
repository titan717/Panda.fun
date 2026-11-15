import { describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORY_BY_ID, categoryPath, eligible } from "../lib/feed/catalog";
import { categoryScore, engagement, jitter, rankCategories, type RankContext } from "../lib/feed/rank";
import { BATCH, MIN_ITEMS, buildFeedRows, categoryLink, contextFromModel } from "../lib/feed/useFeed";
import { emptyState } from "../lib/intel/learner";
import { intelState, noteCategory, resetRuntimeForTest } from "../lib/intel/runtime";
import type { PandaItem } from "../lib/types";

const item = (n: number, o: Partial<PandaItem> = {}): PandaItem => ({
  id: `movie:${n}`, tmdbId: n, type: "movie", title: `T${n}`, year: 2020, rating: 7, poster: null, backdrop: null, overview: "", genres: ["Drama"], language: "en", ...o
} as PandaItem);

const ctx = (o: Partial<RankContext> = {}): RankContext => ({
  tasteGenres: [], genreAffinity: new Map(), langAffinity: new Map(), preferredLangs: [], stats: {}, seed: "p1|2026-11-15", ...o
});

describe("v1.5.0 feed category catalogue", () => {
  it("has 89 categories with unique, stable ids", () => {
    expect(CATEGORIES.length).toBe(89);
    expect(new Set(CATEGORIES.map((c) => c.id)).size).toBe(89);
    expect(CATEGORY_BY_ID.get("lang-tv-ko-18")?.title).toBe("Korean Dramas");
  });
  it("builds the same API paths the rest of the app uses (shared cache entries)", () => {
    expect(categoryPath(CATEGORY_BY_ID.get("movie-horror")!)).toBe("/panda/discover/movie?genre=27&page=1");
    expect(categoryPath(CATEGORY_BY_ID.get("combo-ko-thriller")!, 2)).toBe("/panda/discover/movie?genre=53&lang=ko&page=2");
    expect(categoryPath(CATEGORY_BY_ID.get("trending-today")!)).toBe("/panda/trending?type=all&window=day&page=1");
    expect(categoryLink(CATEGORY_BY_ID.get("acclaimed-movie-drama")!)).toBe("/browse/movie?genre=18&sort=vote_average.desc");
  });
  it("Movies and TV pages keep to their type; kids profiles only get kid-friendly rails", () => {
    expect(eligible("movies", false).every((c) => c.source.type === "movie")).toBe(true);
    expect(eligible("tv", false).every((c) => c.source.type === "tv")).toBe(true);
    const kids = eligible("home", true);
    expect(kids.length).toBeGreaterThan(4);
    expect(kids.every((c) => c.genres.length > 0 && c.genres.every((g) => g === "Animation" || g === "Family"))).toBe(true);
  });
});

describe("v1.5.0 category ranking", () => {
  it("is deterministic for a profile and day, and differs between days (exploration)", () => {
    const a = rankCategories(CATEGORIES, ctx()).map((c) => c.id);
    expect(rankCategories(CATEGORIES, ctx()).map((c) => c.id)).toEqual(a);
    expect(rankCategories(CATEGORIES, ctx({ seed: "p1|2026-11-16" })).map((c) => c.id)).not.toEqual(a);
    expect(jitter("a", "b")).toBeGreaterThanOrEqual(0);
    expect(jitter("a", "b")).toBeLessThan(1);
  });
  it("onboarding genres and learned language affinity lift their rails", () => {
    const horror = CATEGORY_BY_ID.get("movie-horror")!;
    expect(categoryScore(horror, ctx({ tasteGenres: ["Horror"] }))).toBeGreaterThan(categoryScore(horror, ctx()) + 0.8);
    const ml = CATEGORY_BY_ID.get("lang-movie-ml")!;
    expect(categoryScore(ml, ctx({ langAffinity: new Map([["ml", 0.8]]) }))).toBeGreaterThan(categoryScore(ml, ctx()) + 0.9);
    const top = rankCategories(CATEGORIES, ctx({ tasteGenres: ["Horror"], langAffinity: new Map([["ml", 0.9]]) })).slice(0, 8).map((c) => c.id);
    expect(top.some((id) => id.includes("horror"))).toBe(true);
    expect(top.some((id) => id.includes("-ml"))).toBe(true);
  });
  it("category-level learning: opens raise a rail, hides and ignored impressions lower it", () => {
    const c = CATEGORY_BY_ID.get("movie-comedy")!;
    const base = categoryScore(c, ctx());
    expect(categoryScore(c, ctx({ stats: { [c.id]: { shown: 6, opened: 4, played: 1, completed: 0, hidden: 0, at: 1 } } }))).toBeGreaterThan(base + 1);
    expect(categoryScore(c, ctx({ stats: { [c.id]: { shown: 20, opened: 0, played: 0, completed: 0, hidden: 0, at: 1 } } }))).toBeLessThan(base);
    expect(categoryScore(c, ctx({ stats: { [c.id]: { shown: 2, opened: 0, played: 0, completed: 0, hidden: 2, at: 1 } } }))).toBeLessThan(base - 1);
    expect(engagement(undefined)).toBe(0);
  });
  it("diversity: neighbouring rails rarely share a family, and never repeat a genre or language within three rails near the top", () => {
    const order = rankCategories(CATEGORIES, ctx({ tasteGenres: ["Thriller"] }));
    let sameFamily = 0;
    for (let i = 1; i < 24; i++) if (order[i]!.family === order[i - 1]!.family) sameFamily++;
    expect(sameFamily).toBeLessThanOrEqual(4);
    for (let i = 1; i < 16; i++) {
      const prev = order.slice(Math.max(0, i - 3), i);
      const c = order[i]!;
      const clash = prev.some((p) => (c.lang && p.lang === c.lang) || p.genres.some((g) => c.genres.includes(g)));
      expect(clash, `${c.id} after ${prev.map((p) => p.id).join(",")}`).toBe(false);
    }
  });
});

describe("v1.5.0 feed rows", () => {
  const list = (from: number, n: number) => Array.from({ length: n }, (_, i) => item(from + i));
  it("never shows a short rail, and removes titles an earlier row already showed", () => {
    const rows = buildFeedRows([[
      { id: "movie-drama", items: list(1, 12) },
      { id: "movie-comedy", items: [...list(1, 8), ...list(100, 3)] }, // only 3 new titles: dropped
      { id: "movie-horror", items: list(200, 30) }
    ]], ["movie:200", "movie:201"], () => true);
    expect(rows.map((r) => r.cat)).toEqual(["movie-drama", "movie-horror"]);
    expect(rows[1]!.items.length).toBe(20);
    expect(rows[1]!.items.some((i) => i.id === "movie:200")).toBe(false);
    const all = rows.flatMap((r) => r.items.map((i) => i.id));
    expect(new Set(all).size).toBe(all.length);
    expect(MIN_ITEMS).toBeGreaterThanOrEqual(6);
    expect(BATCH).toBeGreaterThan(1);
  });
  it("applies the profile filter (hidden, disliked, kids) before counting", () => {
    const rows = buildFeedRows([[{ id: "movie-drama", items: list(1, 10) }]], [], (i) => i.tmdbId > 5);
    expect(rows).toEqual([]);
  });
  it("an unknown or failed category contributes nothing", () => {
    expect(buildFeedRows([[{ id: "nope", items: list(1, 10) }, { id: "movie-drama", items: [] }]], [], () => true)).toEqual([]);
  });
});

describe("v1.5.0 category learning is stored in the profile's model", () => {
  it("counts impressions, opens and hides per category", () => {
    resetRuntimeForTest(emptyState("p1", 1));
    noteCategory("movie-drama", "shown");
    noteCategory("movie-drama", "shown");
    noteCategory("movie-drama", "opened");
    noteCategory("movie-horror", "hidden");
    const s = intelState()!;
    expect(s.categories["movie-drama"]).toMatchObject({ shown: 2, opened: 1 });
    expect(s.categories["movie-horror"]).toMatchObject({ hidden: 1 });
    const m = contextFromModel(s);
    expect(m.stats["movie-drama"]?.shown).toBe(2);
  });
});

describe("v1.5.0 moods, hidden gems and the session assistant", () => {
  it("recognises moods in free-text searches and never matches inside other words", async () => {
    const { parseMood } = await import("../lib/intel/moods");
    expect(parseMood("something scary for tonight")?.id).toBe("scary");
    expect(parseMood("a feel good movie")?.id).toBe("feel-good");
    expect(parseMood("mind-bending sci fi")?.id).toBe("mind-bending");
    expect(parseMood("the matrix")).toBeNull();
    expect(parseMood("scaryland")).toBeNull();
  });
  it("suggests moods from the local clock only, kid-safe on kids profiles", async () => {
    const { sessionMoods, daypart } = await import("../lib/intel/moods");
    const late = new Date(2026, 10, 18, 23, 30), morning = new Date(2026, 10, 18, 8, 0), sat = new Date(2026, 10, 21, 19, 0);
    expect(daypart(late)).toBe("late");
    expect(sessionMoods(late)[0]).toBe("scary");
    expect(sessionMoods(morning)[0]).toBe("feel-good");
    expect(sessionMoods(sat)).toContain("family");
    expect(sessionMoods(late, true)).toEqual([]);
    expect(sessionMoods(sat, true)).toEqual(["family"]);
  });
  it("boosts the mood rails that suit the moment", () => {
    const base = rankCategories(CATEGORIES, ctx()).map((c) => c.id);
    const late = rankCategories(CATEGORIES, { ...ctx(), sessionMoods: ["scary", "mind-bending"] }).map((c) => c.id);
    expect(late.indexOf("mood-scary")).toBeLessThan(base.indexOf("mood-scary"));
  });
  it("hidden gems skip the first pages of top rated and drop titles under their rating floor", () => {
    const gems = CATEGORY_BY_ID.get("gems-movies")!;
    expect(categoryPath(gems)).toBe("/panda/discover/movie?sort=vote_average.desc&page=6");
    expect(categoryPath(gems, 2)).toBe("/panda/discover/movie?sort=vote_average.desc&page=7");
    const items = Array.from({ length: 10 }, (_, i) => ({ id: `movie:${i}`, title: `T${i}`, type: "movie", rating: i < 4 ? 6.1 : 7.4 }) as never);
    const rows = buildFeedRows([[{ id: "gems-movies", items }]], [], () => true);
    expect(rows[0]!.items.length).toBe(6);
  });
});
