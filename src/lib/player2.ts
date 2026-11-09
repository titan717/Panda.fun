/**
 * Player 2.0 (v1.1.5): playback speed, sleep timer, learned "Skip Intro" and the next-episode card.
 * Pure helpers so the rules are unit-tested; the Player page wires them to the embed.
 */

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export type Speed = (typeof SPEEDS)[number];
export const speedLabel = (r: number) => (r === 1 ? "Normal" : `${r}×`);
export const isSpeed = (r: unknown): r is Speed => typeof r === "number" && (SPEEDS as readonly number[]).includes(r);

/** Sleep timer choices. `end` stops when the current episode or movie ends. */
export type SleepMode = "off" | "15" | "30" | "45" | "60" | "end";
export const SLEEP_OPTIONS: { id: SleepMode; label: string }[] = [
  { id: "off", label: "Off" },
  { id: "15", label: "15 minutes" },
  { id: "30", label: "30 minutes" },
  { id: "45", label: "45 minutes" },
  { id: "60", label: "1 hour" },
  { id: "end", label: "End of episode" }
];
export interface SleepTimer { mode: SleepMode; at: number | null }
export const SLEEP_OFF: SleepTimer = { mode: "off", at: null };

export function startSleep(mode: SleepMode, now = Date.now()): SleepTimer {
  if (mode === "off" || mode === "end") return { mode, at: null };
  return { mode, at: now + Number(mode) * 60_000 };
}
/** Minutes left (rounded up), or null when the timer is off / waiting for the end of the episode. */
export function sleepLeft(t: SleepTimer, now = Date.now()) {
  if (t.at === null) return null;
  return Math.max(0, Math.ceil((t.at - now) / 60_000));
}
export const sleepDue = (t: SleepTimer, now = Date.now()) => t.at !== null && now >= t.at;
export function sleepPillLabel(t: SleepTimer, isSeries: boolean, now = Date.now()) {
  if (t.mode === "off") return "Sleep Timer";
  if (t.mode === "end") return isSeries ? "Sleep · End of episode" : "Sleep · End of movie";
  return `Sleep · ${sleepLeft(t, now)} min`;
}
/** Seconds the "Still watching?" prompt waits before playback ends for the night. */
export const SLEEP_GRACE_S = 60;

/* ---------------- Still watching? after N episodes (v1.2.2) ---------------- */

/** Choices for "Ask if I'm still watching": 0 = never. */
export const STILL_AFTER: { id: string; label: string; note?: string }[] = [
  { id: "2", label: "After 2 episodes" },
  { id: "3", label: "After 3 episodes", note: "Default" },
  { id: "4", label: "After 4 episodes" },
  { id: "0", label: "Never" }
];

/**
 * Episodes that started by themselves in a row (Panda's countdown or the source's own autoplay).
 * Any key, click or touch in the player resets it, and so does starting an episode yourself.
 */
const run = { count: 0, auto: false };
export const binge = {
  get count() { return run.count; },
  /** Call right before an episode starts by itself. */
  markAuto() { run.auto = true; },
  /** Call when the episode changes: keeps the count for automatic starts, resets it otherwise. */
  onEpisode() { if (run.auto) run.count += 1; else run.count = 0; run.auto = false; },
  reset() { run.count = 0; run.auto = false; }
};
/** True when the next automatic start should ask first (`limit` episodes watched in a row). */
export const shouldAskStill = (limit: number, count = run.count) => limit > 0 && count + 1 >= limit;

/* ---------------- Skip Intro (learned per show) ---------------- */

import type { Segment } from "./types";

export interface Intro { start: number; end: number; at: number }
const INTRO_KEY = "panda:v1:intros";
const MAX_INTROS = 150;
/** An intro is learned from a forward jump of 25–150 s that starts within the first 8 minutes. */
export const INTRO_RULES = { maxStart: 480, minJump: 25, maxJump: 150 } as const;

