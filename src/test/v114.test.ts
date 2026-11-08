import { describe, expect, it } from "vitest";
import { actions, continueWatching, episodeProgress, getState, selectData } from "../lib/store";
import { episodeRow } from "../lib/watch";
import { continueSub } from "../tv/TvCards";
import type { PandaItem } from "../lib/types";

const show = { id: "tv-1399", tmdbId: 1399, type: "tv", title: "Show" } as unknown as PandaItem;
const h = () => selectData(getState()).history[show.id]!;

describe("Continue Watching 2.0", () => {
  it("remembers every episode's own position", () => {
    const p = actions.addProfile("Eps", "panda", false); actions.selectProfile(p.id);
    actions.saveProgress(show, { position: 600, duration: 3000, season: 1, episode: 1 });
    actions.saveProgress(show, { position: 2990, duration: 3000, season: 1, episode: 2, next: { season: 1, episode: 3 } });
    actions.saveProgress(show, { position: 300, duration: 2800, season: 1, episode: 3 });
    expect(episodeProgress(h(), 1, 1)).toMatchObject({ p: 600, done: false });
    expect(episodeProgress(h(), 1, 2)).toMatchObject({ done: true });
    expect(episodeRow(h(), 1399, 1, 1)).toMatchObject({ href: "/watch/tv/1399?s=1&e=1&t=600", pct: 20, done: false, left: 40 });
    expect(episodeRow(h(), 1399, 1, 2)).toMatchObject({ pct: 100, done: true, left: 0 });
    expect(episodeRow(h(), 1399, 1, 9)).toMatchObject({ pct: 0, done: false });
  });

  it("marks episodes watched and moves next-up on", () => {
    actions.markEpisodes(show, [{ season: 1, episode: 3 }], true, { season: 1, episode: 4 });
    expect(h()).toMatchObject({ season: 1, episode: 4, upNext: true, completed: false });
    expect(episodeProgress(h(), 1, 3)?.done).toBe(true);
    actions.markEpisodes(show, [{ season: 1, episode: 3 }], false);
    expect(episodeProgress(h(), 1, 3)?.done).toBe(false);
    expect(h()).toMatchObject({ season: 1, episode: 4, upNext: true });
  });

  it("brings a finished show back when its next episode airs", () => {
    const now = Date.parse("2026-11-20T00:00:00Z");
    actions.saveProgress(show, { position: 2990, duration: 3000, season: 2, episode: 8, next: null, upcoming: { season: 3, episode: 1, airDate: "2026-11-15" } });
    expect(h().completed).toBe(true);
    expect(continueWatching(selectData(getState()).history, Date.parse("2026-11-10")).some((e) => e.item.id === show.id)).toBe(false);
    const entry = continueWatching(selectData(getState()).history, now).find((e) => e.item.id === show.id)!;
    expect(entry).toMatchObject({ season: 3, episode: 1, newEpisode: true, upNext: true });
    expect(continueSub(entry)).toBe("New Episode • S3 E1");
  });
});
