import type { SourceId } from "./types";

/**
 * Time to first frame (MASTER V4 §5.4): from the moment a source is asked to load until it reports
 * real playback (a play event or the position moving). Kept on this device only, last 20 per source,
 * and shown in Settings › Sources so the player's speed is measured, not guessed (docs/PERF.md).
 */
const KEY = "panda:ttff";
const MAX = 20;
type Log = Partial<Record<SourceId, number[]>>;

function load(): Log {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Log; return v && typeof v === "object" ? v : {}; } catch { return {}; }
}

export function recordTtff(source: SourceId, ms: number) {
  if (!Number.isFinite(ms) || ms <= 0 || ms > 120_000) return;
  const log = load();
  const list = [...(log[source] ?? []), Math.round(ms)].slice(-MAX);
  log[source] = list;
  try { localStorage.setItem(KEY, JSON.stringify(log)); } catch { /* storage full */ }
}

export function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
}

/** Median and sample count per source. */
export function ttffStats(): Partial<Record<SourceId, { median: number; samples: number }>> {
  const out: Partial<Record<SourceId, { median: number; samples: number }>> = {};
  for (const [id, xs] of Object.entries(load()) as [SourceId, number[]][]) {
    const m = median(xs ?? []);
    if (m !== null) out[id] = { median: m, samples: xs.length };
  }
  return out;
}

export const ttffLabel = (ms: number) => `Starts in ${(ms / 1000).toFixed(1)} s`;

/**
 * Stall detector: a source that reports its position is "buffering" when no update has arrived for
 * longer than 2.5× its usual interval (never less than 400 ms, the spinner delay of §5.1).
 */
export class TickWatch {
  private last = 0;
  private gaps: number[] = [];
  tick(now: number) {
    if (this.last) { const g = now - this.last; if (g > 0 && g < 3000) { this.gaps.push(g); if (this.gaps.length > 12) this.gaps.shift(); } }
    this.last = now;
  }
  reset() { this.last = 0; this.gaps = []; }
  get started() { return this.last > 0; }
  threshold() { const m = median(this.gaps); return Math.max(400, Math.min(2500, (m ?? 400) * 2.5)); }
  /** ms since the position last moved, 0 when it is moving */
  stalledFor(now: number) { if (!this.last) return 0; const d = now - this.last; return d > this.threshold() ? d : 0; }
}
