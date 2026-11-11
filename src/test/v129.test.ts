import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { embedUrl, lastCineServer, parseMessage, rememberCineServer } from "../lib/player";
import type { PlaybackSource } from "../lib/types";
import { episodeRow } from "../lib/watch";
import type { HistoryEntry } from "../lib/store";
import playerSrc from "../pages/Player.tsx?raw";
import appSrc from "../App.tsx?raw";
import focusSrc from "../lib/focus.ts?raw";
import tvShellSrc from "../tv/TvShell.tsx?raw";
import mainActivity from "../../android/app/src/main/java/com/kinoma/tv/ui/MainActivity.kt?raw";
import rateSrc from "../components/RatePopover.tsx?raw";
import tvShellCss from "../tv/shell.css?raw";
import tokensCss from "../styles/tokens.css?raw";

// the exact URLs the backend returned for Game of Thrones S1E1 and Fight Club (checked 11 Nov 2026)
const cineTv = { id: "cinesrc", events: "cinesrc", origin: "https://cinesrc.st", url: "https://cinesrc.st/embed/tv/1399?s=1&e=1&autoplay=true&color=%231f80e0&autonext=false&back=close" } as unknown as PlaybackSource;
const cineMovie = { id: "cinesrc", events: "cinesrc", origin: "https://cinesrc.st", url: "https://cinesrc.st/embed/movie/550?autoplay=true&color=%231f80e0" } as unknown as PlaybackSource;
const count = (url: string, k: string) => new URL(url).searchParams.getAll(k).length;

describe("CineSrc server memory (v1.2.9, directive §2)", () => {
  beforeEach(() => localStorage.clear());
  it("asks CineSrc to prioritise the last server, without a server id on the first play", () => {
    const u = new URL(embedUrl(cineTv, { customChrome: true }));
    expect(u.searchParams.get("prioritize")).toBe("true");
    expect(u.searchParams.has("lastserver")).toBe(false);
    expect(u.searchParams.get("s")).toBe("1");
    expect(u.searchParams.get("e")).toBe("1");
    expect(u.searchParams.get("color")).toBe("#1f80e0");
  });
  it("passes the remembered server id as lastserver for TV episodes and movies", () => {
    rememberCineServer("febbox");
    expect(lastCineServer()).toBe("febbox");
    for (const s of [cineTv, cineMovie]) {
      const url = embedUrl(s, { customChrome: false, start: 120 });
      expect(new URL(url).searchParams.get("lastserver")).toBe("febbox");
      expect(new URL(url).searchParams.get("t")).toBe("120");
    }
  });
  it("never duplicates a parameter, even when the backend already sent it", () => {
    rememberCineServer("server-2");
    const dup = { ...cineTv, url: `${cineTv.url}&prioritize=false&lastserver=old` } as PlaybackSource;
    const url = embedUrl(dup, { customChrome: true, autoskip: true, quality: "1080" });
    for (const k of ["prioritize", "lastserver", "autonext", "back", "controls", "autoskip", "quality", "s", "e"]) expect(count(url, k)).toBeLessThanOrEqual(1);
    expect(new URL(url).searchParams.get("lastserver")).toBe("server-2");
    expect(new URL(url).searchParams.get("prioritize")).toBe("true");
  });
  it("reads cinesrc:sourceused and ignores malformed server ids", () => {
    expect(parseMessage(cineTv, "https://cinesrc.st", { type: "cinesrc:sourceused", data: { sourceId: "febbox" } })).toEqual({ kind: "server", id: "febbox" });
    expect(parseMessage(cineTv, "https://cinesrc.st", { type: "cinesrc:sourceused", sourceId: "<script>" })).toBeNull();
    rememberCineServer("a b/c");
    expect(lastCineServer()).toBeNull();
  });
  it("keeps a server only after it really played, and TV series episodes use CineSrc only", () => {
    expect(playerSrc).toContain("cineServer.current = ev.id; if (firstFrame.current) rememberCineServer(ev.id)");
    expect(playerSrc).toContain("const cineOnly = tv && isTv;");
    expect(playerSrc).toContain('cineOnly ? ranked.filter((x) => x.id === "cinesrc") : ranked');
    expect(playerSrc).toContain("isAnimeTitle(details) && !cineOnly");
  });
  it("shows a failure panel instead of an endless loader", () => {
    expect(playerSrc).toContain('className="player-center player-failed lrud-container"');
    expect(playerSrc).toContain("setDead(reason)");
  });
});

