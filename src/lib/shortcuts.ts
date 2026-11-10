/**
 * v1.2.8 player keyboard shortcuts for desktop and laptop keyboards (the same letters most web players use).
 * Remote keys keep their existing meaning; these are extra and never fire while typing or with a modifier.
 */
export type PlayerShortcut = "toggle" | "back10" | "fwd10" | "mute" | "fullscreen" | "help";

export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["Space", "K"], label: "Play or pause" },
  { keys: ["J"], label: "Back 10 seconds" },
  { keys: ["L"], label: "Forward 10 seconds" },
  { keys: ["←", "→"], label: "Seek (opens the seek bar)" },
  { keys: ["M"], label: "Sound on or off" },
  { keys: ["C"], label: "Subtitles on or off" },
  { keys: ["F"], label: "Full screen" },
  { keys: ["?"], label: "Show these shortcuts" },
  { keys: ["Esc"], label: "Back" },
];

export function playerShortcut(e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "target">): PlayerShortcut | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const el = e.target as HTMLElement | null;
  if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return null;
  switch (e.key) {
    case "k": case "K": return "toggle";
    // Space presses a focused button (it is the remote's OK on some keyboards); it plays and pauses everywhere else
    case " ": return el && (el.tagName === "BUTTON" || el.tagName === "A" || el.getAttribute("role") === "slider") ? null : "toggle";
    case "j": case "J": return "back10";
    case "l": case "L": return "fwd10";
    case "m": case "M": return "mute";
    case "f": case "F": return "fullscreen";
    case "?": return "help";
    default: return null;
  }
}

/** Enter or leave full screen for the whole app (the embed is allowed full screen too). */
export async function toggleFullscreen(doc: Document = document) {
  try {
    if (doc.fullscreenElement) await doc.exitFullscreen();
    else await doc.documentElement.requestFullscreen({ navigationUI: "hide" });
    return true;
  } catch { return false; }
}
