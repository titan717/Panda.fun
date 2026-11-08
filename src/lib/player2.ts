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
