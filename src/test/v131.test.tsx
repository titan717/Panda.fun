import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { BEATS, beatsFor, Intro, IntroBoundary, scheduleIntro, useIntro } from "../components/Intro";
import { dropTracker, EYE_L, FPS, frameMs, frameOf, PIECES, POPS, RETRO, retroFrame, RetroIntro, STILL_FRAME, ZOOM_MAX } from "../components/IntroTv";
import { setIntroPhase } from "../lib/launch";
import { playIntroScore } from "../lib/introScore";
import tvSrc from "../components/IntroTv.tsx?raw";
import introSrc from "../components/Intro.tsx?raw";
import tvCss from "../styles/intro-tv.css?raw";
import pkgRaw from "../../package.json?raw";
import lockRaw from "../../package-lock.json?raw";
import readme from "../../README.md?raw";
import changelog from "../../docs/CHANGELOG.md?raw";
import notes from "../../docs/release-notes/v1.3.1.md?raw";
import gradle from "../../android/app/build.gradle?raw";

function Harness({ tv = true }: { tv?: boolean }) {
  const intro = useIntro(tv);
  return intro.phase !== "done" ? <IntroBoundary onError={intro.end}><Intro tv={intro.tv} phase={intro.phase} reduce={intro.reduce} beats={intro.beats} /></IntroBoundary> : null;
}
const overlay = () => document.querySelector("[data-intro]");

