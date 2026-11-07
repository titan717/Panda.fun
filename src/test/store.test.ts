import { describe, expect, it } from "vitest";
import { actions, flushStore, getState, selectData } from "../lib/store";
import type { PandaItem } from "../lib/types";

const item = { id: "tv-1396", tmdbId: 1396, type: "tv", title: "Breaking Bad" } as unknown as PandaItem;

describe("store persistence", () => {
  it("keeps profiles, My List, progress and prefs in localStorage", () => {
    actions.addProfile("Tester", "panda", false);
    const profile = getState().profiles.find((p) => p.name === "Tester");
    expect(profile).toBeDefined();
    actions.selectProfile(profile!.id);
    actions.toggleWatchlist(item);
    actions.saveProgress(item, { position: 600, duration: 2700, season: 1, episode: 2 });
    actions.setPrefs({ preferredSource: "vidsrc" });
    flushStore();

    const saved = JSON.parse(localStorage.getItem("panda:v1:state") ?? "{}");
    expect(saved.activeProfileId).toBe(profile!.id);
    expect(saved.prefs.preferredSource).toBe("vidsrc");
    const data = selectData(getState());
    expect(data.watchlist.some((i) => i.id === item.id)).toBe(true);
    expect(data.history[item.id]?.position).toBe(600);
  });
});
