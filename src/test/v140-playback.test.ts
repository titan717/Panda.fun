import { beforeEach, describe, expect, it } from "vitest";
import { eligibleOrder, orderSources, SOURCE_POLICY, SUPPORTED_SOURCES } from "../lib/playback/registry";
import { allFailed, attemptedSources, currentSource, failureReason, FALLBACK_CONFIG, fallbackReducer, initialFallback, type FallbackEvent, type FallbackState } from "../lib/playback/fallback";
import { clearHealth, healthStatus, HEALTH_CONFIG, isSuppressed, recordPlaybackSuccess, recordTotalFailure, resetHealthCacheForTest, suppressedSet } from "../lib/playback/health";
import type { PlaybackSource, SourceId } from "../lib/types";

const src = (id: SourceId): PlaybackSource => ({ id, provider: id, label: id, url: `https://${id}.example/e/1`, origin: `https://${id}.example`, events: id === "cinesrc" ? "cinesrc" : "vidy", supportsStart: true, tier: 1 });
const run = (events: FallbackEvent[], s: FallbackState = initialFallback()) => events.reduce((a, e) => fallbackReducer(a, e), s);

describe("v1.4.0 source registry", () => {
  it("TV uses CineSrc only, mobile Vidy → CineSrc, browser keeps both", () => {
    expect(SOURCE_POLICY.tv.order).toEqual(["cinesrc"]);
    expect(eligibleOrder("tv", { anime: true })).toEqual(["cinesrc"]);
    expect(eligibleOrder("mobile")).toEqual(["vidy", "cinesrc"]);
    expect(eligibleOrder("mobile", { anime: true })).toEqual(["vidyanime", "vidy", "cinesrc"]);
    expect(eligibleOrder("browser")).toEqual(["cinesrc", "vidy"]);
  });
  it("VidLink is gone from every platform", () => {
    expect(SUPPORTED_SOURCES).not.toContain("vidlink");
    for (const p of ["tv", "mobile", "browser"] as const) expect([...SOURCE_POLICY[p].order, ...SOURCE_POLICY[p].anime]).not.toContain("vidlink");
  });
  it("filters backend sources to the platform and orders them", () => {
    const list = [src("cinesrc"), src("vidy"), { ...src("vidy"), id: "vidlink" as SourceId }];
    expect(orderSources(list, "tv").map((s) => s.id)).toEqual(["cinesrc"]);
    expect(orderSources(list, "mobile").map((s) => s.id)).toEqual(["vidy", "cinesrc"]);
    expect(orderSources([src("cinesrc")], "mobile").map((s) => s.id)).toEqual(["cinesrc"]);
  });
  it("community ranking may reorder the browser list but never the mobile or TV list", () => {
    const ranking = { sources: [{ id: "vidy" as SourceId, rank: 1 }, { id: "cinesrc" as SourceId, rank: 2 }] } as never;
    expect(eligibleOrder("browser", { ranking })).toEqual(["vidy", "cinesrc"]);
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
    let s = run([{ kind: "start", order: ["vidy", "cinesrc"], now: t0 }]);
    const first = s.deadline!;
    s = fallbackReducer(s, { kind: "progress", now: first - 1000 });
    expect(s.deadline).toBe(first - 1000 + FALLBACK_CONFIG.progressGraceMs);
    const extended = s.deadline!;
    s = fallbackReducer(s, { kind: "progress", now: extended - 10 });
    expect(s.deadline).toBe(extended);
    s = fallbackReducer(s, { kind: "tick", now: extended - 1 });
    expect(currentSource(s)).toBe("vidy");
    s = fallbackReducer(s, { kind: "tick", now: extended });
    expect(currentSource(s)).toBe("cinesrc");
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
  it("repeated verified failures extend the cooldown, capped", () => {
    const a = recordTotalFailure({ platform: "tv", type: "tv", id: 9, attempted: ["cinesrc"], reason: "error" }, now)!;
    const b = recordTotalFailure({ platform: "tv", type: "tv", id: 9, attempted: ["cinesrc"], reason: "error" }, now + 1)!;
    expect(b.failures).toBe(2);
    expect(b.suppressedUntil - (now + 1)).toBe(HEALTH_CONFIG.initialMs * 3);
    let c = b; for (let i = 0; i < 6; i++) c = recordTotalFailure({ platform: "tv", type: "tv", id: 9, attempted: ["cinesrc"], reason: "error" }, now + 2 + i)!;
    expect(c.suppressedUntil - (now + 7)).toBe(HEALTH_CONFIG.maxMs);
    expect(a.failures).toBe(1);
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
