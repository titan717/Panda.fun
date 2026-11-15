/**
 * v1.4.2 IntroBumper score: a synthesised Web Audio cue sheet matching the bumper's visuals (no audio files).
 *
 *   0.40 s  thin rising tone (sine 330 → 1320 Hz under the growing bar, gone as the triangle collapses at ~2.25 s)
 *   1.55 s  kick (the triangle's first beat, full strength)
 *   1.85 s  kick (second beat, 0.6 strength, like the visual `b2`)
 *   2.25 s  chime chord (the logo reveal)
 *   2.30 s  air swell (filtered noise rising under the reveal, fading before the 4 s end)
 *
 * Sound rules (same as the rest of the app): nothing plays when the viewer turned sound off in the player
 * (`panda:muted`, lib/audio), when the volume is 0, or before the browser allows audio (lib/audio's unlock: the first
 * key, tap or click; always allowed in the Android app). The level follows Settings › volume. If an AudioContext
 * cannot be created or will not start, the bumper simply plays silently.
 */
import { getMutedMemory, isAudioUnlocked } from "../audio";
import { getPrefs } from "../store";

export type ScoreCue = "tone" | "kick" | "chime" | "air";
export interface ScoreEvent { cue: ScoreCue; at: number; end: number; gain: number }

/** The cue sheet, in seconds from the start of the bumper. */
export const BUMPER_SCORE: readonly ScoreEvent[] = [
  { cue: "tone", at: 0.4, end: 2.3, gain: 0.05 },
  { cue: "kick", at: 1.55, end: 1.95, gain: 0.9 },
  { cue: "kick", at: 1.85, end: 2.25, gain: 0.54 },
  { cue: "chime", at: 2.25, end: 3.9, gain: 0.07 },
  { cue: "air", at: 2.3, end: 3.9, gain: 0.08 }
];

/** Master level relative to the app volume (synth peaks stay well under clipping). */
export const SCORE_LEVEL = 0.6;
/** Chime chord: C6, E6, G6, C7 (a bright major chord). */
export const CHIME_HZ = [1046.5, 1318.51, 1567.98, 2093] as const;

/** Whether the score may play now: sound on, volume above 0, and audio allowed by the autoplay rules. */
export function bumperSoundAllowed() {
  try {
    if (getMutedMemory() || !isAudioUnlocked()) return false;
    return bumperVolume() > 0;
  } catch { return false; }
}
export function bumperVolume() {
  try { const v = getPrefs().volume; return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1; } catch { return 1; }
}

/** One scheduled cue, for tests and diagnostics: `when` is in AudioContext time. */
export interface Scheduled { cue: ScoreCue; when: number }

let noiseCache: WeakMap<BaseAudioContext, AudioBuffer> | null = null;
function noise(ctx: BaseAudioContext, seconds: number) {
  noiseCache ??= new WeakMap();
  const hit = noiseCache.get(ctx);
  if (hit) return hit;
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseCache.set(ctx, buf);
  return buf;
}

/**
 * Schedule the cue sheet on `ctx` into `dest`, with bumper time 0 at AudioContext time `t0`. Cues that already started
 * before `now` (a late start) are skipped rather than squeezed in. Returns what was scheduled.
 */
export function scheduleBumperScore(ctx: BaseAudioContext, dest: AudioNode, t0: number): Scheduled[] {
  const now = ctx.currentTime;
  const out: Scheduled[] = [];
  for (const ev of BUMPER_SCORE) {
    const when = t0 + ev.at;
    if (when < now - 0.03) continue;
    const end = t0 + ev.end;
    if (ev.cue === "tone") tone(ctx, dest, when, end, ev.gain);
    else if (ev.cue === "kick") kick(ctx, dest, when, ev.gain);
    else if (ev.cue === "chime") chime(ctx, dest, when, end, ev.gain);
    else air(ctx, dest, when, end, ev.gain);
    out.push({ cue: ev.cue, when });
  }
  return out;
}

