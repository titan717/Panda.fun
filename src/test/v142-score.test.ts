import { afterEach, describe, expect, it, vi } from "vitest";
import { BUMPER_SCORE, CHIME_HZ, SCORE_LEVEL, bumperSoundAllowed, scheduleBumperScore, startBumperScore } from "../lib/intro/bumperScore";

/** A small AudioContext stand-in that records every node start (with its kind and frequency). */
class Param {
  calls: [string, number, number][] = [];
  setValueAtTime(v: number, t: number) { this.calls.push(["set", v, t]); return this; }
  linearRampToValueAtTime(v: number, t: number) { this.calls.push(["lin", v, t]); return this; }
  exponentialRampToValueAtTime(v: number, t: number) { this.calls.push(["exp", v, t]); return this; }
  setTargetAtTime(v: number, t: number) { this.calls.push(["target", v, t]); return this; }
  cancelScheduledValues() { return this; }
}
interface Started { kind: "osc" | "noise"; at: number; stop: number; hz: number }
class MockCtx {
  static last: MockCtx | null = null;
  static startState: AudioContextState = "running";
  static resumes = true;
  state: AudioContextState = MockCtx.startState;
  currentTime = 10;
  sampleRate = 8000;
  destination = { connect() {} };
  started: Started[] = [];
  gains: Param[] = [];
  closed = false;
  constructor() { MockCtx.last = this; }
  resume() { if (MockCtx.resumes) this.state = "running"; return MockCtx.resumes ? Promise.resolve() : new Promise<void>(() => undefined); }
  close() { this.closed = true; this.state = "closed"; return Promise.resolve(); }
  createGain() { const gain = new Param(); this.gains.push(gain); return { gain, connect() {} }; }
  createBiquadFilter() { return { type: "", frequency: new Param(), Q: new Param(), connect() {} }; }
  createBuffer(_c: number, len: number) { const d = new Float32Array(len); return { getChannelData: () => d }; }
  createOscillator() {
    const frequency = new Param();
    const rec: Started = { kind: "osc", at: NaN, stop: NaN, hz: NaN };
    return { type: "", frequency, connect() {}, start: (t: number) => { rec.at = t; rec.hz = frequency.calls[0]?.[1] ?? NaN; this.started.push(rec); }, stop: (t: number) => { rec.stop = t; } };
  }
  createBufferSource() {
    const rec: Started = { kind: "noise", at: NaN, stop: NaN, hz: NaN };
    return { buffer: null, connect() {}, start: (t: number) => { rec.at = t; this.started.push(rec); }, stop: (t: number) => { rec.stop = t; } };
  }
}
const ctx = () => new MockCtx() as unknown as AudioContext;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); MockCtx.startState = "running"; MockCtx.resumes = true; localStorage.clear(); });

