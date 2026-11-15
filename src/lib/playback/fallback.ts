import type { SourceId } from "../types";

/**
 * v1.4.0 Playback Fallback Controller — a pure state machine (no timers, no DOM) so every rule is unit-tested.
 * The Player feeds it events; it answers which provider should be loaded, when to move on, and how the whole
 * attempt ended. A provider only counts as working on real playback evidence: the embed's clock moving
 * (timeupdate with a position > 0 that advances, or one that starts past a resume point). An iframe `load`, a
 * `ready` or `loadedmetadata` message only prove the page answered — they extend the wait once, nothing more.
 */
export type FailureReason =
  | "metadata"      // the title's details or sources could not be fetched
  | "no-source"     // the backend returned no URL for this provider
  | "init"          // the embed reported an error before playing
  | "timeout"       // nothing played within the start window
  | "error"         // the embed reported a playback error
  | "network";      // the device went offline during the attempt

export type AttemptOutcome = "playing" | FailureReason | "cancelled";

export interface Attempt {
  source: SourceId;
  startedAt: number;
  endedAt: number | null;
  outcome: AttemptOutcome | null;
  /** Progress signals seen (iframe load, ready, metadata): extends the start window once. */
  progressed: boolean;
}

export type FallbackStatus = "idle" | "loading" | "playing" | "failed" | "cancelled" | "offline";

export interface FallbackState {
  order: SourceId[];
  index: number;
  status: FallbackStatus;
  attempts: Attempt[];
  /** Deadline (ms epoch) for the current attempt; the Player arms one timer for it. */
  deadline: number | null;
  /** First position seen for the current attempt (detects a clock that really moves). */
  firstPos: number | null;
}

export interface FallbackConfig {
  /** Time a provider gets to start playing. */
  startTimeoutMs: Partial<Record<SourceId, number>> & { default: number };
  /** Extra time once the embed shows signs of life (ready / metadata / iframe load). */
  progressGraceMs: number;
  /** Seconds the clock must advance (or a resume position must be reached) to count as playing. */
  minAdvanceS: number;
  /** Providers that draw their own controls and may wait for a tap before playing (autoplay can be blocked). */
  manualStart: SourceId[];
  /** Start window for those once their page has loaded, and after each tap into the embed. */
  manualGraceMs: number;
}

export const FALLBACK_CONFIG: FallbackConfig = {
  startTimeoutMs: { default: 15_000, cinesrc: 18_000, vidy: 14_000, vidyanime: 14_000 },
  progressGraceMs: 10_000,
  minAdvanceS: 0.4,
  manualStart: ["vidy", "vidyanime", "vidlink"],
  manualGraceMs: 30_000
};

export type FallbackEvent =
  | { kind: "start"; order: SourceId[]; now: number }
  | { kind: "progress"; now: number }
  | { kind: "time"; position: number; now: number; resumeAt?: number }
  | { kind: "play"; now: number }
  | { kind: "interact"; now: number }
  | { kind: "error"; now: number; init?: boolean }
  | { kind: "missing"; now: number }
  | { kind: "tick"; now: number }
  | { kind: "offline"; now: number }
  | { kind: "online"; now: number }
  | { kind: "cancel"; now: number }
  | { kind: "retry"; now: number };

export const initialFallback = (): FallbackState => ({ order: [], index: 0, status: "idle", attempts: [], deadline: null, firstPos: null });

export const currentSource = (s: FallbackState): SourceId | null => (s.status === "loading" || s.status === "playing" || s.status === "offline" ? s.order[s.index] ?? null : null);
export const attemptedSources = (s: FallbackState): SourceId[] => [...new Set(s.attempts.map((a) => a.source))];

const timeoutFor = (id: SourceId | undefined, c: FallbackConfig) => (id && c.startTimeoutMs[id]) || c.startTimeoutMs.default;

function begin(s: FallbackState, index: number, now: number, c: FallbackConfig): FallbackState {
  const id = s.order[index];
  if (!id) return { ...s, index, status: "failed", deadline: null, firstPos: null };
  return { ...s, index, status: "loading", firstPos: null, deadline: now + timeoutFor(id, c), attempts: [...s.attempts, { source: id, startedAt: now, endedAt: null, outcome: null, progressed: false }] };
}

