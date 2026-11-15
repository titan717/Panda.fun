import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { INTRO, INTRO_KEY, introDue, markIntroSeen, planIntro, resetIntroDecision, type IntroConfig } from "../lib/intro";
import { IntroOverlay, LaunchIntro } from "../components/Intro";
import { getIntroPhase, introActive, setIntroPhase } from "../lib/launch";
import introSrc from "../components/Intro.tsx?raw";
import docs from "../../docs/INTRO.md?raw";

const overlay = () => document.querySelector<HTMLElement>("[data-intro]");
const key = (k: string, keyCode = 0) => fireEvent.keyDown(window, { key: k, keyCode });

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); resetIntroDecision(); setIntroPhase("done"); vi.useFakeTimers(); history.replaceState(null, "", "/"); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Intro Manager: startup rules", () => {
  it("defaults to playing on every cold start, but not again in the same tab or process", () => {
    expect(INTRO.replay).toBe("every-cold-start");
    expect(introDue()).toBe(true);
    markIntroSeen();
    resetIntroDecision(); // reload / deep link in the same tab
    expect(introDue()).toBe(false);
    sessionStorage.clear(); resetIntroDecision(); // app process restarted
    expect(introDue()).toBe(true);
  });
  it("in once-per-version mode is due on a cold start, then never again for that version", () => {
    expect(introDue(INTRO.version, "once-per-version")).toBe(true);
    expect(introDue(INTRO.version, "once-per-version")).toBe(true); // stable within the load (StrictMode, rerender)
    markIntroSeen();
    expect(introDue(INTRO.version, "once-per-version")).toBe(false);
    sessionStorage.clear(); resetIntroDecision(); // next cold start
    expect(introDue(INTRO.version, "once-per-version")).toBe(false);
    expect(JSON.parse(localStorage.getItem(INTRO_KEY)!).seen[INTRO.version]).toBeTypeOf("number");
  });
  it("plays again once when the version is bumped", () => {
    markIntroSeen("old"); sessionStorage.clear(); resetIntroDecision();
    expect(introDue("new", "once-per-version")).toBe(true);
  });
  it("does not play on an Android activity recreation (?resumed=1)", () => {
    history.replaceState(null, "", "/?resumed=1");
    expect(introDue()).toBe(false);
  });
  it("survives corrupt saved data", () => {
    localStorage.setItem(INTRO_KEY, "{oops");
    expect(introDue()).toBe(true);
    markIntroSeen();
    expect(JSON.parse(localStorage.getItem(INTRO_KEY)!).seen).toBeTruthy();
  });
  it("never replays on rerender or remount in the same load", () => {
    const r = render(<LaunchIntro tv />);
    expect(overlay()).not.toBeNull();
    act(() => { vi.advanceTimersByTime(INTRO.durationMs.tv + INTRO.hardPadMs + 50); });
    expect(overlay()).toBeNull();
    r.rerender(<LaunchIntro tv={false} />);
    r.unmount();
    render(<LaunchIntro tv />);
    expect(overlay()).toBeNull();
  });
});

describe("Intro Manager: plans", () => {
  it("TV plays the 1280x720 placeholder video; phones the mascot animation (≤ 2.5 s)", () => {
    const tv = planIntro({ tv: true, reduce: false })!;
    expect(tv).toMatchObject({ view: "video", fit: "contain" });
    expect(tv.src).toMatch(/intro\/intro-tv\.mp4$/);
    const m = planIntro({ tv: false, reduce: false })!;
    expect(m.view).toBe("animation");
    expect(m.durationMs + m.leaveMs).toBeLessThanOrEqual(2500);
  });
  it("a mobile video is one path away; shared is used when a platform has none", () => {
    const cfg: IntroConfig = { ...INTRO, mobile: { kind: "video", src: "/intro/intro-mobile.mp4", width: 1080, height: 1920, fit: "cover" } };
    expect(planIntro({ tv: false, reduce: false }, cfg)).toMatchObject({ view: "video", src: "/intro/intro-mobile.mp4", fit: "cover" });
    const shared: IntroConfig = { ...INTRO, tv: null, shared: { kind: "animation" } };
    expect(planIntro({ tv: true, reduce: false }, shared)!.view).toBe("animation");
  });
  it("reduced motion shows the static still, or nothing when configured to skip", () => {
    expect(planIntro({ tv: true, reduce: true })).toMatchObject({ view: "static", durationMs: INTRO.staticMs });
    expect(planIntro({ tv: true, reduce: true }, { ...INTRO, reducedMotion: "skip" })).toBeNull();
  });
  it("hard timeout is duration + 2 s", () => {
    for (const tv of [true, false]) { const p = planIntro({ tv, reduce: false })!; expect(p.hardMs).toBe(p.durationMs + 2000); }
  });
});

