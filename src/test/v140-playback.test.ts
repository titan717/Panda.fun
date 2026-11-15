import { beforeEach, describe, expect, it } from "vitest";
import { eligibleOrder, orderSources, SUPPORTED_SOURCES } from "../lib/playback/registry";
import { allFailed, attemptedSources, currentSource, failureReason, FALLBACK_CONFIG, fallbackReducer, initialFallback, type FallbackEvent, type FallbackState } from "../lib/playback/fallback";
import { clearHealth, healthStatus, HEALTH_CONFIG, isSuppressed, recordPlaybackSuccess, recordTotalFailure, resetHealthCacheForTest, suppressedSet } from "../lib/playback/health";
import type { PlaybackSource, SourceId } from "../lib/types";
import playerSrc from "../pages/Player.tsx?raw";
import chromeSrc from "../tv/TvPlayerChrome.tsx?raw";
import settingsSrc from "../pages/Settings.tsx?raw";
import loadingSrc from "../pages/PlayerLoading.tsx?raw";

const src = (id: SourceId): PlaybackSource => ({ id, provider: id, label: id, url: `https://${id}.example/e/1`, origin: `https://${id}.example`, events: id === "cinesrc" ? "cinesrc" : "vidy", supportsStart: true, tier: 1 });
const run = (events: FallbackEvent[], s: FallbackState = initialFallback()) => events.reduce((a, e) => fallbackReducer(a, e), s);

describe("v1.4.0 source registry", () => {
  it("TV uses CineSrc only, mobile Vidy → CineSrc, browser keeps both", () => {
    expect(eligibleOrder("tv")).toEqual(["cinesrc"]);
    expect(eligibleOrder("tv", { anime: true })).toEqual(["cinesrc"]);
    expect(eligibleOrder("mobile")).toEqual(["vidy", "cinesrc"]);
    expect(eligibleOrder("mobile", { anime: true })).toEqual(["vidyanime", "vidy", "cinesrc"]);
    expect(eligibleOrder("browser")).toEqual(["cinesrc", "vidy", "vidlink"]);
  });
  it("VidLink is gone from TV and mobile; the browser keeps it as the last resort", () => {
    for (const p of ["tv", "mobile"] as const) expect(eligibleOrder(p, { anime: true })).not.toContain("vidlink");
    expect(SUPPORTED_SOURCES).toContain("vidlink");
    expect(eligibleOrder("browser", { anime: true })).toEqual(["vidyanime", "cinesrc", "vidy", "vidlink"]);
  });
  it("filters backend sources to the platform and orders them", () => {
    const list = [src("cinesrc"), src("vidy"), { ...src("vidy"), id: "vidlink" as SourceId }];
    expect(orderSources(list, "tv").map((s) => s.id)).toEqual(["cinesrc"]);
    expect(orderSources(list, "mobile").map((s) => s.id)).toEqual(["vidy", "cinesrc"]);
    expect(orderSources(list, "browser").map((s) => s.id)).toEqual(["cinesrc", "vidy", "vidlink"]);
    expect(orderSources([src("cinesrc")], "mobile").map((s) => s.id)).toEqual(["cinesrc"]);
  });
  it("community ranking may reorder the browser list but never the mobile or TV list", () => {
    const ranking = { sources: [{ id: "vidlink" as SourceId, rank: 0 }, { id: "vidy" as SourceId, rank: 1 }, { id: "cinesrc" as SourceId, rank: 2 }] } as never;
    expect(eligibleOrder("browser", { ranking })).toEqual(["vidy", "cinesrc", "vidlink"]);
    expect(eligibleOrder("mobile", { ranking })).toEqual(["vidy", "cinesrc"]);
  });
});

