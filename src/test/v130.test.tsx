import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useEffect } from "react";
import { BEATS, beatsFor, Intro, IntroBoundary, introSoundAllowed, scheduleIntro, useIntro } from "../components/Intro";
import { getIntroPhase, introActive, setIntroPhase } from "../lib/launch";
import { saveMutedMemory, unlockAudio } from "../lib/audio";
import { actions } from "../lib/store";
import { playIntroScore } from "../lib/introScore";
import { splitWall, wallLayers } from "../components/PosterWall";
import { dissolveIntoHome, PUSH_MS } from "../pages/Profiles";
import introCss from "../styles/intro.css?raw";
import tokensCss from "../styles/tokens.css?raw";
import profilesCss from "../pages/profiles.css?raw";
import tvCss from "../styles/tv.css?raw";
import introSrc from "../components/Intro.tsx?raw";
import appSrc from "../App.tsx?raw";
import remoteSrc from "../lib/remote.ts?raw";
import profilesSrc from "../pages/Profiles.tsx?raw";
import mainActivity from "../../android/app/src/main/java/com/kinoma/tv/ui/MainActivity.kt?raw";

/** The app shell as the intro sees it: the real hook and overlay, with a focused button and key handler underneath. */
function Harness({ tv = true, onAppKey, onAppClick }: { tv?: boolean; onAppKey: (e: KeyboardEvent) => void; onAppClick: () => void }) {
  const intro = useIntro(tv);
  useEffect(() => {
    window.addEventListener("keydown", onAppKey);
    return () => window.removeEventListener("keydown", onAppKey);
  }, [onAppKey]);
  return (
    <div>
      <button id="under" onClick={onAppClick}>Profile</button>
      <button id="other">Other</button>
      {intro.phase !== "done" && <IntroBoundary onError={intro.end}><Intro tv={intro.tv} phase={intro.phase} reduce={intro.reduce} beats={intro.beats} /></IntroBoundary>}
    </div>
  );
}

const overlay = () => document.querySelector("[data-intro]");

describe("v1.3.0 launch intro: cannot be skipped", () => {
  beforeEach(() => { sessionStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); sessionStorage.clear(); setIntroPhase("done"); });

  it("ignores every key, tap and click and never moves focus underneath", () => {
    const onAppKey = vi.fn(); const onAppClick = vi.fn();
    render(<Harness onAppKey={onAppKey} onAppClick={onAppClick} />);
    const under = document.getElementById("under") as HTMLButtonElement;
    under.focus();
    expect(overlay()).not.toBeNull();
    for (const key of ["Enter", "Escape", " ", "ArrowRight", "ArrowDown", "Backspace", "Tab", "MediaPlayPause"]) {
      const ev = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      document.activeElement!.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
    }
    // the Android shell delivers Back as an Escape keydown on the focused element
    under.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true, cancelable: true }));
    fireEvent.pointerDown(overlay()!); fireEvent.mouseDown(overlay()!); fireEvent.click(overlay()!);
    fireEvent.touchStart(overlay()!); fireEvent.touchEnd(overlay()!);
    fireEvent.click(under);
    fireEvent.wheel(overlay()!);
    act(() => { vi.advanceTimersByTime(BEATS.tv.leave - 50); });
    expect(onAppKey).not.toHaveBeenCalled();
    expect(onAppClick).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(under);
    expect(overlay()).not.toBeNull();
    expect(getIntroPhase()).toBe("show");
    expect(introActive()).toBe(true);
  });

  it("has no skip code left: no pointer handler on the overlay and no skip()", () => {
    expect(introSrc).not.toContain("onPointerDown");
    expect(introSrc).not.toMatch(/\bskip\(/);
    expect(appSrc).not.toContain("skip={");
  });

  it("ends on the timeline (TV 3.6 s, phone 2.4 s) and lets input through again", () => {
    const onAppKey = vi.fn();
    render(<Harness onAppKey={onAppKey} onAppClick={() => undefined} />);
    act(() => { vi.advanceTimersByTime(BEATS.tv.leave); });
    expect(overlay()?.className).toContain("is-leaving");
    expect(introActive()).toBe(true);
    act(() => { vi.advanceTimersByTime(BEATS.tv.done - BEATS.tv.leave); });
    expect(overlay()).toBeNull();
    expect(getIntroPhase()).toBe("done");
    expect(sessionStorage.getItem("panda:splash")).toBe("1");
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onAppKey).toHaveBeenCalledTimes(1);
    expect(BEATS.m.done).toBe(2400);
    expect(BEATS.m.burst).toBe(1500);
    expect(BEATS.m.eyes).toBe(200);
  });

  it("follows the TV beat sheet", () => {
    expect(BEATS.tv).toMatchObject({ eyes: 400, blink: 1000, face: 1500, zoom: 2000, burst: 2600, horizon: 3000, leave: 3400, done: 3600 });
  });
});

