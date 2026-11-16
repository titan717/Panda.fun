import { introActive, introEndedAt, resumedLaunch } from "../launch";

/**
 * v1.4.2 pre-movie bumper rules. The IntroBumper plays when the Player opens a title, except:
 * - after an in-player episode change (Next Episode, Up Next, the Episodes drawer): one bumper per sitting, not one
 *   per episode;
 * - on an Android activity recreation (`?resumed=1`, e.g. rotation), which re-opens the same playback;
 * - v1.5.0: while the launch intro is on screen or within INTRO_GRACE_MS after it (a cold start straight into the
 *   Player — a deep link, a "resume" notification — must not play the launch intro and then a second bumper);
 * - when `panda:v1:bumper` is "off" in sessionStorage or localStorage (test runs and support switch).
 * Reduced motion shows the bumper's static final frame briefly instead (components/PreMovieBumper.tsx).
 */
export const BUMPER_OFF_KEY = "panda:v1:bumper";

let skipFor: string | null = null;

export const bumperKey = (type: string, id: number, s = 0, e = 0) => `${type}-${id}-${type === "tv" ? `${s}-${e}` : ""}`;

/** The Player is about to switch to `key` itself: that playback starts without a bumper. */
export function skipBumperFor(key: string) { skipFor = key; }
/** The Player for `key` has mounted: the skip request is used up (called from an effect, so StrictMode-safe). */
export function clearBumperSkip(key: string) { if (skipFor === key) skipFor = null; }

function switchedOff() {
  for (const s of [() => sessionStorage, () => localStorage]) {
    try { if (s().getItem(BUMPER_OFF_KEY) === "off") return true; } catch { /* storage unavailable */ }
  }
  return false;
}

/** No pre-movie bumper while the launch intro is up or within this long after it: one brand moment per cold start. */
export const INTRO_GRACE_MS = 20_000;

/** Whether the Player opening `key` should show the bumper (pure read, safe in a state initialiser). */
export function preMovieBumperDue(key: string) {
  if (skipFor === key) return false;
  if (resumedLaunch()) return false;
  if (introActive()) return false;
  const ended = introEndedAt();
  const t = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (ended > 0 && t - ended < INTRO_GRACE_MS) return false;
  return !switchedOff();
}
