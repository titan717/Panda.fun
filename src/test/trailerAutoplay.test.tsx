import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { autoplayBlock, createTrailerManager, networkDataSaver, PRELOAD_LEAD_MS, REVEAL_DELAY_MS, useTrailerAutoplay, type TrailerManager } from "../lib/trailerAutoplay";
import { REVEAL_DELAY_MS as TRAILER_REVEAL } from "../components/Trailer";

let m: TrailerManager;
const setConn = (c: unknown) => Object.defineProperty(navigator, "connection", { value: c, configurable: true });
beforeEach(() => { vi.useFakeTimers(); m = createTrailerManager(); });
afterEach(() => {
  vi.useRealTimers();
  setConn(undefined);
  delete document.documentElement.dataset.motion;
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});
const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe("Trailer Autoplay Manager", () => {
  it("waits for the configured delay: idle → preload (3 s early) → play", () => {
    m.request({ surface: "tv-details", key: "tv:1", delayMs: 5000 });
    expect(m.snapshot().stage).toBe("idle");
    tick(5000 - PRELOAD_LEAD_MS - 1);
    expect(m.snapshot().stage).toBe("idle");
    tick(1);
    expect(m.snapshot().stage).toBe("preload");
    tick(PRELOAD_LEAD_MS);
    expect(m.snapshot()).toMatchObject({ stage: "play", key: "tv:1", surface: "tv-details", shown: false });
  });

  it("a short delay preloads at once", () => {
    m.request({ surface: "tv-row", key: "a", delayMs: 1000 });
    expect(m.snapshot().stage).toBe("preload");
    tick(1000);
    expect(m.snapshot().stage).toBe("play");
  });

  it("cancels on focus change and restarts the delay for the new title", () => {
    m.request({ surface: "tv-row", key: "a", delayMs: 5000 });
    tick(4000);
    m.request({ surface: "tv-row", key: "b", delayMs: 5000 });
    expect(m.snapshot()).toMatchObject({ key: "b", stage: "idle" });
    tick(1500);
    expect(m.snapshot().stage).toBe("idle");
    tick(3500);
    expect(m.snapshot()).toMatchObject({ key: "b", stage: "play" });
  });

  it("keeps a single active trailer across surfaces: a new request stops the playing one", () => {
    const hero = m.request({ surface: "tv-hero", key: "a", delayMs: 1000 });
    tick(1000);
    m.shown(hero);
    expect(m.snapshot()).toMatchObject({ surface: "tv-hero", stage: "play", shown: true });
    m.request({ surface: "tv-row", key: "b", delayMs: 1000 });
    expect(m.snapshot()).toMatchObject({ surface: "tv-row", key: "b", shown: false });
    // the stale hero token can no longer change anything
    m.shown(hero); m.fail(hero); m.release(hero);
    tick(1000);
    expect(m.snapshot()).toMatchObject({ surface: "tv-row", key: "b", stage: "play" });
  });

  it("never starts for titles scrolled past quickly", () => {
    for (let i = 0; i < 12; i++) { m.request({ surface: "tv-row", key: `t${i}`, delayMs: 5000 }); tick(1200); }
    expect(m.snapshot().stage).not.toBe("play");
  });

  it("release cancels a pending delay and stops a playing trailer", () => {
    const t = m.request({ surface: "m-hero", key: "a", delayMs: 5000 });
    tick(4000);
    m.release(t);
    tick(5000);
    expect(m.snapshot().stage).toBe("idle");
    const t2 = m.request({ surface: "m-hero", key: "a", delayMs: 0 });
    expect(m.snapshot().stage).toBe("play");
    m.release(t2);
    expect(m.snapshot()).toMatchObject({ stage: "idle", key: "" });
  });

  it("restores the artwork on failure and does not retry that title; an ended trailer waits for a new request", () => {
    const t = m.request({ surface: "tv-details", key: "a", delayMs: 0 });
    m.fail(t);
    expect(m.snapshot().stage).toBe("idle");
    expect(m.hasFailed("a")).toBe(true);
    m.release(t);
    m.request({ surface: "tv-details", key: "a", delayMs: 0 });
    tick(10000);
    expect(m.snapshot().stage).toBe("idle");

    const e = m.request({ surface: "m-details", key: "b", delayMs: 0 });
    m.end(e);
    tick(10000);
    expect(m.snapshot().stage).toBe("idle");
    m.release(e);
    m.request({ surface: "m-details", key: "b", delayMs: 0 });
    expect(m.snapshot().stage).toBe("play");
  });

  it("respects reduced motion (Settings switch and html[data-motion=reduce])", () => {
    m.setEnv({ reduceMotion: true });
    m.request({ surface: "tv-hero", key: "a", delayMs: 0 });
    tick(6000);
    expect(m.snapshot().stage).toBe("idle");
    m.setEnv({ reduceMotion: false });
    expect(m.snapshot().stage).toBe("play");
    document.documentElement.dataset.motion = "reduce";
    m.recheck();
    expect(m.snapshot().stage).toBe("idle");
    expect(autoplayBlock({ reduceMotion: false, qualityDataSaver: false, lite: false })).toBe("motion");
  });

  it("respects data saver: Data Saver quality, saveData and 2G/3G connections", () => {
    m.setEnv({ qualityDataSaver: true });
    m.request({ surface: "tv-hero", key: "a", delayMs: 1000 });
    tick(5000);
    expect(m.snapshot().stage).toBe("idle");
    m.setEnv({ qualityDataSaver: false });
    tick(1000);
    expect(m.snapshot().stage).toBe("play");

    expect(networkDataSaver({ saveData: true })).toBe(true);
    expect(networkDataSaver({ effectiveType: "3g" })).toBe(true);
    expect(networkDataSaver({ effectiveType: "2g" })).toBe(true);
    expect(networkDataSaver({ effectiveType: "4g" })).toBe(false);
    setConn({ effectiveType: "3g" });
    m.recheck();
    expect(m.snapshot().stage).toBe("idle");
    expect(autoplayBlock({ reduceMotion: false, qualityDataSaver: false, lite: false })).toBe("data");
  });

  it("stops while the page is hidden and starts the delay over when it is visible again", () => {
    m.request({ surface: "tv-details", key: "a", delayMs: 2000 });
    tick(2000);
    expect(m.snapshot().stage).toBe("play");
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(m.snapshot().stage).toBe("idle");
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(m.snapshot().stage).not.toBe("play");
    tick(2000);
    expect(m.snapshot().stage).toBe("play");
  });

  it("keeps the reveal rule in one place (Trailer re-exports the manager's constant)", () => {
    expect(TRAILER_REVEAL).toBe(REVEAL_DELAY_MS);
    expect(REVEAL_DELAY_MS).toBe(2000);
  });
});

