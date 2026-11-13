/**
 * Audio unlock (MASTER §4.B/D). Browsers allow trailers with sound only after a user gesture on
 * the page; the first remote press, key, tap or the "Who's watching" press unlocks it. Embedded
 * players inherit the activation through `allow="autoplay"`. On Android the WebView media gesture
 * requirement is disabled natively, so the flag starts unlocked there.
 */
import { isAndroidApp } from "./native";

let unlocked = false;
const listeners = new Set<() => void>();

export const isAudioUnlocked = () => unlocked;

export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  try {
    // Resuming a silent AudioContext inside the gesture marks the page as allowed to play sound.
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) { const ctx = new Ctx(); void ctx.resume().then(() => ctx.close()).catch(() => undefined); }
  } catch { /* not available */ }
  listeners.forEach((l) => l());
}

export function onAudioUnlock(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

export function installAudioUnlock() {
  if (typeof window === "undefined") return;
  if (isAndroidApp) { unlocked = true; return; }
  const h = () => { unlockAudio(); remove(); };
  const opts = { capture: true, passive: true } as const;
  const remove = () => { for (const t of ["keydown", "pointerdown", "touchend"]) window.removeEventListener(t, h, opts); };
  for (const t of ["keydown", "pointerdown", "touchend"]) window.addEventListener(t, h, opts);
}

/* One trailer at a time: a new trailer, the player or a page change stops the others at once. */
const stoppers = new Set<() => void>();
export function registerTrailer(stop: () => void) { stoppers.add(stop); return () => { stoppers.delete(stop); }; }
export function stopAllTrailers(except?: () => void) { stoppers.forEach((s) => { if (s !== except) s(); }); }

/* ---------------- Mute memory (v1.2.6, moved here in v1.3.0 so the launch intro can respect it) ---------------- */
const MUTE_KEY = "panda:muted";
export function getMutedMemory() { try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; } }
export function saveMutedMemory(m: boolean) { try { if (m) localStorage.setItem(MUTE_KEY, "1"); else localStorage.removeItem(MUTE_KEY); } catch { /* storage full */ } }