describe("v1.3.0 launch intro: hard timeout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it("is 4.2 s on TV and 3.0 s on phones, in every mode", () => {
    expect(beatsFor(true, false).hard).toBe(4200);
    expect(beatsFor(false, false).hard).toBe(3000);
    expect(beatsFor(true, true).hard).toBe(4200);
    expect(beatsFor(false, true).hard).toBe(3000);
  });
  it("still ends the intro when the timeline callbacks fail", () => {
    const leave = vi.fn(() => { throw new Error("animation failed"); });
    let calls = 0;
    const done = vi.fn(() => { calls++; if (calls === 1) throw new Error("first end failed"); });
    scheduleIntro(BEATS.tv, leave, done);
    vi.advanceTimersByTime(BEATS.tv.done);
    expect(done).toHaveBeenCalled(); // the failing leave tried to finish early, then done threw
    vi.advanceTimersByTime(BEATS.tv.hard - BEATS.tv.done);
    expect(calls).toBeGreaterThanOrEqual(2);
    const last = done.mock.results.at(-1);
    expect(last?.type).toBe("return");
  });
  it("ends exactly once when nothing fails", () => {
    const done = vi.fn();
    scheduleIntro(BEATS.m, () => undefined, done);
    vi.advanceTimersByTime(BEATS.m.hard + 1000);
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("removes itself if the overlay throws while rendering", () => {
    const onError = vi.fn();
    const Boom = () => { throw new Error("render failed"); };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { container } = render(<IntroBoundary onError={onError}><Boom /></IntroBoundary>);
    spy.mockRestore();
    expect(container.innerHTML).toBe("");
    expect(onError).toHaveBeenCalled();
    cleanup();
  });
});

describe("v1.3.0 launch intro: fresh start only", () => {
  beforeEach(() => { sessionStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); sessionStorage.clear(); history.replaceState(null, "", "/"); setIntroPhase("done"); });
  it("plays on a fresh session", () => {
    render(<Harness onAppKey={() => undefined} onAppClick={() => undefined} />);
    expect(overlay()).not.toBeNull();
  });
  it("does not play once this session has started", () => {
    sessionStorage.setItem("panda:splash", "1");
    render(<Harness onAppKey={() => undefined} onAppClick={() => undefined} />);
    expect(overlay()).toBeNull();
    expect(introActive()).toBe(false);
  });
  it("does not play when Android recreated the activity (?resumed=1)", () => {
    history.replaceState(null, "", "/?resumed=1");
    render(<Harness onAppKey={() => undefined} onAppClick={() => undefined} />);
    expect(overlay()).toBeNull();
  });
});

