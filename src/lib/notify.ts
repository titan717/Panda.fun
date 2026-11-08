import { native } from "./native";

/**
 * System notifications on the web (Notification API) and in the Android app (native bridge,
 * which also asks for POST_NOTIFICATIONS on Android 13+). v1.1.7, DECISIONS D-89.
 */
export type NotifyPermission = "granted" | "denied" | "default" | "unsupported";

declare global {
  interface Window { __pandaNotifPerm?: (state: string) => void; __pandaOpen?: (path: string) => void }
}

const webSupported = () => typeof window !== "undefined" && "Notification" in window;

export function notifyPermission(): NotifyPermission {
  try {
    if (native?.notificationPermission) return asPerm(native.notificationPermission());
  } catch { /* old APK without the bridge method */ }
  if (native) return "unsupported";
  return webSupported() ? (Notification.permission as NotifyPermission) : "unsupported";
}

const asPerm = (s: string): NotifyPermission => (s === "granted" || s === "denied" || s === "default" ? s : "unsupported");

export async function requestNotify(): Promise<NotifyPermission> {
  if (native?.requestNotificationPermission) {
    return new Promise((resolve) => {
      const done = (s: string) => { clearTimeout(t); window.__pandaNotifPerm = undefined; resolve(asPerm(s)); };
      const t = setTimeout(() => done(notifyPermission()), 60_000);
      window.__pandaNotifPerm = done;
      try { native!.requestNotificationPermission!(); } catch { done("unsupported"); }
    });
  }
  if (!webSupported()) return "unsupported";
  return (await Notification.requestPermission()) as NotifyPermission;
}

let navigate: ((path: string) => void) | null = null;
/** The router registers itself so a notification click opens the right screen. */
export function setNotifyNavigator(fn: ((path: string) => void) | null) {
  navigate = fn;
  if (typeof window !== "undefined") window.__pandaOpen = fn ?? undefined;
}

/** Path the Android app was opened with from a notification (cold start), once. */
export function takeLaunchPath(): string | null {
  try { const p = native?.takeLaunchPath?.(); return p && p.startsWith("/") ? p : null; } catch { return null; }
}

export function showNotification(n: { tag: string; title: string; body: string; path: string; image?: string | null }) {
  if (notifyPermission() !== "granted") return false;
  try {
    if (native?.showNotification) { native.showNotification(n.tag, n.title, n.body, n.path); return true; }
    const note = new Notification(n.title, { body: n.body, tag: n.tag, icon: "./pwa-192x192.png" });
    note.onclick = () => { window.focus(); navigate?.(n.path); note.close(); };
    return true;
  } catch { return false; }
}