describe("Who's watching on a fresh start (v1.2.9, directive §4)", () => {
  afterEach(() => { sessionStorage.clear(); vi.resetModules(); history.replaceState(null, "", "/"); });
  it("is pending on a fresh session and done after a pick, without touching profiles", async () => {
    localStorage.setItem("panda:v1:state", "{\"profiles\":[1]}");
    const m = await import("../lib/launch");
    expect(m.whoPending()).toBe(true);
    m.whoDone();
    expect(m.whoPending()).toBe(false);
    expect(sessionStorage.getItem("panda:who")).toBe("1");
    expect(localStorage.getItem("panda:v1:state")).toBe("{\"profiles\":[1]}");
  });
  it("is not pending when the session already started (navigation, reload)", async () => {
    sessionStorage.setItem("panda:splash", "1");
    const m = await import("../lib/launch");
    expect(m.whoPending()).toBe(false);
    expect(m.introPending()).toBe(false);
  });
  it("treats an Android activity recreation (?resumed=1) as a continuation", async () => {
    history.replaceState(null, "", "/?resumed=1");
    const m = await import("../lib/launch");
    expect(m.whoPending()).toBe(false);
    expect(m.introPending()).toBe(false);
    expect(mainActivity).toContain('if (savedInstanceState != null) "$WEB_ENTRY_URL?resumed=1" else WEB_ENTRY_URL');
  });
  it("App asks with a saved profile too, and keeps the deep link", () => {
    expect(appSrc).toContain("<ProfileSelect stay={Boolean(profile)} />");
    expect(appSrc).toContain("<Intro tv={mode === \"tv\"}");
  });
});

describe("D-pad architecture (v1.2.9, directive §6-8)", () => {
  it("up/down never leave content for the sidebar; zones are marked, not per-screen hacks", () => {
    expect(focusSrc).toContain("export function nextFocus(");
    expect(focusSrc).toContain("[data-nav-side]");
    expect(tvShellSrc).toContain("data-nav-side");
  });
  it("rail cards resize instantly and the focused card leads the row", () => {
    expect(focusSrc).toContain("function leadRow(");
    expect(tvShellCss).toMatch(/\.tv-card \{[^}]*transition: box-shadow/);
  });
  it("focus rim is a soft silver, not bright white", () => {
    expect(tokensCss).toContain("--tv-ice-strong: rgba(222, 228, 237, 0.84)");
  });
});

describe("rating + episodes (v1.2.9, directive §10-11)", () => {
  it("TV lists Love/Like/Not for me vertically, phone reads Not for me/Like/Love, one save per opening", () => {
    expect(rateSrc).toContain('const TV_ORDER: Rating[] = ["love", "like", "dislike"]');
    expect(rateSrc).toContain('const M_ORDER: Rating[] = ["dislike", "like", "love"]');
    expect(rateSrc).toContain("if (busy.current) return;");
  });
  it("marks the episode in progress and the queued next one", () => {
    const base = { item: {} as HistoryEntry["item"], position: 900, duration: 3000, updatedAt: 1, completed: false };
    expect(episodeRow({ ...base, season: 1, episode: 3 } as HistoryEntry, 1399, 1, 3).badge).toBe("current");
    expect(episodeRow({ ...base, season: 1, episode: 4, position: 0, upNext: true } as HistoryEntry, 1399, 1, 4).badge).toBe("next");
    expect(episodeRow({ ...base, season: 1, episode: 3 } as HistoryEntry, 1399, 1, 2).badge).toBeNull();
  });
});