describe("v1.3.0 launch intro: reduced motion", () => {
  beforeEach(() => { sessionStorage.clear(); vi.useFakeTimers(); actions.setPrefs({ reduceMotion: true }); });
  afterEach(() => { cleanup(); vi.useRealTimers(); sessionStorage.clear(); actions.setPrefs({ reduceMotion: false }); setIntroPhase("done"); });
  it("shows a 0.6 s still frame (eyes + panda), no ribbons, then fades, and is still not skippable", () => {
    const onAppKey = vi.fn();
    render(<Harness onAppKey={onAppKey} onAppClick={() => undefined} />);
    const el = overlay()!;
    expect(el.className).toContain("intro--still");
    expect(el.querySelector(".intro-face")).not.toBeNull();
    expect(el.querySelectorAll(".intro-eye")).toHaveLength(2);
    expect(el.querySelector(".intro-ribbons")).toBeNull();
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(onAppKey).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(599); });
    expect(overlay()?.className).not.toContain("is-leaving");
    act(() => { vi.advanceTimersByTime(1); });
    expect(overlay()?.className).toContain("is-leaving");
    act(() => { vi.advanceTimersByTime(250); });
    expect(overlay()).toBeNull();
  });
  it("keeps the still frame in CSS and fades even with Settings › Reduce motion", () => {
    expect(introCss).toContain(".intro--still .intro-zoom");
    expect(introCss).toContain('html[data-motion="reduce"] .intro { transition-duration: 250ms !important; }');
  });
});

describe("v1.3.0 launch intro: no text, palette, horizon handoff", () => {
  beforeEach(() => { sessionStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); setIntroPhase("done"); });
  it("renders no words, only eyes, face, ribbons and the horizon", () => {
    render(<Harness onAppKey={() => undefined} onAppClick={() => undefined} />);
    expect(overlay()!.textContent).toBe("");
    expect(overlay()!.querySelectorAll(".intro-ribbons i").length).toBeGreaterThanOrEqual(5);
    expect(overlay()!.querySelector(".intro-horizon")).not.toBeNull();
  });
  it("uses #050507, the named keyframes, screen blending and the shared --horizon", () => {
    expect(introCss).toContain("background: #050507");
    for (const k of ["eyes-in", "eyes-blink", "face-in", "zoom-in", "ribbon-burst", "horizon-draw"]) expect(introCss).toContain(`@keyframes ${k}`);
    expect(introCss).toContain("mix-blend-mode: screen");
    expect(introCss).toContain("var(--i) * 30ms");
    expect(introCss).toContain("top: var(--horizon)");
    expect(tokensCss).toContain("--horizon: 78%");
    expect(tokensCss).toContain('html[data-mode="mobile"] { --horizon: 68%; }');
    expect(profilesCss).toContain("top: var(--horizon)");
  });
  it("animates only transform and opacity", () => {
    const frames = introCss.match(/@keyframes [\w-]+ \{[^@]*?\} \}/g) ?? [];
    expect(frames.length).toBeGreaterThanOrEqual(9);
    for (const f of frames) {
      const props = [...f.matchAll(/([a-z-]+):/g)].map((m) => m[1]);
      for (const p of props) expect(["transform", "opacity"]).toContain(p);
    }
  });
});

/* ---------------- audio ---------------- */

type Rec = { type: string; freq: number; start: number };
/** A recording AudioContext: every node accepts any call; oscillators record their frequency and start time. */
function fakeAudio(state: "running" | "suspended" = "running") {
  const oscs: Rec[] = [];
  const created: string[] = [];
  const param = (v = 0) => ({ value: v, setValueAtTime(x: number) { this.value = x; }, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setValueCurveAtTime() {}, setTargetAtTime() {} });
  const node = (): Record<string, unknown> => {
    const n: Record<string, unknown> = { connect: (x: unknown) => x, disconnect() {}, start() {}, stop() {}, gain: param(1), frequency: param(440), Q: param(1), detune: param(0), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() };
    return n;
  };
  class Ctx {
    currentTime = 0; sampleRate = 8000; state = state; destination = node();
    constructor() { created.push("ctx"); }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
    createGain() { return node(); }
    createBiquadFilter() { return node(); }
    createDynamicsCompressor() { return node(); }
    createConvolver() { return node(); }
    createWaveShaper() { return node(); }
    createBufferSource() { return node(); }
    createBuffer(ch: number, len: number) { return { getChannelData: () => new Float32Array(len), numberOfChannels: ch }; }
    createOscillator() {
      const o = node(); const f = o.frequency as ReturnType<typeof param>;
      o.start = (t: number) => oscs.push({ type: String(o.type), freq: f.value, start: t });
      return o;
    }
  }
  return { Ctx, oscs, created };
}

