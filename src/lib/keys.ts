/** Remote/keyboard key normalisation (BLUEPRINT_SPEC 4.5, PLAN "Back keys"). */
export type NavKey = "left" | "right" | "up" | "down" | "enter" | "back" | "play" | "pause" | "playpause" | "next" | "prev" | "ff" | "rw" | null;

const BACK_CODES = new Set([8, 27, 461, 10009, 166]); // Backspace, Escape, webOS Back, Tizen Return, BrowserBack

export function navKey(e: KeyboardEvent): NavKey {
  switch (e.key) {
    case "ArrowLeft": return "left";
    case "ArrowRight": return "right";
    case "ArrowUp": return "up";
    case "ArrowDown": return "down";
    case "Enter": return "enter";
    case "Escape": case "GoBack": case "BrowserBack": case "XF86Back": return "back";
    case "Backspace": return isTyping(e.target) ? null : "back";
    case "MediaPlayPause": return "playpause";
    case "MediaPlay": return "play";
    case "MediaPause": return "pause";
    case "MediaTrackNext": return "next";
    case "MediaTrackPrevious": return "prev";
    case "MediaFastForward": return "ff";
    case "MediaRewind": return "rw";
  }
  if (BACK_CODES.has(e.keyCode) && !(e.keyCode === 8 && isTyping(e.target))) return "back";
  switch (e.keyCode) {
    case 37: return "left";
    case 38: return "up";
    case 39: return "right";
    case 40: return "down";
    case 13: return "enter";
    case 415: return "play";
    case 19: return "pause";
    case 10252: case 179: return "playpause";
    case 417: return "ff";
    case 412: return "rw";
  }
  return null;
}

export function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
}
