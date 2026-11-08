import { describe, expect, it, vi } from "vitest";
import { sourceOrder, reliabilityLabel, reliabilityTone, isAnimeTitle, ISSUES } from "../lib/sources";
import { capabilityLabels, ADAPTERS, SOURCE_ORDER } from "../lib/player";
import { anime, sourceRanking } from "../lib/validateLazy";
import { airingLabel, animeCaption } from "../pages/Anime";
import type { AnimeCard, SourceRank, SourceRankingPayload } from "../lib/types";

const rank = (over: Partial<SourceRank>): SourceRank => ({ id: "cinesrc", rank: 1, score: 0.9, reliability: 0.95, plays: 40, reports: 2, reports24h: 0, state: "healthy", ...over });
const ranking: SourceRankingPayload = { sources: [rank({ id: "vidy", rank: 1 }), rank({ id: "cinesrc", rank: 2 })], halfLifeHours: 72, shared: false, updatedAt: "2026-11-09T00:00:00Z" };

describe("source adapters and community ranking (v1.2.0)", () => {
  it("starts Automatic in community order and a manual pick first", () => {
    expect(sourceOrder("auto", ranking)).toEqual(["vidy", "cinesrc", "vidyanime"]);
    expect(sourceOrder("auto", null)).toEqual(SOURCE_ORDER);
    expect(sourceOrder("cinesrc", ranking)).toEqual(["cinesrc", "vidy", "vidyanime"]);
  });
  it("labels reliability honestly", () => {
    expect(reliabilityLabel(rank({ reliability: 0.974 }))).toBe("97% reliable");
    expect(reliabilityLabel(rank({ state: "down" }))).toBe("Not responding");
    expect(reliabilityLabel(rank({ reliability: 0.5, reports24h: 4 }))).toBe("Reported 4× today");
    expect(reliabilityLabel(rank({ reliability: null, plays: 0, reports: 0 }))).toBe("Working");
    expect(reliabilityLabel(undefined)).toBeNull();
    expect(reliabilityTone(rank({ reliability: 0.9 }))).toBe("good");
    expect(reliabilityTone(rank({ reliability: 0.7 }))).toBe("warn");
    expect(reliabilityTone(rank({ reliability: 0.3 }))).toBe("bad");
    expect(reliabilityTone(null)).toBe("none");
  });
  it("describes capabilities and the anime adapter", () => {
    expect(ADAPTERS.vidyanime.anime).toBe(true);
    expect(capabilityLabels("vidyanime").length).toBeGreaterThan(0);
    expect(capabilityLabels("cinesrc").length).toBeGreaterThan(0);
    expect(isAnimeTitle({ language: "ja", genres: ["Animation", "Action"] })).toBe(true);
    expect(isAnimeTitle({ language: "en", genres: ["Animation"] })).toBe(false);
    expect(ISSUES.map((i) => i.id)).toEqual(["noplay", "wrong", "sync", "subs"]);
  });
  it("validates the ranking payload and drops unknown sources", () => {
    const r = sourceRanking("/panda/sources/ranking", { sources: [{ id: "vidy", rank: 2, score: 0.5, reliability: 0.8, plays: 3 }, { id: "evil", rank: 1 }, { id: "cinesrc", rank: 1 }], shared: true });
    expect(r.sources.map((s) => s.id)).toEqual(["cinesrc", "vidy"]);
    expect(r.shared).toBe(true);
    expect(r.sources[1]!.reports24h).toBe(0);
  });
  it("validates anime rows and builds captions", () => {
    const at = new Date(Date.UTC(2026, 10, 11)).toISOString();
    const p = anime("/panda/anime", {
      hero: { tmdbId: 95479, type: "tv", title: "Jujutsu Kaisen", anilistId: 145064, color: "#e4a15d", score: 8.6, airing: { episode: 6, at } },
      rows: [{ id: "trending", title: "Trending", items: [{ tmdbId: 37854, type: "tv", title: "One Piece", anilistId: 21, color: "red", studio: "Toei Animation", score: 8.7 }, { tmdbId: 1, type: "tv", title: "No AniList" }] }, { id: "empty", title: "Empty", items: [] }],
      season: { name: "FALL", year: 2026 }
    });
    expect(p.hero?.anilistId).toBe(145064);
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0]!.items).toHaveLength(1);
    expect(p.rows[0]!.items[0]!.color).toBeNull();
    const now = Date.UTC(2026, 10, 9);
    expect(airingLabel(p.hero!.airing, now)).toBe("Ep 6 in 2d");
    expect(airingLabel({ episode: 7, at: new Date(now + 5 * 3_600_000).toISOString() }, now)).toBe("Ep 7 in 5h");
    expect(airingLabel({ episode: 7, at: new Date(now - 1000).toISOString() }, now)).toBeNull();
    expect(animeCaption(p.rows[0]!.items[0] as AnimeCard, now)).toBe("★ 8.7 · Toei Animation");
  });
  it("moves the old CineSrc default to Automatic once and keeps explicit choices", async () => {
    localStorage.setItem("panda:v1:state", JSON.stringify({ profiles: [{ id: "p1", name: "A", avatar: "panda", kids: false }], activeProfileId: "p1", prefs: { preferredSource: "cinesrc" }, data: {}, profilePrefs: { p1: { preferredSource: "vidy" } } }));
    vi.resetModules();
    const store = await import("../lib/store");
    expect(store.getState().prefs.preferredSource).toBe("auto");
    expect(store.getPrefs().preferredSource).toBe("vidy");
    localStorage.setItem("panda:v1:state", JSON.stringify({ profiles: [{ id: "p1", name: "A", avatar: "panda", kids: false }], activeProfileId: "p1", prefs: { preferredSource: "cinesrc", sourceAuto: true }, data: {} }));
    vi.resetModules();
    const again = await import("../lib/store");
    expect(again.getState().prefs.preferredSource).toBe("cinesrc");
  });
});
