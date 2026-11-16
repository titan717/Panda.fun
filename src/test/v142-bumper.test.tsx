import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";

// The real renderer needs a 2D canvas (happy-dom has none) and the logo image: both are replaced by spies. The
// faithful port itself is checked pixel by pixel against the original HTML (scripts/intro/screens.mjs).
const frame = vi.hoisted(() => ({
  draw: vi.fn(),
  resize: vi.fn(),
  logo: { ok: true } as unknown,
  throwOnCreate: false
}));
vi.mock("../lib/intro/bumperFrame", () => ({
  BUMPER_DUR: 4,
  BUMPER_FINAL_T: 3.8,
  loadBumperLogo: vi.fn(async () => frame.logo),
  createBumperRenderer: vi.fn(() => {
    if (frame.throwOnCreate) throw new Error("no 2d context");
    return { draw: frame.draw, resize: frame.resize };
  })
}));
const score = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn() }));
vi.mock("../lib/intro/bumperScore", () => ({
  startBumperScore: (elapsed: () => number) => { score.start(elapsed()); return Promise.resolve({ stop: score.stop, scheduled: [] }); }
}));

import { BUMPER_HARD_MS, BUMPER_HOLD_MS, IntroBumper } from "../components/IntroBumper";
import { PreMovieBumper } from "../components/PreMovieBumper";
import { LaunchIntro } from "../components/Intro";
import { INTRO, planIntro, resetIntroDecision } from "../lib/intro";
import { setIntroPhase } from "../lib/launch";
import { BUMPER_OFF_KEY, bumperKey, clearBumperSkip, preMovieBumperDue, skipBumperFor } from "../lib/intro/premovie";

const FAKE = ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "performance", "requestAnimationFrame", "cancelAnimationFrame"] as const;
/** Let the dynamic imports and the logo promise settle, inside act. */
const settle = async () => { await act(async () => { await vi.dynamicImportSettled(); await Promise.resolve(); await Promise.resolve(); }); };
const bumper = () => document.querySelector<HTMLElement>("[data-bumper]");