function close(s: FallbackState, outcome: AttemptOutcome, now: number): FallbackState {
  const attempts = s.attempts.slice();
  const last = attempts[attempts.length - 1];
  if (last && last.outcome === null) attempts[attempts.length - 1] = { ...last, outcome, endedAt: now };
  return { ...s, attempts };
}

/** Move on to the next provider (or fail when none is left). Never loops: each provider is tried once per round. */
function advance(s: FallbackState, reason: FailureReason, now: number, c: FallbackConfig): FallbackState {
  return begin(close(s, reason, now), s.index + 1, now, c);
}

export function fallbackReducer(s: FallbackState, e: FallbackEvent, c: FallbackConfig = FALLBACK_CONFIG): FallbackState {
  switch (e.kind) {
    case "start": {
      const order = [...new Set(e.order)];
      if (!order.length) return { ...initialFallback(), order, status: "failed" };
      return begin({ ...initialFallback(), order }, 0, e.now, c);
    }
    case "retry":
      if (!s.order.length) return s;
      return begin({ ...s, attempts: s.attempts }, 0, e.now, c);
    case "cancel":
      if (s.status !== "loading" && s.status !== "offline") return s;
      return { ...close(s, "cancelled", e.now), status: "cancelled", deadline: null };
    case "offline":
      if (s.status !== "loading") return s;
      // the attempt is not the provider's fault: pause the clock, keep the provider
      return { ...s, status: "offline", deadline: null };
    case "online":
      if (s.status !== "offline") return s;
      return { ...s, status: "loading", deadline: e.now + timeoutFor(s.order[s.index], c) };
    case "progress": {
      if (s.status !== "loading") return s;
      const attempts = s.attempts.slice();
      const last = attempts[attempts.length - 1];
      if (!last || last.progressed) return s;
      attempts[attempts.length - 1] = { ...last, progressed: true };
      const grace = c.manualStart.includes(last.source) ? c.manualGraceMs : c.progressGraceMs;
      return { ...s, attempts, deadline: Math.max(s.deadline ?? 0, e.now + grace) };
    }
    case "interact": {
      // the viewer tapped into an embed with its own controls: give that tap time to start the stream (repeatable)
      if (s.status !== "loading") return s;
      const cur = s.order[s.index];
      if (!cur || !c.manualStart.includes(cur)) return s;
      return { ...s, deadline: Math.max(s.deadline ?? 0, e.now + c.manualGraceMs) };
    }
    case "play":
      // "play" alone is intent, not proof (autoplay can be blocked); it counts as a sign of life
      return fallbackReducer(s, { kind: "progress", now: e.now }, c);
    case "time": {
      if (s.status !== "loading") return s;
      if (!(e.position > 0)) return fallbackReducer(s, { kind: "progress", now: e.now }, c);
      if (s.firstPos === null) {
        // opening past a resume point is proof on its own: the stream decoded up to there
        if (e.resumeAt && e.resumeAt > 1 && e.position >= e.resumeAt - 1) return { ...close(s, "playing", e.now), status: "playing", deadline: null };
        const p = fallbackReducer(s, { kind: "progress", now: e.now }, c);
        return { ...p, firstPos: e.position };
      }
      if (e.position - s.firstPos >= c.minAdvanceS) return { ...close(s, "playing", e.now), status: "playing", deadline: null };
      return s;
    }
    case "missing":
      if (s.status !== "loading") return s;
      return advance(s, "no-source", e.now, c);
    case "error":
      if (s.status !== "loading") return s; // an error after playback started is the player's stall recovery, not fallback
      return advance(s, e.init ? "init" : "error", e.now, c);
    case "tick":
      if (s.status !== "loading" || s.deadline === null || e.now < s.deadline) return s;
      return advance(s, "timeout", e.now, c);
  }
}

/** True when every eligible provider was tried in this round and none played. */
export const allFailed = (s: FallbackState) => s.status === "failed";

/** The reason to record for a total failure: network if any attempt was cut by the connection, else the last one. */
export function failureReason(s: FallbackState): FailureReason {
  const outs = s.attempts.map((a) => a.outcome).filter((o): o is FailureReason => Boolean(o && o !== "playing" && o !== "cancelled"));
  if (outs.includes("network")) return "network";
  return outs[outs.length - 1] ?? "no-source";
}
