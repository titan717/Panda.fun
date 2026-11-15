/**
 * v1.4.0 Intro Manager config — the ONE place that says which launch intro plays.
 *
 * To replace an intro: drop the new file into public/intro/ (see docs/INTRO.md), point the asset's `src` here and
 * bump `version` so every device plays the new intro once. A platform with `kind: "animation"` plays the built-in
 * mascot animation (components/Intro.tsx) instead of a video; `shared` is used by any platform whose own asset is null.
 */
export type IntroAsset =
  | { kind: "video"; src: string; width: number; height: number; fit: "cover" | "contain" }
  | { kind: "animation" };

/**
 * When the intro plays (never on ?resumed=1 Android recreation, rerenders or in-app navigation in either mode):
 * - "every-cold-start": each time the app process (or a new browser tab) starts. A reload or a deep link in the same
 *   tab is not a cold start: the per-tab sessionStorage mark stops a replay.
 * - "once-per-version": only the first cold start after install or after `version` changes.
 */
export type IntroReplay = "every-cold-start" | "once-per-version";

export interface IntroConfig {
  /** Bump to replay the intro once on every device, even in "once-per-version" mode. */
  version: string;
  replay: IntroReplay;
  tv: IntroAsset | null;
  mobile: IntroAsset | null;
  /** Used by a platform whose own asset is null. */
  shared: IntroAsset | null;
  /** Nominal length per platform (ms). Videos end on `ended`; the hard timeout is this + `hardPadMs`. */
  durationMs: { tv: number; mobile: number };
  /** The Skip button appears (and OK/Back skip on TV) after this long (ms). */
  skipAfterMs: number;
  /** Reduced motion (system or Settings): "static" shows the branded still for `staticMs`, "skip" plays nothing. */
  reducedMotion: "static" | "skip";
  /** Length of the branded static frame (mascot + logo on black), also the fallback for a broken video (ms). */
  staticMs: number;
  /** A video that has not started playing by then is replaced by the static frame (ms). */
  startTimeoutMs: number;
  /** The app is never blocked longer than duration + this (ms). */
  hardPadMs: number;
  /** Final fade (ms). */
  leaveMs: number;
}

const base = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";

export const INTRO: IntroConfig = {
  version: "2026.11-1",
  replay: "every-cold-start",
  tv: { kind: "video", src: `${base}intro/intro-tv.mp4`, width: 1280, height: 720, fit: "contain" },
  // until the final portrait video lands: the built-in mascot animation. Later: { kind: "video", src: `${base}intro/intro-mobile.mp4`, width: 1080, height: 1920, fit: "cover" }
  mobile: { kind: "animation" },
  shared: null,
  durationMs: { tv: 5000, mobile: 2200 },
  skipAfterMs: 1000,
  reducedMotion: "static",
  staticMs: 1200,
  startTimeoutMs: 1500,
  hardPadMs: 2000,
  leaveMs: 280
};