function readAll(): Record<string, Intro> {
  try {
    const raw = localStorage.getItem(INTRO_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === "object" ? v : {};
  } catch { return {}; }
}

export function getIntro(showId: number): Intro | null {
  const v = readAll()[String(showId)];
  return v && Number.isFinite(v.start) && Number.isFinite(v.end) && v.end > v.start ? v : null;
}

/** Returns the learned intro when `from → to` looks like the viewer skipping an opening sequence. */
export function detectIntro(from: number, to: number): { start: number; end: number } | null {
  const jump = to - from;
  if (from < 0 || from > INTRO_RULES.maxStart) return null;
  if (jump < INTRO_RULES.minJump || jump > INTRO_RULES.maxJump) return null;
  return { start: Math.max(0, Math.floor(from)), end: Math.floor(to) };
}

export function learnIntro(showId: number, from: number, to: number, now = Date.now()): Intro | null {
  const hit = detectIntro(from, to);
  if (!hit) return null;
  const all = readAll();
  const intro: Intro = { ...hit, at: now };
  all[String(showId)] = intro;
  const keys = Object.keys(all);
  if (keys.length > MAX_INTROS) {
    keys.sort((a, b) => (all[a]?.at ?? 0) - (all[b]?.at ?? 0)).slice(0, keys.length - MAX_INTROS).forEach((k) => delete all[k]);
  }
  try { localStorage.setItem(INTRO_KEY, JSON.stringify(all)); } catch { /* quota: skip-intro is a convenience */ }
  return intro;
}

export function forgetIntros() { try { localStorage.removeItem(INTRO_KEY); } catch { /* ignore */ } }

/** The pill shows from 2 s before the learned start until 3 s before the end. */
export function inIntroWindow(intro: Intro | null, pos: number) {
  return Boolean(intro && pos >= Math.max(0, intro.start - 2) && pos < intro.end - 3);
}

/**
 * The skip button to show at `pos`: published markers (IntroDB) win over a learned intro; a recap
 * comes before the intro. Each shows from 1 s before its start until 3 s before its end.
 */
export function activeSkip(pos: number, m: { recap?: Segment | null; intro?: Segment | null; learned?: Intro | null }): { kind: "recap" | "intro"; end: number } | null {
  const win = (x: Segment | null | undefined) => Boolean(x && x.end - x.start >= 5 && pos >= Math.max(0, x.start - 1) && pos < x.end - 3);
  if (win(m.recap)) return { kind: "recap", end: m.recap!.end };
  if (m.intro) return win(m.intro) ? { kind: "intro", end: m.intro.end } : null;
  if (inIntroWindow(m.learned ?? null, pos)) return { kind: "intro", end: m.learned!.end };
  return null;
}

/* ---------------- Next-episode card ---------------- */

/** Seconds before the end when the next-episode card appears if the episode has no credits marker. */
export const NEXT_CARD_S = 40;
/** The card appears when the credits start (marker) or over the last 40 s. */
export function nextCardDue(pos: number, duration: number, hasNext: boolean, creditsStart?: number | null) {
  if (!hasNext || duration < 300) return false;
  const left = duration - pos;
  if (left <= 1.5) return false;
  const credits = creditsStart && creditsStart > duration * 0.6 && creditsStart < duration ? creditsStart : null;
  return credits !== null ? pos >= credits : left <= NEXT_CARD_S;
}

/* ---- v1.2.2 swipe gestures (phones and tablets) ---- */
/** Pixels a finger must travel before a drag counts as a gesture rather than a tap. */
export const DRAG_SLOP = 14;
/** A full-width horizontal drag moves this many seconds. */
export const DRAG_SEEK_SPAN = 120;
/** Holding a finger still this long plays at 2× until it lifts. */
export const HOLD_MS = 450;

export type DragKind = "seek" | "volume" | "brightness";

/** Decides what a drag does from its first movement: sideways seeks, up/down on the right is volume, on the left brightness. */
export function classifyDrag(dx: number, dy: number, startX: number, width: number): DragKind | null {
  if (Math.hypot(dx, dy) < DRAG_SLOP) return null;
  if (Math.abs(dx) > Math.abs(dy)) return "seek";
  return startX / Math.max(1, width) >= 0.5 ? "volume" : "brightness";
}

/** Seek target for a horizontal drag of dx pixels across a layer width pixels wide. */
export function dragSeek(position: number, duration: number, dx: number, width: number): number {
  const to = position + (dx / Math.max(1, width)) * DRAG_SEEK_SPAN;
  return Math.round(Math.max(0, Math.min(duration > 0 ? Math.max(0, duration - 2) : to, to)));
}

/** New level (volume 0–1, brightness 0.2–1) after dragging dy pixels; up raises. 60 % of the height covers the whole range. */
export function dragLevel(start: number, dy: number, height: number, min = 0): number {
  const v = start - dy / (Math.max(1, height) * 0.6);
  return Math.round(Math.max(min, Math.min(1, v)) * 100) / 100;
}

/** Brightness never goes below this, so the picture stays visible. */
export const BRIGHT_MIN = 0.2;


/** Player top bar line (v1.2.6, MASTER V5 §1): "Season 2, Episode 5 · Title". */
export function episodeLine(season: number, episode: number, title?: string | null) {
  return `Season ${season}, Episode ${episode}${title ? ` · ${title}` : ""}`;
}

/** Typical time to first frame per source when this device has no measurements yet (docs/PLAYER_COMPARISON.md, docs/PERF.md). */
export const TTFF_DEFAULT_MS: Record<string, number> = { cinesrc: 2600, vidy: 1500, vidyanime: 2000, vidlink: 8000 };

/**
 * "Buffering the first seconds… N%" (v1.2.6, D-150). No embed reports its buffer level, so the
 * percentage is an honest time estimate against the source's measured median start time: it moves
 * 0–10 % while Panda picks a source, then follows 1 − e^(−t/τ) up to 95 % and only reaches 100 %
 * when the source reports it is ready.
 */
export function bufferPct(elapsedMs: number, medianMs: number | null, hasSource: boolean, ready: boolean) {
  if (ready) return 100;
  const t = Math.max(0, elapsedMs);
  if (!hasSource) return Math.min(10, Math.round(t / 150));
  const tau = Math.max(400, (medianMs && medianMs > 0 ? medianMs : 3000) / 1.5);
  return Math.min(95, Math.round(10 + 85 * (1 - Math.exp(-t / tau))));
}

/* ---------------- Seek-bar chapters (v1.2.6) ---------------- */

export type MarkerKind = "recap" | "intro" | "credits";
export interface SeekMarker { kind: MarkerKind; start: number; end: number }
export const MARKER_LABEL: Record<MarkerKind, string> = { recap: "Recap", intro: "Intro", credits: "Credits" };

/**
 * Recap, intro and credits spans for the seek bar, from IntroDB segments or the intro this device
 * learned. Spans shorter than 5 s or outside the runtime are dropped; credits run to the end.
 */
export function seekMarkers(m: { recap?: Segment | null; intro?: Segment | null; credits?: Segment | null; learned?: Intro | null }, duration: number): SeekMarker[] {
  if (!(duration > 0)) return [];
  const out: SeekMarker[] = [];
  const add = (kind: MarkerKind, x: Segment | null | undefined) => {
    if (!x) return;
    const start = Math.max(0, x.start), end = Math.min(duration, kind === "credits" && !(x.end > x.start) ? duration : x.end);
    if (end - start >= 5 && start < duration) out.push({ kind, start, end });
  };
  add("recap", m.recap);
  add("intro", m.intro ?? (m.learned ? { start: m.learned.start, end: m.learned.end } : null));
  add("credits", m.credits);
  return out.sort((a, b) => a.start - b.start);
}

/** Chapter name at a position ("Intro"), or null in the main part. */
export function chapterAt(t: number, markers: SeekMarker[]) {
  const hit = markers.find((x) => t >= x.start && t < x.end);
  return hit ? MARKER_LABEL[hit.kind] : null;
}

/* ---------------- Picture fit (v1.2.6) ---------------- */

export type FitMode = "fit" | "fill" | "stretch";
export const FIT_OPTIONS: { id: FitMode; label: string }[] = [{ id: "fit", label: "Fit" }, { id: "fill", label: "Fill" }, { id: "stretch", label: "Stretch" }];
const FIT_KEY = "panda:fit";
export function getFit(): FitMode { try { const v = localStorage.getItem(FIT_KEY); return v === "fill" || v === "stretch" ? v : "fit"; } catch { return "fit"; } }
export function saveFit(m: FitMode) { try { localStorage.setItem(FIT_KEY, m); } catch { /* storage full */ } }

/**
 * Embeds letterbox the picture inside their frame and expose no object-fit, so Panda scales the
 * frame itself (D-151). Assumes a 16:9 picture, the shape of nearly every stream: "fill" zooms
 * evenly until the black bars are gone, "stretch" scales one axis only.
 */
export function fitScale(mode: FitMode, w: number, h: number, ar = 16 / 9): { x: number; y: number } {
  if (mode === "fit" || !(w > 0 && h > 0)) return { x: 1, y: 1 };
  const s = w / h;
  if (Math.abs(s - ar) < 0.01) return { x: 1, y: 1 };
  if (mode === "fill") { const k = Math.max(s / ar, ar / s); return { x: k, y: k }; }
  return s > ar ? { x: s / ar, y: 1 } : { x: 1, y: ar / s };
}

/* ---------------- Mute memory (v1.2.6) ---------------- */
const MUTE_KEY = "panda:muted";
export function getMutedMemory() { try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; } }
export function saveMutedMemory(m: boolean) { try { if (m) localStorage.setItem(MUTE_KEY, "1"); else localStorage.removeItem(MUTE_KEY); } catch { /* storage full */ } }
