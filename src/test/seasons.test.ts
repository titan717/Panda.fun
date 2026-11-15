import { describe, expect, it } from "vitest";
import { episodeLabel, initialSeason, isUnaired, lastWatched, missingEpisodes, seasonEpisodes, seasonLabel, seasonOptions } from "../lib/seasons";
import type { Episode, SeasonSummary } from "../lib/types";
import type { HistoryEntry } from "../lib/store";

const S = (number: number, name: string, episodeCount: number, airDate: string | null = "2000-01-01"): SeasonSummary => ({ number, name, episodeCount, airDate, poster: null });
const E = (season: number, number: number, id = season * 1000 + number, title = `Title ${number}`, airDate: string | null = "2001-01-01"): Episode =>
  ({ id, season, number, title, overview: null, airDate, runtime: 24, still: null, stillLarge: null, rating: null });
const now = new Date("2026-11-15T12:00:00Z");

describe("season labels", () => {
  it("shows plain Season N, never the backend's arc / part names (One Piece payload)", () => {
    const op = [S(1, "East Blue", 61), S(2, "Whiskey Peak & Little Garden", 16), S(20, "Levely Arc", 14), S(21, "Wano Country Arc", 197), S(17, "Dressrosa (2)", 56)];
    const labels = seasonOptions(op, now).map((o) => o.label);
    expect(labels).toEqual(["Season 1", "Season 2", "Season 17", "Season 20", "Season 21"]);
    expect(labels.join(" ")).not.toMatch(/Arc|Part|East Blue|\(2\)/);
    expect(seasonOptions([S(4, "The Final Season", 28)], now)[0]!.label).toBe("Season 4");
    expect(seasonOptions([S(1, "Series 1", 13)], now)[0]!.label).toBe("Season 1");
  });

  it("shows Specials only for a real season 0 with episodes, after the regular seasons", () => {
    expect(seasonLabel(0)).toBe("Specials");
    expect(seasonOptions([S(0, "Specials", 5), S(2, "x", 3), S(1, "y", 3)], now).map((o) => o.label)).toEqual(["Season 1", "Season 2", "Specials"]);
    expect(seasonOptions([S(0, "Specials", 0), S(1, "y", 3)], now).map((o) => o.label)).toEqual(["Season 1"]);
    expect(seasonOptions([S(1, "y", 3)], now).some((o) => o.specials)).toBe(false);
  });

  it("keeps real numbers, drops duplicates and empty past seasons, keeps announced ones as upcoming", () => {
    const out = seasonOptions([S(3, "c", 8), S(3, "c again", 9), S(-1, "bad", 2), S(5, "gap", 0, "2001-01-01"), S(6, "next", 0, "2027-04-01"), S(1.5, "frac", 2)], now);
    expect(out.map((o) => [o.number, o.episodeCount, o.upcoming])).toEqual([[3, 8, false], [6, 0, true]]);
    expect(seasonOptions(undefined)).toEqual([]);
  });

  it("opens the last-watched season when offered, else the first regular season", () => {
    const opts = seasonOptions([S(0, "Specials", 2), S(1, "a", 3), S(2, "b", 3)], now);
    expect(initialSeason(opts, { season: 2 } as HistoryEntry)).toBe(2);
    expect(initialSeason(opts, { season: 9 } as HistoryEntry)).toBe(1);
    expect(initialSeason(opts, null)).toBe(1);
    expect(initialSeason([], null)).toBeNull();
  });
});

describe("episodes", () => {
  it("formats E3 · Title and falls back to Episode N for placeholder titles", () => {
    expect(episodeLabel({ number: 3, title: "Pilot" })).toBe("E3 · Pilot");
    expect(episodeLabel({ number: 12, title: "Episode 12" })).toBe("Episode 12");
    expect(episodeLabel({ number: 4, title: "" })).toBe("Episode 4");
  });

  it("never invents or renumbers: drops foreign / duplicate entries, sorts, reports gaps", () => {
    const eps = seasonEpisodes(2, [E(2, 3), E(2, 1), E(1, 2), E(2, 1, 9999), E(2, 7)]);
    expect(eps.map((e) => [e.number, e.id])).toEqual([[1, 2001], [3, 2003], [7, 2007]]);
    expect(missingEpisodes(eps)).toEqual([2, 4, 5, 6]);
    expect(missingEpisodes([])).toEqual([]);
    expect(seasonEpisodes(1, undefined)).toEqual([]);
  });

  it("marks unaired episodes by a future air date only", () => {
    expect(isUnaired(E(1, 1, 1, "x", "2027-01-01"), now)).toBe(true);
    expect(isUnaired(E(1, 1, 1, "x", "2020-01-01"), now)).toBe(false);
    expect(isUnaired(E(1, 1, 1, "x", null), now)).toBe(false);
  });

  it("builds the Resume S2 E5 affordance from history", () => {
    const base = { item: {} as HistoryEntry["item"], duration: 1400, updatedAt: 1 };
    expect(lastWatched({ ...base, season: 2, episode: 5, position: 600, completed: false })).toMatchObject({ action: "Resume S2 E5", label: "Last watched S2 E5" });
    expect(lastWatched({ ...base, season: 2, episode: 6, position: 0, completed: false, upNext: true })).toMatchObject({ action: "Watch S2 E6", label: "Up next S2 E6" });
    expect(lastWatched({ ...base, season: 3, episode: 1, position: 1400, completed: true })).toMatchObject({ action: null, label: "Last watched S3 E1" });
    expect(lastWatched({ ...base, position: 10, completed: false })).toBeNull();
  });
});