describe("v1.4.0 fallback controller", () => {
  const t0 = 1_000_000;
  it("an iframe load / ready alone is not success; an advancing clock is", () => {
    let s = run([{ kind: "start", order: ["vidy", "cinesrc"], now: t0 }, { kind: "progress", now: t0 + 500 }, { kind: "play", now: t0 + 600 }]);
    expect(s.status).toBe("loading");
    s = run([{ kind: "time", position: 0.1, now: t0 + 700 }, { kind: "time", position: 0.2, now: t0 + 800 }], s);
    expect(s.status).toBe("loading");
    s = fallbackReducer(s, { kind: "time", position: 0.9, now: t0 + 1500 });
    expect(s.status).toBe("playing");
    expect(currentSource(s)).toBe("vidy");
  });
  it("Vidy fails → CineSrc is tried automatically, keeping the same request", () => {
    let s = run([{ kind: "start", order: ["vidy", "cinesrc"], now: t0 }, { kind: "error", now: t0 + 2000 }]);
    expect(currentSource(s)).toBe("cinesrc");
    s = run([{ kind: "time", position: 3, now: t0 + 3000 }, { kind: "time", position: 4, now: t0 + 4000 }], s);
    expect(s.status).toBe("playing");
    expect(attemptedSources(s)).toEqual(["vidy", "cinesrc"]);
    expect(s.attempts.map((a) => a.outcome)).toEqual(["error", "playing"]);
  });
  it("timeouts move on, a sign of life extends the wait once", () => {
    let s = run([{ kind: "start", order: ["cinesrc", "vidy"], now: t0 }]);
    const first = s.deadline!;
    s = fallbackReducer(s, { kind: "progress", now: first - 1000 });
    expect(s.deadline).toBe(first - 1000 + FALLBACK_CONFIG.progressGraceMs);
    const extended = s.deadline!;
    s = fallbackReducer(s, { kind: "progress", now: extended - 10 });
    expect(s.deadline).toBe(extended);
    s = fallbackReducer(s, { kind: "tick", now: extended - 1 });
    expect(currentSource(s)).toBe("cinesrc");
    s = fallbackReducer(s, { kind: "tick", now: extended });
    expect(currentSource(s)).toBe("vidy");
  });
  it("embeds with their own controls get time for a tap, and each tap extends it", () => {
    let s = run([{ kind: "start", order: ["vidy", "cinesrc"], now: t0 }, { kind: "progress", now: t0 + 1000 }]);
    expect(s.deadline).toBe(t0 + 1000 + FALLBACK_CONFIG.manualGraceMs);
    s = fallbackReducer(s, { kind: "interact", now: t0 + 25_000 });
    expect(s.deadline).toBe(t0 + 25_000 + FALLBACK_CONFIG.manualGraceMs);
    // CineSrc is driven by Panda (no tap needed): interaction does not hold it
    const c = run([{ kind: "start", order: ["cinesrc"], now: t0 }]);
    expect(fallbackReducer(c, { kind: "interact", now: t0 + 1 }).deadline).toBe(c.deadline);
  });
  it("all providers failing ends in failed, never loops", () => {
    const s = run([{ kind: "start", order: ["vidy", "cinesrc"], now: t0 }, { kind: "error", now: t0 + 1 }, { kind: "tick", now: t0 + 60_000 }, { kind: "tick", now: t0 + 120_000 }]);
    expect(allFailed(s)).toBe(true);
    expect(currentSource(s)).toBeNull();
    expect(s.attempts).toHaveLength(2);
    expect(failureReason(s)).toBe("timeout");
  });
  it("going offline pauses the attempt instead of failing the provider", () => {
    let s = run([{ kind: "start", order: ["cinesrc"], now: t0 }, { kind: "offline", now: t0 + 100 }, { kind: "tick", now: t0 + 600_000 }]);
    expect(s.status).toBe("offline");
    expect(currentSource(s)).toBe("cinesrc");
    s = fallbackReducer(s, { kind: "online", now: t0 + 600_000 });
    expect(s.status).toBe("loading");
  });
  it("cancelling (user leaves) is not a failure", () => {
    const s = run([{ kind: "start", order: ["cinesrc"], now: t0 }, { kind: "cancel", now: t0 + 100 }]);
    expect(s.status).toBe("cancelled");
    expect(allFailed(s)).toBe(false);
  });
  it("opening at a resume point counts as playing at once", () => {
    const s = run([{ kind: "start", order: ["cinesrc"], now: t0 }, { kind: "time", position: 600.2, now: t0 + 900, resumeAt: 600 }]);
    expect(s.status).toBe("playing");
  });
  it("errors after playback started do not trigger fallback", () => {
    let s = run([{ kind: "start", order: ["cinesrc", "vidy"], now: t0 }, { kind: "time", position: 1, now: t0 + 1 }, { kind: "time", position: 2, now: t0 + 2 }]);
    s = fallbackReducer(s, { kind: "error", now: t0 + 3 });
    expect(s.status).toBe("playing");
    expect(currentSource(s)).toBe("cinesrc");
  });
  it("empty order fails at once", () => {
    expect(allFailed(run([{ kind: "start", order: [], now: t0 }]))).toBe(true);
  });
});

