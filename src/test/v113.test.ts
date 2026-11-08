import { describe, expect, it } from "vitest";
import { actions, getState, MAX_LISTS, selectData, uniqueListName } from "../lib/store";
import type { PandaItem } from "../lib/types";

const a = { id: "movie-550", tmdbId: 550, type: "movie", title: "Fight Club", poster: "/p.jpg" } as unknown as PandaItem;
const b = { id: "tv-1396", tmdbId: 1396, type: "tv", title: "Breaking Bad" } as unknown as PandaItem;
const data = () => selectData(getState());

describe("Watchlist 2.0", () => {
  it("names lists uniquely, case-insensitively", () => {
    expect(uniqueListName("Weekend", [])).toBe("Weekend");
    expect(uniqueListName("weekend", [{ name: "Weekend" }, { name: "weekend 2" }])).toBe("weekend 3");
  });

  it("creates, fills, renames and deletes lists per profile", () => {
    const p = actions.addProfile("Lists", "panda", false);
    actions.selectProfile(p.id);
    const l = actions.createList("  Date   Night ", a)!;
    expect(l.name).toBe("Date Night");
    expect(data().lists[0]!.items.map((i) => i.id)).toEqual([a.id]);
    expect(actions.toggleInList(l.id, b)).toBe(true);
    expect(data().lists[0]!.items.map((i) => i.id)).toEqual([b.id, a.id]);
    expect(actions.toggleInList(l.id, a)).toBe(false);
    expect(actions.createList("Date Night")!.name).toBe("Date Night 2");
    actions.renameList(l.id, "Rewatch");
    expect(data().lists.map((x) => x.name)).toEqual(["Rewatch", "Date Night 2"]);
    actions.renameList(l.id, "   ");
    expect(data().lists[0]!.name).toBe("Rewatch");
    actions.deleteList(l.id);
    expect(data().lists.map((x) => x.name)).toEqual(["Date Night 2"]);
    const other = actions.addProfile("Other", "star", false);
    actions.selectProfile(other.id);
    expect(data().lists).toEqual([]);
  });

  it("caps the number of lists", () => {
    const p = actions.addProfile("Cap", "wave", false);
    actions.selectProfile(p.id);
    for (let i = 0; i < MAX_LISTS; i++) expect(actions.createList(`L${i}`)).not.toBeNull();
    expect(actions.createList("one too many")).toBeNull();
  });

  it("moves to top and marks as watched", () => {
    const p = actions.addProfile("Watch", "panda", false);
    actions.selectProfile(p.id);
    actions.toggleWatchlist(a); actions.toggleWatchlist(b);
    expect(data().watchlist.map((i) => i.id)).toEqual([b.id, a.id]);
    actions.bumpWatchlist(a.id);
    expect(data().watchlist.map((i) => i.id)).toEqual([a.id, b.id]);
    actions.markWatched(a);
    expect(data().watchlist.map((i) => i.id)).toEqual([b.id]);
    expect(data().history[a.id]?.completed).toBe(true);
  });
});