beforeEach(() => {
  frame.draw.mockReset(); frame.resize.mockReset(); frame.logo = { ok: true }; frame.throwOnCreate = false;
  score.start.mockReset(); score.stop.mockReset();
  localStorage.clear(); sessionStorage.clear();
  history.replaceState(null, "", "/");
  vi.useFakeTimers({ toFake: [...FAKE] });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("IntroBumper: own clock and the hard timeout", () => {
  it("is a 4 s bumper with a hard 4.2 s limit", () => { expect(BUMPER_HARD_MS).toBe(4200); });
  it("plays with requestAnimationFrame and ends once at 4 s", async () => {
    const onDone = vi.fn();
    render(<IntroBumper onDone={onDone} sound={false} still={false} />);
    await settle();
    expect(bumper()!.dataset.drawn).toBe("true");
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
    const ts = frame.draw.mock.calls.map((c) => c[0] as number);
    expect(ts.length).toBeGreaterThan(50); // ~60 fps
    expect(Math.max(...ts)).toBeGreaterThan(1.5);
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(onDone).toHaveBeenCalledTimes(1);
    const n = frame.draw.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(frame.draw.mock.calls.length).toBe(n); // the loop stopped
    expect(onDone).toHaveBeenCalledTimes(1); // the 4.2 s timeout does not fire a second time
  });

  it("the hard timeout fires at 4.2 s when rAF never runs", async () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const onDone = vi.fn();
    render(<IntroBumper onDone={onDone} sound={false} still={false} />);
    await settle();
    await act(async () => { await vi.advanceTimersByTimeAsync(4199); });
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("the hard timeout fires at 4.2 s when the renderer never loads", async () => {
    frame.logo = new Promise(() => undefined); // the logo request hangs
    const onDone = vi.fn();
    render(<IntroBumper onDone={onDone} sound={false} still={false} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(4199); });
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("reports an error when the logo or the 2D canvas is missing (the timeout still releases)", async () => {
    frame.logo = null;
    const onDone = vi.fn(); const onError = vi.fn();
    render(<IntroBumper onDone={onDone} onError={onError} sound={false} still={false} />);
    await settle();
    expect(onError).toHaveBeenCalledTimes(1);
    cleanup();
    frame.logo = { ok: true }; frame.throwOnCreate = true;
    const onError2 = vi.fn();
    render(<IntroBumper onDone={onDone} onError={onError2} sound={false} still={false} />);
    await settle();
    expect(onError2).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(4200); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe("IntroBumper: reduced motion", () => {
  it("draws the final logo frame once, never starts rAF or the score, and ends after the hold", async () => {
    const raf = vi.fn(() => 1);
    vi.stubGlobal("requestAnimationFrame", raf);
    const onDone = vi.fn();
    render(<IntroBumper onDone={onDone} still />);
    await settle();
    expect(bumper()!.dataset.still).toBe("true");
    expect(bumper()!.dataset.drawn).toBe("true");
    expect(frame.draw).toHaveBeenCalledTimes(1);
    expect(frame.draw).toHaveBeenCalledWith(3.8);
    await act(async () => { await vi.advanceTimersByTimeAsync(BUMPER_HOLD_MS - 1); });
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(raf).not.toHaveBeenCalled();
    expect(score.start).not.toHaveBeenCalled();
    expect(frame.draw).toHaveBeenCalledTimes(1);
  });

  it("follows the system setting when `still` is not given", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation((q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as MediaQueryList);
    render(<IntroBumper onDone={() => undefined} />);
    await settle();
    expect(bumper()!.dataset.still).toBe("true");
    expect(frame.draw).toHaveBeenCalledWith(3.8);
  });

  it("redraws the final frame on resize", async () => {
    render(<IntroBumper onDone={() => undefined} still />);
    await settle();
    window.dispatchEvent(new Event("resize"));
    expect(frame.resize).toHaveBeenCalledTimes(1);
    expect(frame.draw).toHaveBeenCalledTimes(2);
    expect(frame.draw).toHaveBeenLastCalledWith(3.8);
  });
});

describe("IntroBumper: cleanup on unmount", () => {
  it("cancels the frame loop, the timers, the resize listener and stops the score", async () => {
    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    const removed = vi.spyOn(window, "removeEventListener");
    const onDone = vi.fn();
    const r = render(<IntroBumper onDone={onDone} still={false} />);
    await settle();
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(score.start).toHaveBeenCalledTimes(1);
    expect(score.start.mock.calls[0]![0]).toBeLessThan(0.2); // the score is told the bumper's own time
    const n = frame.draw.mock.calls.length;
    r.unmount();
    expect(cancel).toHaveBeenCalled();
    expect(removed.mock.calls.some((c) => c[0] === "resize")).toBe(true);
    expect(score.stop).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(frame.draw.mock.calls.length).toBe(n);
    expect(onDone).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("Launch intro uses the bumper", () => {
  beforeEach(() => { resetIntroDecision(); setIntroPhase("done"); });
  it("plans the bumper on phones and TVs with a 4.2 s limit, and its final frame under reduced motion", () => {
    for (const tv of [true, false]) {
      const p = planIntro({ tv, reduce: false })!;
      expect(p.view).toBe("bumper");
      expect(p.hardMs).toBe(4200);
      const s = planIntro({ tv, reduce: true })!;
      expect(s.view).toBe("bumper");
      expect(s.still).toBe(true);
      expect(s.hardMs).toBeLessThanOrEqual(4200);
    }
  });
  it("hands off within 4.2 s even if nothing draws", async () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    render(<LaunchIntro tv />);
    expect(document.querySelector("[data-intro]")).not.toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(4200 + INTRO.leaveMs + 50); });
    expect(document.querySelector("[data-intro]")).toBeNull();
  });
  it("falls back to the mascot still when the bumper cannot render", async () => {
    frame.logo = null;
    render(<LaunchIntro tv={false} />);
    await settle();
    expect(document.querySelector("[data-intro]")!.getAttribute("data-view")).toBe("static");
  });
});

describe("Pre-movie bumper", () => {
  it("rules: once per Player opening, not after an in-player episode change, ?resumed=1 or when switched off", () => {
    const k = bumperKey("tv", 1399, 1, 2);
    expect(k).toBe("tv-1399-1-2");
    expect(bumperKey("movie", 27205)).toBe("movie-27205-");
    expect(preMovieBumperDue(k)).toBe(true);
    skipBumperFor(k);
    expect(preMovieBumperDue(k)).toBe(false);
    expect(preMovieBumperDue(bumperKey("tv", 1399, 1, 3))).toBe(true);
    clearBumperSkip(k);
    expect(preMovieBumperDue(k)).toBe(true);
    history.replaceState(null, "", "/?resumed=1");
    expect(preMovieBumperDue(k)).toBe(false);
    history.replaceState(null, "", "/");
    sessionStorage.setItem(BUMPER_OFF_KEY, "off");
    expect(preMovieBumperDue(k)).toBe(false);
    sessionStorage.clear(); localStorage.setItem(BUMPER_OFF_KEY, "off");
    expect(preMovieBumperDue(k)).toBe(false);
  });

  it("ends as soon as playback starts", async () => {
    const onDone = vi.fn();
    const r = render(<PreMovieBumper tv={false} end={false} onDone={onDone} />);
    await settle();
    expect(document.querySelector("[data-premovie] [data-bumper]")).not.toBeNull();
    r.rerender(<PreMovieBumper tv={false} end onDone={onDone} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(INTRO.leaveMs); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("holds remote keys back, then Back skips it after 1 s without reaching the Player", async () => {
    const onDone = vi.fn();
    const below = vi.fn();
    window.addEventListener("keydown", below);
    render(<PreMovieBumper tv end={false} onDone={onDone} />);
    await settle();
    fireEvent.keyDown(window, { key: "Escape", keyCode: 27 });
    await act(async () => { await vi.advanceTimersByTimeAsync(INTRO.leaveMs + 10); });
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(INTRO.skipAfterMs); });
    const skip = document.querySelector<HTMLButtonElement>("[data-premovie] .intro-skip")!;
    expect(document.activeElement).toBe(skip);
    fireEvent.keyDown(window, { key: "Escape", keyCode: 27 });
    await act(async () => { await vi.advanceTimersByTimeAsync(INTRO.leaveMs); });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(below).not.toHaveBeenCalled();
    window.removeEventListener("keydown", below);
  });

  it("never stays up longer than 4.2 s", async () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    const onDone = vi.fn();
    render(<PreMovieBumper tv end={false} onDone={onDone} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(4200); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
