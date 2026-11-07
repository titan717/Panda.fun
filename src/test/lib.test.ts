import { describe, expect, it } from "vitest";
import { compareVersions } from "../lib/updates";
import { navKey } from "../lib/keys";
import { nextEpisodeOf, prevEpisodeOf } from "../lib/watch";
import { embedUrl, parseMessage } from "../lib/player";
import type { PlaybackSource, SeasonSummary } from "../lib/types";

const season = (number: number, episodeCount: number): SeasonSummary => ({ number, name: `Season ${number}`, episodeCount, airDate: null, poster: null });

describe("compareVersions", () => {
  it("orders releases semantically", () => {
    expect(compareVersions("1.0.0", "0.9.9")).toBe(1);
    expect(compareVersions("v1.2.0", "1.10.0")).toBe(-1);
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
  });
  it("ranks stable above pre-release", () => {
    expect(compareVersions("1.0.0", "1.0.0-beta.3")).toBe(1);
    expect(compareVersions("0.0.8-beta.1237", "1.0.0")).toBe(-1);
    expect(compareVersions("1.0.0-beta.10", "1.0.0-beta.9")).toBeGreaterThan(0);
  });
});

describe("episode navigation", () => {
  const seasons = [season(0, 3), season(1, 2), season(2, 3)];
  it("moves within and across seasons, skipping specials", () => {
    expect(nextEpisodeOf(seasons, 1, 1)).toEqual({ season: 1, episode: 2 });
    expect(nextEpisodeOf(seasons, 1, 2)).toEqual({ season: 2, episode: 1 });
    expect(nextEpisodeOf(seasons, 2, 3)).toBeNull();
    expect(prevEpisodeOf(seasons, 2, 1)).toEqual({ season: 1, episode: 2 });
    expect(prevEpisodeOf(seasons, 1, 1)).toBeNull();
  });
});

describe("navKey", () => {
  const key = (init: KeyboardEventInit & { keyCode?: number }) => {
    const e = new KeyboardEvent("keydown", init);
    if (init.keyCode !== undefined) Object.defineProperty(e, "keyCode", { value: init.keyCode });
    return navKey(e);
  };
  it("maps arrows, enter and every back key", () => {
    expect(key({ key: "ArrowUp" })).toBe("up");
    expect(key({ key: "Enter" })).toBe("enter");
    expect(key({ key: "Escape" })).toBe("back");
    expect(key({ key: "Backspace" })).toBe("back");
    expect(key({ key: "Unidentified", keyCode: 461 })).toBe("back");
    expect(key({ key: "Unidentified", keyCode: 10009 })).toBe("back");
    expect(key({ key: "MediaPlayPause" })).toBe("playpause");
    expect(key({ key: "a" })).toBeNull();
  });
});

describe("player protocol", () => {
  const cine: PlaybackSource = { id: "cinesrc", provider: "cinesrc", label: "CineSrc", url: "https://cinesrc.st/embed/tv/1399?s=1&e=2", origin: "https://cinesrc.st", events: "cinesrc", supportsStart: true };
  const vid: PlaybackSource = { id: "vidsrc", provider: "vidsrc", label: "VidSrc", url: "https://vidsrc.sh/embed/tv/1399/1/2", origin: "https://vidsrc.sh", events: "vidsrc", supportsStart: true };
  it("parses CineSrc events and ignores other origins", () => {
    expect(parseMessage(cine, "https://cinesrc.st", { type: "cinesrc:timeupdate", data: { currentTime: 12, duration: 100 } })).toEqual({ kind: "time", position: 12, duration: 100 });
    expect(parseMessage(cine, "https://evil.example", { type: "cinesrc:ended" })).toBeNull();
    expect(parseMessage(cine, "https://cinesrc.st", { type: "cinesrc:ended" })).toEqual({ kind: "ended" });
  });
  it("parses VidSrc events", () => {
    expect(parseMessage(vid, "https://vidsrc.sh", { type: "PLAYER_EVENT", data: { player_status: "completed" } })).toEqual({ kind: "ended" });
    expect(parseMessage(vid, "https://vidsrc.sh", { type: "PLAYER_EVENT", data: { player_status: "playing", player_progress: 5, player_duration: 50 } })).toEqual({ kind: "time", position: 5, duration: 50 });
  });
  it("disables provider auto-next", () => {
    expect(embedUrl(cine)).toContain("autonext=false");
    expect(embedUrl(vid)).toContain("autonext=0");
  });
});
