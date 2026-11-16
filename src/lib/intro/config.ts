/**
 * v1.4.0 Intro Manager config — the ONE place that says which launch intro plays.
 *
 * To replace an intro: drop the new file into public/intro/ (see docs/INTRO.md), point the asset's `src` here and
 * bump `version` so every device plays the new intro once. A platform with `kind: "animation"` plays the built-in
 * mascot animation (components/Intro.tsx) instead of a video; `kind: "bumper"` (v1.4.2, the default on phones and
 * TVs) plays the 4 s canvas IntroBumper with its synthesised score; `shared` is used by any platform whose own asset
 * is null.
 */
export type IntroAsset =
  | { kind: "video"; src: string; width: number; height: number; fit: "cover" | "contain" }
  | { kind: "animation" }
  | { kind: "bumper" };

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
  /** v1.4.2 IntroBumper: its nominal length and the hard timeout that always ends it (ms). */
  bumper: { durationMs: number; hardMs: number };
  /** Final fade (ms). */
  leaveMs: number;
}

const base = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";

export const INTRO: IntroConfig = {
  version: "2026.11-2",
  replay: "every-cold-start",
  // v1.4.2: the canvas IntroBumper on both platforms. The v1.4.0 placeholder video stays available:
  // { kind: "video", src: `${base}intro/intro-tv.mp4`, width: 1280, height: 720, fit: "contain" }
  tv: { kind: "bumper" },
  mobile: { kind: "bumper" },
  shared: null,
  // used only by video / animation assets; the bumper has its own timings below
  durationMs: { tv: 5000, mobile: 2200 },
  skipAfterMs: 1000,
  reducedMotion: "static",
  staticMs: 1200,
  startTimeoutMs: 1500,
  hardPadMs: 2000,
  bumper: { durationMs: 4000, hardMs: 4200 },
  leaveMs: 280
};

/** Kept so a config can point back at the v1.4.0 placeholder video in one line. */
export const INTRO_TV_VIDEO: IntroAsset = { kind: "video", src: `${base}intro/intro-tv.mp4`, width: 1280, height: 720, fit: "contain" };