describe("useTrailerAutoplay", () => {
  it("drives two surfaces with one active player and releases on unmount", () => {
    const a = renderHook(({ k }) => useTrailerAutoplay("tv-hero", k, 5, { manager: m }), { initialProps: { k: "x" as string | null } });
    tick(5000);
    expect(a.result.current.stage).toBe("play");
    act(() => { a.result.current.onPlaying(); });
    expect(a.result.current.shown).toBe(true);
    const b = renderHook(() => useTrailerAutoplay("tv-row", "y", 5, { manager: m }));
    expect(a.result.current.stage).toBe("idle");
    expect(a.result.current.shown).toBe(false);
    tick(5000);
    expect(b.result.current.stage).toBe("play");
    expect(a.result.current.stage).toBe("idle");
    b.unmount();
    expect(m.snapshot().stage).toBe("idle");
    a.rerender({ k: null });
    expect(a.result.current.stage).toBe("idle");
  });

  it("onFail restores the artwork and marks the title failed", () => {
    const h = renderHook(() => useTrailerAutoplay("m-details", "z", 1, { manager: m }));
    tick(1000);
    expect(h.result.current.stage).toBe("play");
    act(() => { h.result.current.onFail(); });
    expect(h.result.current.stage).toBe("idle");
    expect(h.result.current.failed).toBe(true);
  });
});