describe("v1.3.1 TV intro: 12 fps stepped film", () => {
  it("steps on twos: 12 drawings a second, the same drawing inside each step", () => {
    expect(FPS).toBe(12);
    expect(frameOf(0)).toBe(0);
    expect(frameOf(83)).toBe(0);
    expect(frameOf(84)).toBe(1);
    expect(frameOf(1000)).toBe(12);
    expect(retroFrame(7)).toEqual(retroFrame(7)); // deterministic: a frame always draws the same
    expect(frameOf(RETRO.done)).toBe(60);
  });

  it("opens on the eyes in the dark: left, then right, a blink, with the blue anamorphic streak", () => {
    const f0 = retroFrame(0);
    expect(Object.keys(f0.pieces)).toHaveLength(0);
    expect(f0.eyeL || f0.eyeR).toBe(false);
    expect(f0.iris).toBe(230); // the iris starts closed around the eyes
    const l = retroFrame(frameOf(RETRO.eyeL) + 1);
    expect(l.eyeL).toBe(true);
    expect(l.eyeR).toBe(false);
    expect(l.streak).not.toBeNull();
    const both = retroFrame(frameOf(RETRO.eyeR) + 1);
    expect(both.eyeL && both.eyeR).toBe(true);
    const blink = retroFrame(frameOf(RETRO.blink));
    expect(blink.eyeL || blink.eyeR).toBe(false);
    expect(blink.streak).toBeNull();
    const after = retroFrame(frameOf(RETRO.blinkEnd) + 1);
    expect(after.eyeL && after.eyeR).toBe(true);
    // no pieces before the assembly
    expect(Object.keys(retroFrame(frameOf(RETRO.assemble) - 1).pieces)).toHaveLength(0);
  });

  it("irises in over 1 s in 8 steps while the panda assembles piece by piece", () => {
    const radii = new Set<number>();
    for (let f = frameOf(RETRO.assemble); f < frameOf(RETRO.assemble + RETRO.iris); f++) radii.add(retroFrame(f).iris!);
    expect(radii.size).toBeGreaterThan(4);
    expect(radii.size).toBeLessThanOrEqual(9);
    expect(retroFrame(frameOf(RETRO.assemble + RETRO.iris) + 1).iris).toBeNull();
    // every piece pops in on its frame with a jolt, then settles 4 frames later
    for (const p of PIECES) {
      const f = frameOf(p.at);
      expect(retroFrame(f - 1).pieces[p.id]).toBeUndefined();
      expect(retroFrame(f).pieces[p.id]).toMatch(/^translate\(.+\) rotate\(.+\) scale\(0\.86\)/);
      expect(retroFrame(f + 4).pieces[p.id]).toBe("");
    }
    // the whole panda: cartoon outline, headphones, shades, smirk, bamboo
    expect(PIECES.map((p) => p.id)).toEqual(expect.arrayContaining(["head", "phones", "shades", "mouth", "bamboo", "earL", "earR", "nose", "brows"]));
    expect(Object.keys(retroFrame(frameOf(RETRO.zoom)).pieces)).toHaveLength(PIECES.length);
  });

  it("glints on the shades, then zooms in steps into the left eye and fades onto the horizon", () => {
    expect(retroFrame(frameOf(RETRO.glint) - 1).glint).toBeNull();
    expect(retroFrame(frameOf(RETRO.glint) + 1).glint).not.toBeNull();
    expect(retroFrame(frameOf(RETRO.glintEnd)).glint).toBeNull();
    expect(retroFrame(frameOf(RETRO.zoom)).scale).toBe(1);
    expect(retroFrame(frameOf(RETRO.zoom)).cam).toBe("");
    const mid = retroFrame(frameOf((RETRO.zoom + RETRO.inside) / 2));
    expect(mid.scale).toBeGreaterThan(1);
    expect(mid.scale).toBeLessThan(ZOOM_MAX);
    const inside = retroFrame(frameOf(RETRO.inside));
    expect(inside.scale).toBeCloseTo(ZOOM_MAX, 0);
    expect(inside.cam).toContain(`translate(${-EYE_L[0]} ${-EYE_L[1]})`);
    expect(inside.shadows).toBe(false); // no shadow filter on a 24x world
    expect(retroFrame(frameOf(RETRO.fade) - 1).fade).toBe(0);
    expect(retroFrame(frameOf(RETRO.fade + RETRO.fadeLen)).fade).toBe(1);
    expect(RETRO.horizon).toBeGreaterThan(RETRO.fade + RETRO.fadeLen - 200); // the horizon draws onto black
    expect(RETRO.done).toBe(5000);
    expect(RETRO.hard).toBe(6000);
  });

  it("boils, grains, scratches and flashes the corner cue mark", () => {
    const seeds = new Set(Array.from({ length: 12 }, (_, f) => retroFrame(f).boilSeed));
    expect(seeds.size).toBe(6);
    expect(retroFrame(3).grain).not.toEqual(retroFrame(4).grain);
    const scratched = Array.from({ length: 60 }, (_, f) => retroFrame(f).scratches).filter(Boolean).length;
    expect(scratched).toBeGreaterThan(3);
    expect(scratched).toBeLessThan(40);
    expect([3, 4, 5, 6, 7].map((f) => retroFrame(f).cue)).toEqual([false, true, true, true, false]);
    expect(retroFrame(frameOf(RETRO.inside)).cue).toBe(true);
  });

  it("falls back to lite effects only when the TV keeps dropping drawings after the boot", () => {
    const smooth = dropTracker();
    expect(Array.from({ length: 60 }, (_, i) => smooth(i + 1)).some(Boolean)).toBe(false);
    const boot = dropTracker(); // a stall while the app loads underneath is forgiven
    expect([1, 5, 6, 7, 8].map(boot).some(Boolean)).toBe(false);
    const late = dropTracker();
    expect([1, 2, 3, 4, 5, 6, 8, 10].map(late).at(-1)).toBe(false); // 2 drops
    expect(late(13)).toBe(true); // 2 more: 4 in total
    expect(late(14)).toBe(true); // and it stays on
  });

  it("reduced motion: one settled still of the assembled panda, nothing moving", () => {
    const s = retroFrame(STILL_FRAME, true);
    expect(Object.values(s.pieces)).toHaveLength(PIECES.length);
    expect(Object.values(s.pieces).every((t) => t === "")).toBe(true);
    expect(s.eyeL && s.eyeR).toBe(true);
    expect([s.iris, s.glint, s.streak, s.scratches]).toEqual([null, null, null, null]);
    expect([s.cue, s.fade, s.scale, s.boilSeed]).toEqual([false, 0, 1, 1]);
  });
});