function env(ctx: BaseAudioContext, dest: AudioNode) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.connect(dest);
  return g;
}

/** Thin rising tone: a quiet sine gliding up two octaves, with a slow fade in and a quick fade out. */
function tone(ctx: BaseAudioContext, dest: AudioNode, at: number, end: number, peak: number) {
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(330, at);
  o.frequency.exponentialRampToValueAtTime(1320, end - 0.1);
  const g = env(ctx, dest);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + 0.6);
  g.gain.setValueAtTime(peak, end - 0.25);
  g.gain.linearRampToValueAtTime(0, end);
  o.connect(g);
  o.start(at); o.stop(end + 0.05);
}

/** Kick: a sine with a fast pitch drop (150 → 45 Hz) and an exponential decay. */
function kick(ctx: BaseAudioContext, dest: AudioNode, at: number, peak: number) {
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(150, at);
  o.frequency.exponentialRampToValueAtTime(45, at + 0.14);
  const g = env(ctx, dest);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, at + 0.38);
  o.connect(g);
  o.start(at); o.stop(at + 0.4);
}

/** Chime chord: four sine partials, slightly staggered, ringing out. */
function chime(ctx: BaseAudioContext, dest: AudioNode, at: number, end: number, peak: number) {
  CHIME_HZ.forEach((hz, i) => {
    const s = at + i * 0.012;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(hz, s);
    const g = env(ctx, dest);
    g.gain.setValueAtTime(0, s);
    g.gain.linearRampToValueAtTime(peak, s + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0005, end);
    o.connect(g);
    o.start(s); o.stop(end + 0.05);
  });
}

/** Air swell: band-passed white noise rising to a peak at ~2.9 s, then fading out before the end. */
function air(ctx: BaseAudioContext, dest: AudioNode, at: number, end: number, peak: number) {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx, 2);
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.setValueAtTime(1800, at);
  f.frequency.exponentialRampToValueAtTime(6000, at + 0.8);
  f.Q.setValueAtTime(0.7, at);
  const g = env(ctx, dest);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + 0.6);
  g.gain.linearRampToValueAtTime(0, end);
  src.connect(f); f.connect(g);
  src.start(at); src.stop(end + 0.05);
}

export interface BumperScoreHandle { stop(): void; scheduled: Scheduled[] }

type Ctor = new () => AudioContext;
function audioCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  return (window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext) ?? null;
}

/**
 * Start the score so that it lines up with the bumper's own clock: `elapsed()` returns the bumper time (s) at the
 * moment the AudioContext is running. Resolves null when sound is off, not allowed yet or unavailable; never rejects.
 */
export async function startBumperScore(elapsed: () => number, opts: { allowed?: boolean; volume?: number; resumeTimeoutMs?: number } = {}): Promise<BumperScoreHandle | null> {
  const allowed = opts.allowed ?? bumperSoundAllowed();
  const volume = opts.volume ?? bumperVolume();
  const Ctx = audioCtor();
  if (!allowed || volume <= 0 || !Ctx) return null;
  let ctx: AudioContext;
  try { ctx = new Ctx(); } catch { return null; }
  const close = () => { try { void ctx.close().catch(() => undefined); } catch { /* already closed */ } };
  try {
    if (ctx.state !== "running") {
      // a context that will not start promptly (autoplay policy) is dropped: the bumper stays silent
      await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, opts.resumeTimeoutMs ?? 300))]);
    }
    if (ctx.state !== "running") { close(); return null; }
    const master = ctx.createGain();
    master.gain.setValueAtTime(SCORE_LEVEL * volume, ctx.currentTime);
    master.connect(ctx.destination);
    const scheduled = scheduleBumperScore(ctx, master, ctx.currentTime - elapsed());
    let stopped = false;
    return {
      scheduled,
      stop() {
        if (stopped) return;
        stopped = true;
        try { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0, ctx.currentTime, 0.03); } catch { /* closing anyway */ }
        setTimeout(close, 120);
      }
    };
  } catch { close(); return null; }
}
