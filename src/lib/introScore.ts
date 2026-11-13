/**
 * v1.3.0 launch intro score (D-178), synthesised with Web Audio: oscillators, filtered noise and a short generated
 * convolver reverb. No audio files. Lazy chunk: it loads only when sound is allowed (audio unlocked, not muted).
 *
 * The cue sheet follows the intro beats, so TV (3.6 s) and phone (2.4 s) get the same score at their own pace:
 *   start   faint sub-rumble fades in
 *   eyes    a dark low pad opens with the eyes' glow
 *   blink   a short, low tick
 *   face    a warm major swell
 *   zoom    a riser whose pitch accelerates; everything drops out 30 ms before the hit
 *   burst   ONE deep drum hit (pitched body, sub, skin noise, click) with a short reverb tail
 *   horizon a high shimmer settling into a low hum, which fades out by the end
 * Reduced motion plays one soft tone instead. Cue times are measured from the intro's first frame, so a late chunk
 * skips what already passed instead of drifting. Every node is scheduled once; the context closes after the tail.
 */
import type { IntroBeats } from "../components/Intro";

export interface ScoreOptions { beats: IntroBeats; start: number; volume: number; still: boolean; tv: boolean }

type Ctx = AudioContext;
const noop = () => undefined;

function makeNoise(c: Ctx, seconds: number) {
  const b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * seconds)), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

/** A small hall: stereo noise with a cubic decay. */
function makeImpulse(c: Ctx, seconds: number) {
  const len = Math.max(1, Math.floor(c.sampleRate * seconds));
  const b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  return b;
}

/** Soft saturation for the drum body. */
function makeCurve(drive: number) {
  const n = 512;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.tanh(x * drive) / Math.tanh(drive); }
  return curve;
}

