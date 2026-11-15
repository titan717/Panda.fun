import { useSyncExternalStore } from "react";

/**
 * Launch state shared by the intro, Who's watching and onboarding.
 *
 * v1.4.0 profile rule (replaces v1.2.9's "ask on every fresh start"): the last selected profile is remembered in the
 * store (`activeProfileId`, localStorage) and a cold start opens its Home directly. Who's watching shows only when
 * there is no valid saved profile (first run, corrupted state, the saved profile was deleted) or when the user picks
 * Switch profile, which clears the active profile. Nothing here is kept per browser session any more.
 */

/** The Android shell marks a recreated activity (not a cold start) with ?resumed=1. */
export function resumedLaunch() {
  try { return new URLSearchParams(location.search).has("resumed"); } catch { return false; }
}

/**
 * Intro phase, shared so Who's watching and onboarding can wait for the handoff and so non-key input paths (phone
 * remote text) are ignored while the intro is on screen. "show" is on screen, "leave" is the final fade, "done" is gone.
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
/** True while the launch intro is on screen. */
export const introActive = () => introPhase !== "done";
export function useIntroPhase() {
  return useSyncExternalStore((f) => { introSubs.add(f); return () => introSubs.delete(f); }, getIntroPhase, () => "done" as IntroPhase);
}
