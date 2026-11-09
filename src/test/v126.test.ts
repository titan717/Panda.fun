import { describe, expect, it, beforeEach } from "vitest";
import { bufferPct, chapterAt, episodeLine, fitScale, getFit, getMutedMemory, saveFit, saveMutedMemory, seekMarkers, TTFF_DEFAULT_MS } from "../lib/player2";
import playerSrc from "../pages/Player.tsx?raw";
import chromeSrc from "../tv/TvPlayerChrome.tsx?raw";
import playerCss from "../pages/player.css?raw";

describe("v1.2.6 episode line", () => {
  it("spells out season and episode", () => {
    expect(episodeLine(1, 2, "The Kingsroad")).toBe("Season 1, Episode 2 · The Kingsroad");
    expect(episodeLine(3, 10)).toBe("Season 3, Episode 10");
    expect(episodeLine(3, 10, null)).toBe("Season 3, Episode 10");
  });
});

describe("v1.2.6 buffering percentage", () => {
  it("is 100 only when the source is ready", () => {
    expect(bufferPct(0, 2000, true, true)).toBe(100);
    expect(bufferPct(60_000, 2000, true, false)).toBe(95);
  });
  it("moves 0–10 % while no source is picked", () => {
    expect(bufferPct(0, null, false, false)).toBe(0);
    expect(bufferPct(750, null, false, false)).toBe(5);
    expect(bufferPct(10_000, null, false, false)).toBe(10);
  });
  it("starts at 10 % and rises monotonically with the source's median", () => {
    let last = 0;
    for (let t = 0; t <= 20_000; t += 250) { const v = bufferPct(t, 2600, true, false); expect(v).toBeGreaterThanOrEqual(last); expect(v).toBeLessThanOrEqual(95); last = v; }
    expect(bufferPct(0, 2600, true, false)).toBe(10);
    // at the median it is well past half way, so a typical start never looks stuck
    expect(bufferPct(2600, 2600, true, false)).toBeGreaterThan(70);
  });
  it("a slower source rises more slowly", () => {
    expect(bufferPct(2000, TTFF_DEFAULT_MS.vidlink!, true, false)).toBeLessThan(bufferPct(2000, TTFF_DEFAULT_MS.vidy!, true, false));
  });
  it("falls back to 3 s without a median and never divides by zero", () => {
    expect(bufferPct(3000, null, true, false)).toBe(bufferPct(3000, 3000, true, false));
    expect(Number.isFinite(bufferPct(1000, 0, true, false))).toBe(true);
    expect(bufferPct(-50, 2000, true, false)).toBe(10);
  });
});

describe("v1.2.6 seek-bar chapters", () => {
  it("collects recap, intro and credits in order", () => {
    const m = seekMarkers({ intro: { start: 60, end: 150 }, recap: { start: 0, end: 40 }, credits: { start: 2800, end: 3000 } }, 3000);
    expect(m.map((x) => x.kind)).toEqual(["recap", "intro", "credits"]);
  });
  it("drops short or out-of-range spans and clamps to the runtime", () => {
    expect(seekMarkers({ intro: { start: 60, end: 63 } }, 3000)).toEqual([]);
    expect(seekMarkers({ intro: { start: 3100, end: 3200 } }, 3000)).toEqual([]);
    expect(seekMarkers({ credits: { start: 2900, end: 3500 } }, 3000)).toEqual([{ kind: "credits", start: 2900, end: 3000 }]);
    expect(seekMarkers({ intro: { start: 60, end: 150 } }, 0)).toEqual([]);
  });
  it("credits without an end run to the end", () => {
    expect(seekMarkers({ credits: { start: 2900, end: 0 } }, 3000)).toEqual([{ kind: "credits", start: 2900, end: 3000 }]);
  });
  it("uses the learned intro only when IntroDB has none", () => {
    expect(seekMarkers({ learned: { start: 30, end: 90, at: 1 } }, 3000)).toEqual([{ kind: "intro", start: 30, end: 90 }]);
    expect(seekMarkers({ intro: { start: 60, end: 150 }, learned: { start: 30, end: 90, at: 1 } }, 3000)[0]).toMatchObject({ start: 60 });
  });
  it("names the chapter at a position", () => {
    const m = seekMarkers({ intro: { start: 60, end: 150 }, credits: { start: 2800, end: 3000 } }, 3000);
    expect(chapterAt(100, m)).toBe("Intro");
    expect(chapterAt(150, m)).toBeNull();
    expect(chapterAt(2900, m)).toBe("Credits");
  });
});

describe("v1.2.6 picture fit", () => {
  beforeEach(() => localStorage.clear());
  it("fit never scales", () => { expect(fitScale("fit", 2340, 1080)).toEqual({ x: 1, y: 1 }); });
  it("16:9 screens never scale", () => { expect(fitScale("fill", 1920, 1080)).toEqual({ x: 1, y: 1 }); expect(fitScale("stretch", 1280, 720)).toEqual({ x: 1, y: 1 }); });
  it("fill zooms evenly on wide and tall screens", () => {
    { const f = fitScale("fill", 1400, 600); expect(f.x).toBeCloseTo(1.3125, 6); expect(f.y).toBe(f.x); }
    const t = fitScale("fill", 1024, 768); expect(t.x).toBeCloseTo(4 / 3, 5); expect(t.x).toBe(t.y);
  });
  it("stretch scales one axis", () => {
    { const f = fitScale("stretch", 1400, 600); expect(f.x).toBeCloseTo(1.3125, 6); expect(f.y).toBe(1); }
    const t = fitScale("stretch", 1024, 768); expect(t.x).toBe(1); expect(t.y).toBeCloseTo(4 / 3, 5);
  });
  it("ignores a zero-size screen", () => { expect(fitScale("fill", 0, 0)).toEqual({ x: 1, y: 1 }); });
  it("is remembered and validated", () => {
    expect(getFit()).toBe("fit");
    saveFit("stretch"); expect(getFit()).toBe("stretch");
    localStorage.setItem("panda:fit", "huge"); expect(getFit()).toBe("fit");
  });
});

describe("v1.2.6 mute memory", () => {
  beforeEach(() => localStorage.clear());
  it("remembers Sound off and forgets it on unmute", () => {
    expect(getMutedMemory()).toBe(false);
    saveMutedMemory(true); expect(getMutedMemory()).toBe(true);
    saveMutedMemory(false); expect(getMutedMemory()).toBe(false); expect(localStorage.getItem("panda:muted")).toBeNull();
  });
});

describe("v1.2.6 wiring", () => {
  const player = playerSrc, chrome = chromeSrc, css = playerCss;
  it("the first-frames screen replaces the old spinner", () => {
    expect(player).toContain("<PlayerLoading");
    expect(player).not.toContain("Loading from ${SHORT");
  });
  it("chrome and player use the long episode line", () => {
    expect(chrome).toContain("episodeLine(ep.s, ep.e, p.episodeTitle)");
    expect(chrome).not.toMatch(/S\{ep\.s\} E\{ep\.e\}/);
  });
  it("portrait phones get a 16:9 frame (no provider rotate dialog)", () => {
    expect(css).toMatch(/@media \(orientation: portrait\) \{ \.player--touch \.player-frame \{[^}]*aspect-ratio: 16 \/ 9/);
  });
  it("lock is phone-only and Back unlocks", () => {
    expect(chrome).toContain('{p.touch && <button id="tvp-lock"');
    expect(chrome).toContain("useBackHandler(() => { setLocked(false); p.poke(); }, locked)");
  });
});