describe("v1.3.0 intro score (Web Audio)", () => {
  const original = window.AudioContext;
  afterEach(() => { window.AudioContext = original; localStorage.removeItem("panda:muted"); actions.setPrefs({ volume: 1 }); vi.useRealTimers(); });

  it("stays silent while audio is locked: no AudioContext is created", async () => {
    vi.resetModules();
    const fresh = await import("../components/Intro");
    const audio = await import("../lib/audio");
    expect(audio.isAudioUnlocked()).toBe(false);
    expect(fresh.introSoundAllowed()).toBe(0);
    const fake = fakeAudio();
    window.AudioContext = fake.Ctx as unknown as typeof AudioContext;
    sessionStorage.clear();
    vi.useFakeTimers();
    const { Intro: I, beatsFor: bf } = fresh;
    render(<I tv phase="show" reduce={false} beats={bf(true, false)} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(fake.created).toHaveLength(0);
    // the visuals still run in full
    expect(document.querySelector(".intro-ribbons")).not.toBeNull();
    cleanup();
  });

  it("respects the app's mute memory and volume", () => {
    unlockAudio();
    actions.setPrefs({ volume: 0.5 });
    expect(introSoundAllowed()).toBe(0.5);
    saveMutedMemory(true);
    expect(introSoundAllowed()).toBe(0);
    saveMutedMemory(false);
    actions.setPrefs({ volume: 0 });
    expect(introSoundAllowed()).toBe(0);
  });

  it("puts one deep drum hit on the burst beat, with sub, tick, swell, riser and hum around it", () => {
    vi.useFakeTimers();
    const fake = fakeAudio();
    window.AudioContext = fake.Ctx as unknown as typeof AudioContext;
    const stop = playIntroScore({ beats: BEATS.tv, start: performance.now(), volume: 1, still: false, tv: true });
    const at = (f: number) => fake.oscs.filter((o) => Math.abs(o.freq - f) < 0.5);
    const drum = at(125);
    expect(drum).toHaveLength(1);
    expect(drum[0]!.start).toBeCloseTo(2.6 + 0.03, 1);
    expect(at(40)[0]!.start).toBeCloseTo(2.63, 1);       // sub tail of the hit
    expect(at(36)[0]!.start).toBeCloseTo(0.03, 1);       // faint sub-rumble from the first frame
    expect(at(170)[0]!.start).toBeGreaterThan(1.0);       // blink tick inside the blink
    expect(at(170)[0]!.start).toBeLessThan(1.5);
    expect(at(110).some((o) => o.type === "triangle" && Math.abs(o.start - 1.53) < 0.05)).toBe(true); // warm swell
    expect(at(90)[0]!.start).toBeCloseTo(2.03, 1);       // riser
    expect(at(55).some((o) => Math.abs(o.start - 3.03) < 0.05)).toBe(true); // hum after the horizon
    stop();
  });

  it("uses the phone beats: the drum lands at 1.5 s", () => {
    const fake = fakeAudio();
    window.AudioContext = fake.Ctx as unknown as typeof AudioContext;
    playIntroScore({ beats: BEATS.m, start: performance.now(), volume: 1, still: false, tv: false });
    expect(fake.oscs.find((o) => o.freq === 125)!.start).toBeCloseTo(1.53, 1);
  });

  it("plays a single soft tone in reduced motion, with no drum", () => {
    const fake = fakeAudio();
    window.AudioContext = fake.Ctx as unknown as typeof AudioContext;
    playIntroScore({ beats: beatsFor(true, true), start: performance.now(), volume: 1, still: true, tv: true });
    expect(fake.oscs.some((o) => o.freq === 125)).toBe(false);
    expect(fake.oscs.some((o) => o.freq === 220)).toBe(true);
  });

  it("never throws without Web Audio", () => {
    window.AudioContext = undefined as unknown as typeof AudioContext;
    expect(() => playIntroScore({ beats: BEATS.tv, start: 0, volume: 1, still: false, tv: true })()).not.toThrow();
    window.AudioContext = class { constructor() { throw new Error("no device"); } } as unknown as typeof AudioContext;
    expect(() => playIntroScore({ beats: BEATS.tv, start: 0, volume: 1, still: false, tv: true })()).not.toThrow();
  });

  it("uses no audio files, loads lazily, and the Android shell allows sound on a cold start", () => {
    expect(introSrc).toContain('import("../lib/introScore")');
    expect(introSrc).not.toMatch(/\.(mp3|ogg|wav|m4a)/);
    expect(mainActivity).toContain("mediaPlaybackRequiresUserGesture = false");
  });
});

/* ---------------- Who's watching ---------------- */

describe("v1.3.0 Who's watching", () => {
  it("draws 3 depth layers on TV, 2 on phones, 1 in lite mode", () => {
    expect(wallLayers(true, false).map((l) => l.key)).toEqual(["far", "mid", "near"]);
    expect(wallLayers(false, false).map((l) => l.key)).toEqual(["far", "near"]);
    expect(wallLayers(true, true)).toEqual([{ key: "near", cols: 6, speed: 1 }]);
    expect(wallLayers(false, true)[0]!.cols).toBe(4);
    // far layers drift more slowly (parallax)
    const [far, mid, near] = wallLayers(true, false);
    expect(far!.speed).toBeGreaterThan(mid!.speed);
    expect(mid!.speed).toBeGreaterThan(near!.speed);
  });
  it("keeps the near band free of repeats and fills every layer", () => {
    const posters = Array.from({ length: 60 }, (_, i) => `p${i}.jpg`);
    const cols = splitWall(posters, wallLayers(true, false));
    expect(cols.map((l) => l.length)).toEqual([12, 9, 7]);
    const near = cols[2]!.flat();
    expect(new Set(near).size).toBe(near.length);
    expect(splitWall(posters.slice(0, 20), wallLayers(true, false))).toEqual([]);
  });
  it("blurs only far layers, statically, and keeps the blueprint colours and horizon", () => {
    expect(profilesCss).toMatch(/\.poster-wall-layer--far img \{[^}]*filter: blur/);
    expect(profilesCss).toMatch(/\.poster-wall-layer--mid img \{[^}]*filter: blur/);
    expect(profilesCss).not.toMatch(/\.poster-wall-layer--near img \{[^}]*filter/);
    expect(profilesCss).toContain("color: #A9DCFF");
    expect(profilesCss).toContain("color: #7FA6C9");
    expect(tvCss).toContain("top: calc(var(--horizon) - 6 * var(--u) - 60 * var(--tu))");
    expect(profilesCss).toContain(".profile-btn:focus .profile-lift");
  });
  it("keeps preload + whoDone, waits for the intro and pushes in before Home", () => {
    expect(profilesSrc).toContain("void preload(keys.page(kind), fetcher)");
    expect(profilesSrc).toContain("dissolveIntoHome(); whoDone();");
    expect(profilesSrc).toContain('const waiting = introPhase === "show";');
    expect(PUSH_MS).toBeGreaterThanOrEqual(500);
    expect(PUSH_MS).toBeLessThanOrEqual(700);
  });
  it("dissolves into Home with a veil that always removes itself", () => {
    vi.useFakeTimers();
    dissolveIntoHome();
    expect(document.querySelectorAll(".who-veil")).toHaveLength(1);
    vi.advanceTimersByTime(900);
    expect(document.querySelectorAll(".who-veil")).toHaveLength(0);
    vi.useRealTimers();
  });
  it("ignores phone-remote text while the intro plays", () => {
    expect(remoteSrc).toContain("if (!introActive()) typeIntoTv(text, open)");
  });
});