describe("v1.3.1 TV intro: look and palette", () => {
  afterEach(() => { cleanup(); setIntroPhase("done"); });
  const hexes = (src: string) => [...src.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)].map((m) => m[1]!.length === 3 ? m[1]!.split("").map((c) => c + c).join("") : m[1]!);
  const hue = (h: string) => {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (d === 0) return { h: 0, s: 0 };
    const hh = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: (hh * 60 + 360) % 360, s: max === 0 ? 0 : d / max };
  };

  it("uses no crimson or red anywhere in the TV film", () => {
    const all = [...hexes(tvSrc), ...hexes(tvCss)];
    expect(all.length).toBeGreaterThan(10);
    for (const h of all) {
      const { h: deg, s } = hue(h);
      const red = s > 0.35 && (deg >= 330 || deg < 20);
      expect(red, `#${h} is red`).toBe(false);
    }
    expect(tvCss).not.toMatch(/rgba?\(\s*(1[5-9]\d|2\d\d)\s*,\s*([0-6]?\d)\s*,\s*([0-9]?\d)\s*[,)]/);
  });

  it("draws glowing blue eyes with gold lens rings, the blue streak and the panda details", () => {
    expect(tvSrc).toContain('fill="#36b3ff"');
    expect(tvSrc).toContain('stroke="#d6b477"');
    expect(tvSrc).toContain('stopColor="#2f9bff"');
    render(<RetroIntro reduce lite={false} />);
    const root = document.querySelector(".intro-retro")!;
    expect(root.getAttribute("data-frame")).toBe(String(STILL_FRAME));
    expect(root.querySelectorAll("[data-eye]")).toHaveLength(2);
    expect(root.querySelectorAll("[data-ring]")).toHaveLength(2);
    for (const id of ["head", "phones", "shades", "mouth", "bamboo", "earL", "earR", "nose"]) expect(root.querySelector(`[data-piece="${id}"]`), id).not.toBeNull();
    expect(root.querySelector('[data-piece="head"]')!.getAttribute("stroke")).toBe("#101010"); // cartoon outline
    expect(root.querySelector("[data-iris]")).toBeNull();
    expect(root.textContent).toBe("");
  });

  it("full mode has the boil filter, paper shadows, grain and tint; lite mode drops them", () => {
    render(<RetroIntro reduce={false} lite={false} />);
    expect(document.querySelector("#pf-boil feTurbulence")).not.toBeNull();
    expect(document.querySelector("#pf-boil feDropShadow#pf-paper")).not.toBeNull(); // boil + shadow in one pass
    expect(document.querySelector("[data-grain]")).not.toBeNull();
    expect(document.querySelector(".intro-retro-tint")).not.toBeNull();
    expect(document.querySelector("[data-iris]")).not.toBeNull(); // frame 0: iris closed around the eyes
    cleanup();
    render(<RetroIntro reduce={false} lite />);
    expect(document.querySelector(".intro-retro--lite")).not.toBeNull();
    expect(document.querySelector("#pf-boil")).toBeNull();
    expect(document.querySelector("#pf-paper")).toBeNull();
    expect(document.querySelector("[data-grain]")).toBeNull();
    expect(document.querySelector(".intro-retro-tint")).toBeNull();
    expect(document.querySelector(".intro-retro-vig")).not.toBeNull(); // the cheap effects stay
  });

  it("has no wordmark scene and no web font", () => {
    expect(tvSrc).not.toMatch(/<text|mypanda|Bowlby|fonts\.googleapis/);
  });
});