export function playIntroScore({ beats, start, volume, still, tv }: ScoreOptions): () => void {
  let c: Ctx;
  try {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return noop;
    c = new C({ latencyHint: "interactive" });
  } catch { return noop; }

  let closed = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const close = () => {
    if (closed) return;
    closed = true;
    timers.forEach(clearTimeout);
    try { void c.close().catch(noop); } catch { /* already closed */ }
  };
  let master: GainNode | null = null;
  let endAt = Infinity;

  try {
    void c.resume?.().catch(noop);
    // still suspended (the browser refused despite the unlock flag): stay silent, never retry
    timers.push(setTimeout(() => { if (c.state !== "running") close(); }, 400));

    const elapsed = performance.now() - start;
    const t0 = c.currentTime + 0.03;
    /** Context time for a beat in ms; beats already in the past start now. */
    const at = (ms: number) => t0 + Math.max(0, (ms - elapsed) / 1000);
    const passed = (ms: number) => ms < elapsed - 40;
    const sec = (ms: number) => ms / 1000;

    master = c.createGain();
    master.gain.value = Math.max(0, Math.min(1, volume)) * (tv ? 0.8 : 0.65);
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.25;
    master.connect(comp).connect(c.destination);

    const verb = c.createConvolver();
    verb.buffer = makeImpulse(c, tv ? 1.6 : 1.2);
    const wet = c.createGain(); wet.gain.value = 0.5;
    verb.connect(wet).connect(master);

    const noise = makeNoise(c, 2);
    const osc = (type: OscillatorType, f: number, from: number, to: number, out: AudioNode, detune = 0) => {
      const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, from); o.detune.value = detune;
      o.connect(out); o.start(from); o.stop(to + 0.05); return o;
    };
    const noiseSrc = (from: number, to: number, out: AudioNode) => {
      const s = c.createBufferSource(); s.buffer = noise; s.loop = true; s.connect(out); s.start(from, Math.random() * 1.5); s.stop(to + 0.05); return s;
    };
    const filter = (type: BiquadFilterType, f: number, q = 0.7) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const gain = (v = 0) => { const g = c.createGain(); g.gain.value = v; return g; };
    /** Gain envelope from a list of [time, value] points (linear ramps; exponential where marked). */
    const env = (g: GainNode, pts: [number, number, boolean?][]) => {
      const p = g.gain;
      p.setValueAtTime(pts[0]![1], pts[0]![0]);
      for (const [t, v, exp] of pts.slice(1)) { if (exp) p.exponentialRampToValueAtTime(Math.max(0.0001, v), t); else p.linearRampToValueAtTime(v, t); }
    };

    const end = at(beats.done);
    endAt = end;

    if (still) {
      // reduced motion: one soft, warm tone under the still frame
      const g = gain(); g.connect(master); g.connect(verb);
      const lp = filter("lowpass", 1400); lp.connect(g);
      for (const [f, d] of [[220, 0], [329.63, 4], [440, -3]] as const) osc("triangle", f, at(0), end, lp, d);
      env(g, [[at(0), 0], [at(0) + 0.12, 0.07], [at(beats.leave), 0.06], [end, 0.0001, true]]);
    } else {
      const { eyes, blink, face, zoom, burst, horizon, leave } = beats;
      const cut = at(burst) - 0.03; // a breath of silence before the hit

      // 0. sub-rumble: low sine pair and lowpassed noise, building until the hit
      if (!passed(burst)) {
        const g = gain(); g.connect(master);
        const lp = filter("lowpass", 90); lp.connect(g);
        osc("sine", 36, at(0), cut, g); osc("sine", 54, at(0), cut, g, 5);
        const ng = gain(0.9); ng.connect(lp); noiseSrc(at(0), cut, ng);
        env(g, [[at(0), 0], [at(eyes), 0.22], [at(zoom), 0.3], [cut - 0.02, 0.42], [cut, 0]]);
      }
      // 1. eyes: a dark pad whose filter opens with the glow
      if (!passed(zoom)) {
        const g = gain(); g.connect(master); g.connect(verb);
        const lp = filter("lowpass", 180, 2); lp.connect(g);
        lp.frequency.setValueAtTime(180, at(eyes)); lp.frequency.exponentialRampToValueAtTime(760, at(blink));
        osc("sawtooth", 55, at(eyes), at(zoom) + 0.3, lp, -7); osc("sawtooth", 82.41, at(eyes), at(zoom) + 0.3, lp, 6);
        env(g, [[at(eyes), 0], [at(blink), 0.07], [at(face), 0.06], [at(zoom) + 0.25, 0.0001, true]]);
      }
      // 2. blink: a short low tick at the moment the lids close
      if (!passed(blink)) {
        const tk = at(blink + (face - blink) * 0.5);
        const g = gain(); g.connect(master); g.connect(verb);
        const o = osc("sine", 170, tk, tk + 0.16, g); o.frequency.exponentialRampToValueAtTime(55, tk + 0.07);
        env(g, [[tk, 0], [tk + 0.004, 0.32], [tk + 0.14, 0.0001, true]]);
        const cg = gain(); cg.connect(master);
        const bp = filter("bandpass", 1800, 4); bp.connect(cg); noiseSrc(tk, tk + 0.05, bp);
        env(cg, [[tk, 0], [tk + 0.002, 0.14], [tk + 0.03, 0.0001, true]]);
      }
      // 3. face: a warm major swell (A major, triangles through an opening lowpass)
      if (!passed(burst)) {
        const g = gain(); g.connect(master); g.connect(verb);
        const lp = filter("lowpass", 400); lp.connect(g);
        lp.frequency.setValueAtTime(400, at(face)); lp.frequency.exponentialRampToValueAtTime(2200, at(zoom));
        for (const [f, d] of [[110, 0], [164.81, 5], [220, -4], [277.18, 3]] as const) osc("triangle", f, at(face), cut, lp, d);
        env(g, [[at(face), 0], [at(zoom), 0.085], [cut - 0.02, 0.05], [cut, 0]]);
      }
      // 4. zoom: a riser that accelerates (pitch on an x² curve), sawtooth plus swept noise
      if (!passed(burst)) {
        const from = at(zoom); const dur = Math.max(0.05, cut - from);
        const curve = (f0: number, f1: number) => Float32Array.from({ length: 48 }, (_, i) => f0 * (f1 / f0) ** ((i / 47) ** 2));
        const g = gain(); g.connect(master); g.connect(verb);
        const lp = filter("lowpass", 3200); lp.connect(g);
        const o = osc("sawtooth", 90, from, cut, lp);
        o.frequency.setValueCurveAtTime(curve(90, 1400), from, dur);
        const ng = gain(); ng.connect(master); ng.connect(verb);
        const bp = filter("bandpass", 300, 1.4); bp.connect(ng); noiseSrc(from, cut, bp);
        bp.frequency.setValueCurveAtTime(curve(300, 7000), from, dur);
        env(g, [[from, 0], [cut - 0.03, 0.12], [cut, 0]]);
        env(ng, [[from, 0], [cut - 0.03, 0.16], [cut, 0]]);
      }
      // 5. THE drum hit: pitched body through soft saturation, a sub tail, skin noise and a click, into the reverb
      if (!passed(burst + 200)) {
        const hit = at(burst);
        const shaper = c.createWaveShaper(); shaper.curve = makeCurve(2.2); shaper.oversample = "2x";
        const send = gain(0.55); shaper.connect(master); shaper.connect(send); send.connect(verb);
        const bodyG = gain(); bodyG.connect(shaper);
        const body = osc("sine", 125, hit, hit + 1.5, bodyG);
        body.frequency.setValueAtTime(125, hit); body.frequency.exponentialRampToValueAtTime(44, hit + 0.38);
        env(bodyG, [[hit, 0], [hit + 0.003, 1], [hit + 0.12, 0.7], [hit + 1.4, 0.0001, true]]);
        const subG = gain(); subG.connect(master);
        osc("sine", 40, hit, hit + 1.8, subG);
        env(subG, [[hit, 0], [hit + 0.01, 0.55], [hit + 1.7, 0.0001, true]]);
        const skinG = gain(); skinG.connect(shaper);
        const skinLp = filter("lowpass", 1100); skinLp.connect(skinG); noiseSrc(hit, hit + 0.3, skinLp);
        env(skinG, [[hit, 0], [hit + 0.002, 0.55], [hit + 0.22, 0.0001, true]]);
        const clickG = gain(); clickG.connect(master);
        const hp = filter("highpass", 3200); hp.connect(clickG); noiseSrc(hit, hit + 0.03, hp);
        env(clickG, [[hit, 0], [hit + 0.001, 0.22], [hit + 0.018, 0.0001, true]]);
      }
      // 6. horizon: a high shimmer settling into a low hum that fades out with the intro
      {
        const s = at(horizon);
        const sg = gain(); sg.connect(verb); sg.connect(master);
        const trem = c.createOscillator(); trem.frequency.value = 9; const tg = gain(0.012); trem.connect(tg).connect(sg.gain); trem.start(s); trem.stop(at(leave) + 0.1);
        for (const [f, d] of [[1318.51, 0], [1760, 6], [2637.02, -5]] as const) osc("triangle", f, s, at(leave) + 0.1, sg, d);
        env(sg, [[s, 0], [s + 0.08, 0.035], [at(leave), 0.0001, true]]);
        const hg = gain(); hg.connect(master);
        const lp = filter("lowpass", 240); lp.connect(hg);
        osc("sine", 55, s, end, lp); osc("triangle", 110, s, end, lp, 4);
        env(hg, [[s, 0], [s + sec(Math.max(80, (leave - horizon) * 0.6)), 0.11], [at(leave), 0.1], [end, 0.0001, true]]);
      }
    }
    // let the reverb tail ring out, then release the audio device
    timers.push(setTimeout(close, Math.max(0, (end - c.currentTime) * 1000) + 1800));
  } catch {
    close();
    return noop;
  }

  return () => {
    // unmounted at the end: the score has faded by itself and the drum tail rings out (the close timer is set).
    // Unmounted early (hard timeout, error): fade quickly, then close.
    try {
      if (closed || !master || c.currentTime >= endAt - 0.1) return;
      master.gain.setTargetAtTime(0, c.currentTime, 0.08);
      timers.push(setTimeout(close, 800));
    } catch { close(); }
  };
}
