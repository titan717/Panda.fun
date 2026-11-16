import { getPrefs } from "../store";

/**
 * Reduced motion right now: the system setting, the profile's Settings › Display › Reduce motion, or the
 * `html[data-motion="reduce"]` flag App sets from it. Never throws (false when nothing can be read).
 */
export function reducedMotionNow(): boolean {
  try { if (document.documentElement.dataset.motion === "reduce") return true; } catch { /* no DOM */ }
  try { if (getPrefs().reduceMotion) return true; } catch { /* store unavailable */ }
  try { return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches); } catch { return false; }
}