describe("v1.4.0 playback health and temporary suppression", () => {
  beforeEach(() => { localStorage.clear(); resetHealthCacheForTest(); clearHealth(); });
  const now = Date.UTC(2026, 10, 15);
  it("a total failure suppresses the title for 24 h on that platform only", () => {
    recordTotalFailure({ platform: "mobile", type: "movie", id: 7, attempted: ["vidy", "cinesrc"], reason: "timeout" }, now);
    expect(isSuppressed("mobile", "movie", 7, now + 3600_000)).toBe(true);
    expect(isSuppressed("tv", "movie", 7, now)).toBe(false);
    expect(isSuppressed("mobile", "movie", 7, now + HEALTH_CONFIG.initialMs + 1)).toBe(false);
    expect(healthStatus("mobile", "movie", 7, now + HEALTH_CONFIG.initialMs + 1)).toBe("revalidating");
    expect(suppressedSet("mobile", now)).toEqual(new Set(["movie:7"]));
  });
  it("network failures and empty attempts never suppress", () => {
    expect(recordTotalFailure({ platform: "tv", type: "movie", id: 8, attempted: ["cinesrc"], reason: "network" }, now)).toBeNull();
    expect(recordTotalFailure({ platform: "tv", type: "movie", id: 8, attempted: [], reason: "timeout" }, now)).toBeNull();
    expect(isSuppressed("tv", "movie", 8, now)).toBe(false);
  });
  it("only a failure verified after the cooldown ended extends it, capped", () => {
    const a = recordTotalFailure({ platform: "tv", type: "movie", id: 9, attempted: ["cinesrc"], reason: "error" }, now)!;
    // Retry straight away: same incident, the cooldown does not grow
    const b = recordTotalFailure({ platform: "tv", type: "movie", id: 9, attempted: ["cinesrc"], reason: "error" }, now + 60_000)!;
    expect(b.failures).toBe(1);
    expect(b.suppressedUntil).toBe(now + 60_000 + HEALTH_CONFIG.initialMs);
    // re-checked after the cooldown and still broken: 3x longer
    let t = b.suppressedUntil + 1;
    const c = recordTotalFailure({ platform: "tv", type: "movie", id: 9, attempted: ["cinesrc"], reason: "error" }, t)!;
    expect(c.failures).toBe(2);
    expect(c.suppressedUntil - t).toBe(HEALTH_CONFIG.initialMs * 3);
    let d = c; for (let i = 0; i < 6; i++) { t = d.suppressedUntil + 1; d = recordTotalFailure({ platform: "tv", type: "movie", id: 9, attempted: ["cinesrc"], reason: "error" }, t)!; }
    expect(d.suppressedUntil - t).toBe(HEALTH_CONFIG.maxMs);
    expect(a.failures).toBe(1);
  });
  it("one broken later episode does not hide the whole show; the first episode or two episodes do", () => {
    recordTotalFailure({ platform: "mobile", type: "tv", id: 11, season: 2, episode: 5, attempted: ["vidy", "cinesrc"], reason: "error" }, now);
    expect(isSuppressed("mobile", "tv", 11, now + 1)).toBe(false);
    expect(suppressedSet("mobile", now + 1).has("tv:11")).toBe(false);
    recordTotalFailure({ platform: "mobile", type: "tv", id: 11, season: 2, episode: 6, attempted: ["vidy", "cinesrc"], reason: "error" }, now + 2);
    expect(isSuppressed("mobile", "tv", 11, now + 3)).toBe(true);
    recordTotalFailure({ platform: "mobile", type: "tv", id: 12, season: 1, episode: 1, attempted: ["vidy", "cinesrc"], reason: "error" }, now);
    expect(isSuppressed("mobile", "tv", 12, now + 1)).toBe(true);
  });
  it("a successful revalidation restores eligibility at once", () => {
    recordTotalFailure({ platform: "browser", type: "movie", id: 10, attempted: ["cinesrc", "vidy"], reason: "timeout" }, now);
    recordPlaybackSuccess("browser", "movie", 10, now + 10);
    expect(isSuppressed("browser", "movie", 10, now + 20)).toBe(false);
    expect(healthStatus("browser", "movie", 10, now + 20)).toBe("recovered");
    // a later failure starts again at the initial cooldown
    const r = recordTotalFailure({ platform: "browser", type: "movie", id: 10, attempted: ["cinesrc"], reason: "timeout" }, now + 30)!;
    expect(r.failures).toBe(1);
  });
  it("survives corrupt storage", () => {
    localStorage.setItem("panda:v1:playhealth", "{not json");
    resetHealthCacheForTest();
    expect(isSuppressed("tv", "movie", 1, now)).toBe(false);
    localStorage.setItem("panda:v1:playhealth", JSON.stringify({ x: { v: 1, contentId: "bad" } }));
    resetHealthCacheForTest();
    expect(suppressedSet("tv", now).size).toBe(0);
  });
});

describe("v1.4.0 no visible source selection", () => {
  it("the player, TV chrome, loading screen and Settings offer no source choice", () => {
    expect(playerSrc).not.toContain("pl-sources");
    expect(playerSrc).not.toContain("pl-stall-switch");
    expect(playerSrc).not.toContain("switchSource(");
    expect(chromeSrc).not.toContain("tvp-s-");
    expect(chromeSrc).not.toContain("onSource");
    expect(settingsSrc).not.toContain("Preferred video source");
    expect(loadingSrc).not.toContain("sourceName(");
  });
  it("the player records health only through the controller", () => {
    expect(playerSrc).toContain("recordTotalFailure(");
    expect(playerSrc).toContain("recordPlaybackSuccess(platform, type, id)");
  });
});
