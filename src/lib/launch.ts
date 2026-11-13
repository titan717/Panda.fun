import { useSyncExternalStore } from "react";

/**
 * v1.2.9 "Who's watching?" on every fresh start. A fresh start is a new browsing session: the first load of a
 * tab, or a cold start of the Android app (its WebView is created with an empty sessionStorage). The activity
 * handles rotation and keyboard changes itself (configChanges), so those never recreate the WebView, and moving
 * between screens or coming back to Home never asks again. Profiles stay in localStorage untouched; only the
 * "picked this session" mark lives in sessionStorage.
 */
const KEY = "panda:who";
const SPLASH = "panda:splash";

/** The Android shell marks a recreated activity (not a cold start) with ?resumed=1. */
export function resumedLaunch() {
  try { return new URLSearchParams(location.search).has("resumed"); } catch { return false; }
}

function readFresh() {
  if (resumedLaunch()) return false;
  try { return !sessionStorage.getItem(KEY) && !sessionStorage.getItem(SPLASH); } catch { return false; }
}

/** Whether this load should play the launch intro (fresh start, not a recreated activity). */
export function introPending() {
  if (resumedLaunch()) return false;
  try { return !sessionStorage.getItem(SPLASH); } catch { return false; }
}

/** The intro finished (v1.3.0: it cannot be skipped, only the timeline or the hard timeout ends it). */
export function introDone() {
  try { sessionStorage.setItem(SPLASH, "1"); } catch { /* private mode: the intro may replay on reload */ }
}

/**
 * v1.3.0 intro phase, shared so Who's watching can wait for the handoff and so non-key input paths (phone remote
 * text) can be ignored while the intro is on screen. "show" blocks input, "leave" is the final fade, "done" is gone.
 */
export type IntroPhase = "show" | "leave" | "done";
let introPhase: IntroPhase = "done";
const introSubs = new Set<() => void>();
export function getIntroPhase() { return introPhase; }
export function setIntroPhase(p: IntroPhase) {
  if (p === introPhase) return;
  introPhase = p;
  for (const f of introSubs) { try { f(); } catch { /* a listener must never stop the intro from ending */ } }
}
/** True while the launch intro is on screen (input is blocked). */
export const introActive = () => introPhase !== "done";
export function useIntroPhase() {
  return useSyncExternalStore((f) => { introSubs.add(f); return () => introSubs.delete(f); }, getIntroPhase, () => "done" as IntroPhase);
}

let pending = typeof window !== "undefined" && readFresh();
const subs = new Set<() => void>();

/** True until a profile is picked in this session (only on a fresh start with saved profiles). */
export function whoPending() { return pending; }

/** A profile was picked (or created and picked): stop asking until the next fresh start. */
export function whoDone() {
  try { sessionStorage.setItem(KEY, "1"); } catch { /* private mode: asking once per page load is fine */ }
  if (!pending) return;
  pending = false;
  for (const f of subs) f();
}

export function useWhoPending() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, whoPending, () => false);
}