describe("Intro overlay", () => {
  const plan = (tv: boolean, reduce = false) => planIntro({ tv, reduce })!;

  it("preloads only the active platform's video (preload=auto, muted, inline)", () => {
    render(<IntroOverlay plan={plan(true)} tv />);
    const v = document.querySelectorAll("video");
    expect(v).toHaveLength(1);
    expect(v[0]!.getAttribute("preload")).toBe("auto");
    expect(v[0]!.muted).toBe(true);
    cleanup();
    render(<IntroOverlay plan={plan(false)} tv={false} />);
    expect(document.querySelector("video")).toBeNull();
  });
  it("can be skipped after skipAfterMs: Skip button, and OK/Back on TV", () => {
    const done = vi.fn();
    render(<IntroOverlay plan={plan(true)} tv onDone={done} />);
    expect(document.querySelector(".intro-skip")).toBeNull();
    key("Enter", 13); // too early: held back, nothing happens
    act(() => { vi.advanceTimersByTime(INTRO.skipAfterMs + 10); });
    const btn = document.querySelector<HTMLButtonElement>(".intro-skip")!;
    expect(btn).not.toBeNull();
    expect(btn.getAttribute("aria-label")).toBe("Skip intro");
    expect(document.activeElement).toBe(btn); // focused for the D-pad
    act(() => { key("Escape", 27); });
    expect(overlay()!.className).toContain("is-leaving");
    act(() => { vi.advanceTimersByTime(INTRO.leaveMs + 10); });
    expect(done).toHaveBeenCalledTimes(1);
    expect(introDue()).toBe(false);
  });
  it("keeps keys from reaching the app while it is up", () => {
    const app = vi.fn();
    window.addEventListener("keydown", app);
    render(<IntroOverlay plan={plan(true)} tv />);
    key("ArrowDown", 40);
    expect(app).not.toHaveBeenCalled();
    window.removeEventListener("keydown", app);
  });
  it("Skip on phones is a tappable button", () => {
    const done = vi.fn();
    render(<IntroOverlay plan={plan(false)} tv={false} onDone={done} />);
    act(() => { vi.advanceTimersByTime(INTRO.skipAfterMs + 10); });
    act(() => { fireEvent.click(document.querySelector(".intro-skip")!); vi.advanceTimersByTime(INTRO.leaveMs + 10); });
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("phone animation ends on its own at ~2.2 s", () => {
    const done = vi.fn();
    render(<IntroOverlay plan={plan(false)} tv={false} onDone={done} />);
    expect(overlay()!.dataset.view).toBe("animation");
    act(() => { vi.advanceTimersByTime(INTRO.durationMs.mobile + INTRO.leaveMs + 20); });
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("a broken video falls back to the branded still (~1.2 s), then ends", () => {
    const done = vi.fn();
    render(<IntroOverlay plan={plan(true)} tv onDone={done} />);
    act(() => { fireEvent.error(document.querySelector("video")!); });
    expect(overlay()!.dataset.view).toBe("static");
    expect(document.querySelector(".intro-mascot")).not.toBeNull();
    act(() => { vi.advanceTimersByTime(INTRO.staticMs + INTRO.leaveMs + 20); });
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("a video that never starts is replaced by the still after startTimeoutMs", () => {
    // happy-dom's play() fires "playing" at once; model a stalled decoder instead
    const spy = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => new Promise<void>(() => {}));
    render(<IntroOverlay plan={plan(true)} tv />);
    act(() => { vi.advanceTimersByTime(INTRO.startTimeoutMs + 10); });
    expect(overlay()!.dataset.view).toBe("static");
    spy.mockRestore();
  });
  it("a playing video ends on 'ended'", () => {
    const done = vi.fn();
    render(<IntroOverlay plan={plan(true)} tv onDone={done} />);
    const v = document.querySelector("video")!;
    act(() => { fireEvent(v, new Event("playing")); vi.advanceTimersByTime(INTRO.startTimeoutMs + 10); });
    expect(overlay()!.dataset.view).toBe("video");
    act(() => { fireEvent(v, new Event("ended")); vi.advanceTimersByTime(INTRO.leaveMs + 10); });
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("hard timeout: the app is never blocked longer than duration + 2 s, even if the video stalls", () => {
    const done = vi.fn();
    render(<IntroOverlay plan={plan(true)} tv onDone={done} />);
    act(() => { fireEvent(document.querySelector("video")!, new Event("playing")); });
    act(() => { vi.advanceTimersByTime(INTRO.durationMs.tv + 2000); });
    expect(done).toHaveBeenCalledTimes(1);
    expect(getIntroPhase()).toBe("done");
    expect(introActive()).toBe(false);
  });
  it("reduced motion: the still frame, no video, no animation", () => {
    render(<IntroOverlay plan={plan(true, true)} tv />);
    expect(overlay()!.dataset.view).toBe("static");
    expect(document.querySelector("video")).toBeNull();
    expect(document.querySelector(".intro-anim")).toBeNull();
  });
  it("uses only the brand manager's asset paths and documents asset replacement", () => {
    expect(introSrc).toContain("BRAND.mascot");
    expect(introSrc).not.toMatch(/["']\/?brand\//);
    expect(docs).toContain("intro-tv.mp4");
    expect(docs).toContain("version");
  });
});
