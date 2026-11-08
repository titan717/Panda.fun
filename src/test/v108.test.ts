import { describe, expect, it } from "vitest";
import { actions, continueWatching, getState, selectData } from "../lib/store";
import { sortList } from "../lib/lists";
import { isKidsSafeTitle } from "../lib/rows";
import { continueHref, continueSub } from "../tv/TvCards";
import type { PandaItem } from "../lib/types";

const show = { id: "tv:1396", tmdbId: 1396, type: "tv", title: "Breaking Bad", genres: ["Drama"] } as unknown as PandaItem;
const mk = (id: string, title: string, type: "movie" | "tv", releaseDate: string) => ({ id, tmdbId: 1, type, title, releaseDate, genres: [] }) as unknown as PandaItem;

describe("Continue Watching: Next Episode", () => {
  it("queues the next episode when one finishes", () => {
    const p = actions.addProfile("Binger", "star", false);
    actions.selectProfile(p.id);
    actions.saveProgress(show, { position: 2900, duration: 3000, season: 1, episode: 3, next: { season: 1, episode: 4 } });
    const h = selectData(getState()).history[show.id]!;
    expect(h).toMatchObject({ season: 1, episode: 4, position: 0, upNext: true, completed: false });
    const cw = continueWatching(selectData(getState()).history);
    expect(cw.map((x) => x.item.id)).toContain(show.id);
    expect(continueSub(h)).toBe("Next Episode • S1 E4");
    expect(continueHref(h)).not.toContain("t=");
  });
  it("marks the show completed when there is no next episode", () => {
    actions.saveProgress(show, { position: 2950, duration: 3000, season: 5, episode: 16, next: null });
    const h = selectData(getState()).history[show.id]!;
    expect(h.completed).toBe(true);
    expect(continueWatching(selectData(getState()).history).map((x) => x.item.id)).not.toContain(show.id);
  });
});

describe("Watchlist filter and sort", () => {
  const list = [mk("a", "zebra", "movie", "2020-01-01"), mk("b", "Apple", "tv", "2024-05-01"), mk("c", "mango", "movie", "2022-03-01")];
  it("keeps recently added order by default", () => { expect(sortList(list, "all", "recent").map((i) => i.id)).toEqual(["a", "b", "c"]); });
  it("sorts A–Z ignoring case", () => { expect(sortList(list, "all", "az").map((i) => i.title)).toEqual(["Apple", "mango", "zebra"]); });
  it("sorts by newest release", () => { expect(sortList(list, "all", "release").map((i) => i.id)).toEqual(["b", "c", "a"]); });
  it("filters by type without changing the stored list", () => {
    expect(sortList(list, "movie", "recent").map((i) => i.id)).toEqual(["a", "c"]);
    expect(list.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
});

describe("Kids gate", () => {
  it("allows family titles with a kid rating", () => { expect(isKidsSafeTitle({ genres: ["Animation", "Family"], certification: "PG" })).toBe(true); });
  it("blocks mature ratings even for animation", () => {
    expect(isKidsSafeTitle({ genres: ["Animation"], certification: "R" })).toBe(false);
    expect(isKidsSafeTitle({ genres: ["Animation"], certification: "TV-MA" })).toBe(false);
  });
  it("blocks titles outside the kids genres", () => { expect(isKidsSafeTitle({ genres: ["Drama"], certification: null })).toBe(false); });
});