describe("v1.3.1 TV intro in the app shell", () => {
  beforeEach(() => { sessionStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); sessionStorage.clear(); setIntroPhase("done"); });

  it("plays the retro film on TV, with the shared horizon, and ends at 5 s", async () => {
    render(<Harness />);
    await act(async () => { await vi.dynamicImportSettled(); });
    const el = overlay()!;
    expect(el.className).toContain("intro--retro");
    expect(el.querySelector(".intro-retro")).not.toBeNull();
    expect(el.querySelector(".intro-ribbons")).toBeNull();
    expect(el.querySelector(".intro-face")).toBeNull();
    expect(el.querySelector(".intro-horizon")).not.toBeNull();
    act(() => { vi.advanceTimersByTime(RETRO.leave - 1); });
    expect(overlay()!.className).not.toContain("is-leaving");
    act(() => { vi.advanceTimersByTime(1); });
    expect(overlay()!.className).toContain("is-leaving");
    act(() => { vi.advanceTimersByTime(RETRO.done - RETRO.leave - 1); });
    expect(overlay()).not.toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    expect(overlay()).toBeNull();
  });

  it("loads the film as its own chunk: Intro.tsx never imports IntroTv statically", () => {
    const src = introSrc;
    expect(src).not.toMatch(/from "\.\/IntroTv"/);
    expect(src).toMatch(/lazy\(\(\) =>\s*import\("\.\/IntroTv"\)/);
  });

  it("runs on the overlay's clock, so a late chunk joins on the right frame", () => {
    render(<RetroIntro reduce={false} lite start={performance.now() - 2000} />);
    act(() => { vi.advanceTimersByTime(100); });
    const f = Number(document.querySelector(".intro-retro")!.getAttribute("data-frame"));
    expect(f).toBeGreaterThanOrEqual(frameOf(2000));
  });

  it("advances the film frame by frame while it plays", () => {
    render(<Harness />);
    act(() => { vi.advanceTimersByTime(2400); });
    const f = Number(document.querySelector(".intro-retro")!.getAttribute("data-frame"));
    expect(f).toBeGreaterThan(20);
    expect(f).toBeLessThanOrEqual(30);
  });

  it("keeps the v1.3.0 intro on phones", () => {
    render(<Harness tv={false} />);
    expect(overlay()!.className).not.toContain("intro--retro");
    expect(overlay()!.querySelector(".intro-retro")).toBeNull();
    expect(overlay()!.querySelector(".intro-face")).not.toBeNull();
    expect(overlay()!.querySelector(".intro-ribbons")).not.toBeNull();
  });

  it("the 6 s hard timeout ends the TV intro even when every callback fails", () => {
    let calls = 0;
    const done = vi.fn(() => { calls++; if (calls < 2) throw new Error("fail"); });
    scheduleIntro(BEATS.tv, () => { throw new Error("leave failed"); }, done);
    vi.advanceTimersByTime(BEATS.tv.hard);
    expect(done.mock.results.at(-1)?.type).toBe("return");
    expect(beatsFor(true, true)).toMatchObject({ leave: 600, done: 850, hard: 6000 });
  });
});

/* ---------------- score ---------------- */

