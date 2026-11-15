import { resumedLaunch } from "../launch";
import { INTRO, type IntroAsset, type IntroConfig } from "./config";

/**
 * v1.4.0 Intro Manager rules (pure, tested in src/test/intro.test.tsx):
 * - plays on a cold start only (not on ?resumed=1, rerender, remount or navigation): every cold start, or once per
 *   intro version per device, per `INTRO.replay`;
 * - reduced motion shows the branded still (or nothing, per config);
 * - the app is never blocked longer than duration + hardPadMs.
 */
export const INTRO_KEY = "panda:v1:intro";
/** Per-tab / per-process mark: this launch already played (or skipped) the intro. */
export const INTRO_SESSION_KEY = "panda:v1:intro-session";

function playedThisSession() {
  try { return sessionStorage.getItem(INTRO_SESSION_KEY) !== null; } catch { return false; }
}

export type IntroView = "video" | "animation" | "static";
export interface IntroPlan {
  version: string;
  view: IntroView;
  /** Video file, only for view === "video". */
  src: string | null;
  fit: "cover" | "contain";
  durationMs: number;
  skipAfterMs: number;
  staticMs: number;
  startTimeoutMs: number;
  hardMs: number;
  leaveMs: number;
}

function readSeen(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(INTRO_KEY) ?? "{}") as unknown;
    const seen = v && typeof v === "object" && !Array.isArray(v) ? (v as { seen?: unknown }).seen : null;
    if (!seen || typeof seen !== "object" || Array.isArray(seen)) return {};
    return Object.fromEntries(Object.entries(seen).filter(([, t]) => typeof t === "number"));
  } catch { return {}; }
}

/** Decided once per page load (and reset by markIntroSeen), so a rerender or remount never replays the intro. */
let due: boolean | null = null;

/** Whether this cold start should play `version` (stable for the whole page load). */
export function introDue(version = INTRO.version, replay = INTRO.replay) {
  if (due === null) due = !resumedLaunch() && !playedThisSession() && (replay === "every-cold-start" || !(version in readSeen()));
  return due;
}

/** The intro finished or was skipped: not again in this launch, nor (in "once-per-version" mode) on this device. */
export function markIntroSeen(version = INTRO.version, now = Date.now()) {
  due = false;
  try { sessionStorage.setItem(INTRO_SESSION_KEY, version); } catch { /* in-memory flag covers this load */ }
  try {
    // keep the last few versions only
    const seen = Object.entries({ ...readSeen(), [version]: now }).sort((a, b) => b[1] - a[1]).slice(0, 5);
    localStorage.setItem(INTRO_KEY, JSON.stringify({ seen: Object.fromEntries(seen) }));
  } catch { /* storage unavailable: the in-memory flag still stops a replay in this load */ }
}

/** Tests only: forget this load's decision. */
export function resetIntroDecision() { due = null; }

/** What to play on this platform, or null when nothing should play (reduced motion set to "skip", no asset). */
export function planIntro(opts: { tv: boolean; reduce: boolean }, cfg: IntroConfig = INTRO): IntroPlan | null {
  const asset: IntroAsset | null = (opts.tv ? cfg.tv : cfg.mobile) ?? cfg.shared;
  const common = { version: cfg.version, skipAfterMs: cfg.skipAfterMs, staticMs: cfg.staticMs, startTimeoutMs: cfg.startTimeoutMs, leaveMs: cfg.leaveMs };
  if (opts.reduce) {
    if (cfg.reducedMotion === "skip") return null;
    return { ...common, view: "static", src: null, fit: "contain", durationMs: cfg.staticMs, hardMs: cfg.staticMs + cfg.hardPadMs };
  }
  if (!asset) return null;
  const durationMs = opts.tv ? cfg.durationMs.tv : cfg.durationMs.mobile;
  return {
    ...common,
    view: asset.kind,
    src: asset.kind === "video" ? asset.src : null,
    fit: asset.kind === "video" ? asset.fit : "contain",
    durationMs,
    hardMs: durationMs + cfg.hardPadMs
  };
}