describe("IntroBumper score: the cue sheet", () => {
  it("matches the mp4: rising tone, kicks at 1.55 and 1.85 s, chime chord at 2.25 s, air swell at 2.3 s", () => {
    expect(BUMPER_SCORE.map((e) => [e.cue, e.at])).toEqual([["tone", 0.4], ["kick", 1.55], ["kick", 1.85], ["chime", 2.25], ["air", 2.3]]);
    for (const e of BUMPER_SCORE) expect(e.end).toBeLessThanOrEqual(4); // nothing rings past the 4 s end
  });

  it("schedules each cue at t0 + its time on the AudioContext clock", () => {
    const c = ctx() as unknown as MockCtx;
    const out = scheduleBumperScore(c as unknown as AudioContext, {} as AudioNode, 10);
    expect(out.map((s) => s.cue)).toEqual(["tone", "kick", "kick", "chime", "air"]);
    expect(out.map((s) => +s.when.toFixed(3))).toEqual([10.4, 11.55, 11.85, 12.25, 12.3]);

    const osc = c.started.filter((s) => s.kind === "osc");
    // tone: one thin sine from 330 Hz at 0.4 s
    expect(osc.some((s) => near(s.at, 10.4) && s.hz === 330)).toBe(true);
    // kicks: a 150 Hz thump at each beat
    expect(osc.filter((s) => s.hz === 150).map((s) => +s.at.toFixed(3))).toEqual([11.55, 11.85]);
    // chime: the four chord notes from 2.25 s, slightly staggered
    const chord = osc.filter((s) => (CHIME_HZ as readonly number[]).includes(s.hz));
    expect(chord.map((s) => s.hz)).toEqual([...CHIME_HZ]);
    expect(chord[0]!.at).toBeCloseTo(12.25, 6);
    for (const s of chord) expect(s.at - 12.25).toBeLessThan(0.05);
    // air: one noise source from 2.3 s
    const air = c.started.filter((s) => s.kind === "noise");
    expect(air).toHaveLength(1);
    expect(air[0]!.at).toBeCloseTo(12.3, 6);
    // everything is stopped by the end of the bumper
    for (const s of c.started) expect(s.stop).toBeLessThanOrEqual(10 + 4);
  });

  it("the second kick is softer, like the visual's second beat", () => {
    const [k1, k2] = BUMPER_SCORE.filter((e) => e.cue === "kick");
    expect(k2!.gain / k1!.gain).toBeCloseTo(0.6, 5);
  });

  it("skips cues that are already over on a late start instead of squeezing them in", () => {
    const c = ctx() as unknown as MockCtx;
    // bumper time is already 2.0 s: tone and both kicks are gone
    const out = scheduleBumperScore(c as unknown as AudioContext, {} as AudioNode, 10 - 2);
    expect(out.map((s) => s.cue)).toEqual(["chime", "air"]);
    expect(c.started.every((s) => s.at >= 10)).toBe(true);
  });
});

describe("IntroBumper score: starting and stopping", () => {
  it("lines the cue sheet up with the bumper's clock and follows the volume", async () => {
    vi.stubGlobal("AudioContext", MockCtx);
    const h = await startBumperScore(() => 0.5, { allowed: true, volume: 0.5 });
    expect(h).not.toBeNull();
    // bumper time 0.5 s now (ctx time 10): t0 = 9.5, so the tone (0.4) is skipped as late and the first kick is at 11.05
    expect(h!.scheduled.map((s) => [s.cue, +s.when.toFixed(3)])).toEqual([["kick", 11.05], ["kick", 11.35], ["chime", 11.75], ["air", 11.8]]);
    expect(MockCtx.last!.gains[0]!.calls[0]).toEqual(["set", SCORE_LEVEL * 0.5, 10]);
    vi.useFakeTimers();
    h!.stop(); h!.stop();
    vi.advanceTimersByTime(200);
    expect(MockCtx.last!.closed).toBe(true);
  });

  it("stays silent when sound is off, the volume is 0 or audio is not allowed", async () => {
    vi.stubGlobal("AudioContext", MockCtx);
    MockCtx.last = null;
    expect(await startBumperScore(() => 0, { allowed: false, volume: 1 })).toBeNull();
    expect(await startBumperScore(() => 0, { allowed: true, volume: 0 })).toBeNull();
    expect(MockCtx.last).toBeNull(); // no context was even created
    localStorage.setItem("panda:muted", "1");
    expect(bumperSoundAllowed()).toBe(false);
  });

  it("drops a context that will not start (autoplay policy) and closes it", async () => {
    vi.stubGlobal("AudioContext", MockCtx);
    MockCtx.startState = "suspended"; MockCtx.resumes = false;
    const h = await startBumperScore(() => 0, { allowed: true, volume: 1, resumeTimeoutMs: 5 });
    expect(h).toBeNull();
    expect(MockCtx.last!.closed).toBe(true);
    expect(MockCtx.last!.started).toHaveLength(0);
  });

  it("never throws when Web Audio is missing", async () => {
    vi.stubGlobal("AudioContext", undefined);
    await expect(startBumperScore(() => 0, { allowed: true, volume: 1 })).resolves.toBeNull();
  });
});