type Rec = { type: string; freq: number; start: number };
function fakeAudio() {
  const oscs: Rec[] = [];
  const param = (v = 0) => ({ value: v, setValueAtTime(x: number) { this.value = x; }, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setValueCurveAtTime() {}, setTargetAtTime() {} });
  const node = (): Record<string, unknown> => ({ connect: (x: unknown) => x, disconnect() {}, start() {}, stop() {}, gain: param(1), frequency: param(440), Q: param(1), detune: param(0), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() });
  class Ctx {
    currentTime = 0; sampleRate = 8000; state = "running"; destination = node();
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
  return { Ctx, oscs };
}

describe("v1.3.1 TV score", () => {
  const original = window.AudioContext;
  afterEach(() => { window.AudioContext = original; vi.useRealTimers(); });

  it("lands the deep drum hit on the zoom into the eye and clicks on every pop-in", () => {
    vi.useFakeTimers();
    const fake = fakeAudio();
    window.AudioContext = fake.Ctx as unknown as typeof AudioContext;
    const stop = playIntroScore({ beats: BEATS.tv, start: performance.now(), volume: 1, still: false, tv: true });
    const at = (f: number) => fake.oscs.filter((o) => Math.abs(o.freq - f) < 0.5);
    expect(at(125)).toHaveLength(1);
    expect(at(125)[0]!.start).toBeCloseTo(RETRO.inside / 1000 + 0.03, 2);
    expect(at(90)[0]!.start).toBeCloseTo(RETRO.zoom / 1000 + 0.03, 2); // the riser runs under the zoom
    const clicks = at(1200);
    expect(clicks).toHaveLength(POPS.length);
    clicks.forEach((c, i) => expect(c.start).toBeCloseTo(POPS[i]! / 1000 + 0.03, 2));
    expect(at(170)[0]!.start).toBeGreaterThan(RETRO.blink / 1000); // blink tick inside the blink
    expect(at(170)[0]!.start).toBeLessThan(RETRO.blinkEnd / 1000 + 0.03);
    expect(at(110).some((o) => o.type === "triangle" && Math.abs(o.start - (RETRO.assemble / 1000 + 0.03)) < 0.01)).toBe(true);
    expect(at(55).some((o) => Math.abs(o.start - (RETRO.horizon / 1000 + 0.03)) < 0.01)).toBe(true);
    stop();
  });

  it("puts each click on a frame where a piece pops in, one per frame", () => {
    expect(POPS.length).toBeGreaterThanOrEqual(8);
    for (const p of PIECES) expect(POPS.map((ms) => frameOf(ms + 1))).toContain(frameOf(p.at)); // every pop-in has its click
    expect(new Set(POPS).size).toBe(POPS.length);
    expect([...POPS].sort((a, b) => a - b)).toEqual(POPS);
    const popFrames = new Set(PIECES.map((p) => frameOf(p.at)));
    for (const ms of POPS) expect(popFrames.has(frameOf(ms + 1))).toBe(true);
    expect(POPS.every((ms) => Math.abs(ms - frameMs(frameOf(ms + 1))) < 1e-6)).toBe(true);
  });

  it("plays no clicks or drum in reduced motion", () => {
    const fake = fakeAudio();
    window.AudioContext = fake.Ctx as unknown as typeof AudioContext;
    playIntroScore({ beats: beatsFor(true, true), start: performance.now(), volume: 1, still: true, tv: true });
    expect(fake.oscs.some((o) => o.freq === 1200 || o.freq === 125)).toBe(false);
    expect(fake.oscs.some((o) => o.freq === 220)).toBe(true);
  });
});

/* ---------------- version ---------------- */

describe("v1.3.1 version bump", () => {
  it("is 1.3.1 everywhere", () => {
    const pkg = JSON.parse(pkgRaw) as { version: string };
    const lock = JSON.parse(lockRaw) as { version: string; packages: Record<string, { version: string }> };
    expect(pkg.version).toBe("1.3.1");
    expect(lock.version).toBe("1.3.1");
    expect(lock.packages[""]!.version).toBe("1.3.1");
    expect(readme).toContain("the current version is 1.3.1");
    expect(changelog.indexOf("## 1.3.1")).toBeLessThan(changelog.indexOf("## 1.3.0"));
    expect(notes).toContain("## What's new in 1.3.1");
    // CI passes the real values (-PKINOMA_VERSION_NAME / _CODE); the local fallback matches this release
    expect(gradle).toContain(': "1.3.1"');
    expect(gradle).toMatch(/toInteger\(\) : 2512\b/);
  });
});
