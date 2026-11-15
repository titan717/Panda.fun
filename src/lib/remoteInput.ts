import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { native } from "./native";

/**
 * Text fields on TV (D-45, v1.3.2): focusing a field with the D-pad must not pop the on-screen keyboard, so the field
 * sits at inputMode="none". OK opens the keyboard (Gboard / the Android TV IME, or the system keyboard of a browser);
 * Enter or Search on the keyboard closes it and runs `onDone` (usually "move to the next control"). Off TV the field
 * behaves normally.
 *
 * Why the old version never opened Gboard in the Android app (v1.3.2 root causes):
 * - it opened the keyboard by blur() + focus() a frame later, but blur ran the field's onBlur, which set editing back
 *   to false, so the field returned to inputMode="none" straight away;
 * - flipping inputMode on an already-focused field does not show an IME in Android WebView: Chromium only shows one
 *   for a tap or a focus with "show IME if needed", and a script focus from a D-pad press is neither. The app now asks
 *   the native side (KinomaNative.showKeyboard, bridge-key gated) to restart the input connection, so the IME reads
 *   the new input type, and to show the soft keyboard; the native side reports IME visibility back (__pandaIme).
 */

export const IME_EVENT = "panda-ime";

declare global {
  interface Window { __pandaIme?: (visible: boolean) => void }
  interface Navigator { virtualKeyboard?: { show(): void; hide(): void; overlaysContent?: boolean } }
}

if (typeof window !== "undefined" && !window.__pandaIme) {
  window.__pandaIme = (visible) => window.dispatchEvent(new CustomEvent<boolean>(IME_EVENT, { detail: Boolean(visible) }));
}

/** Ask the platform for the on-screen keyboard for the focused field. Returns how it was requested (for tests and logs). */
export function requestKeyboard(el: HTMLElement, refocus: () => void): "native" | "virtualKeyboard" | "refocus" {
  try { if (native?.showKeyboard) { native.showKeyboard(); return "native"; } } catch { /* older app without the bridge method */ }
  const vk = typeof navigator !== "undefined" ? navigator.virtualKeyboard : undefined;
  if (vk && document.activeElement === el) {
    try { vk.show(); return "virtualKeyboard"; } catch { /* needs a user gesture; fall through */ }
  }
  refocus();
  return "refocus";
}

export function dismissKeyboard() {
  try { native?.hideKeyboard?.(); } catch { /* not available */ }
}

export interface RemoteFieldOptions {
  /** inputMode while the keyboard is open (default "text") */
  mode?: "text" | "search";
}

export function useRemoteField(enabled: boolean, onDone?: () => void, opts: RemoteFieldOptions = {}) {
  const ref = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  // set by open(): the keyboard is requested once the field has re-rendered with its real inputMode
  const wantKeyboard = useRef(false);
  // the browser fallback blurs and refocuses the field; that blur must not end editing
  const refocusing = useRef(false);
  // typed into without the on-screen keyboard (hardware keyboard / desktop). A ref, not state: re-rendering on the
  // first keystroke made preact re-apply the controlled value before the page saw it and the first letter was lost.
  const typed = useRef(false);

  useEffect(() => {
    if (!editing || !wantKeyboard.current) return;
    wantKeyboard.current = false;
    const el = ref.current;
    if (!el) return;
    requestKeyboard(el, () => {
      refocusing.current = true;
      el.blur();
      el.focus({ preventScroll: true });
      refocusing.current = false;
    });
  }, [editing]);

  // Android app: the IME was closed (Back on the keyboard, or it lost the field): the field is back to remote mode
  useEffect(() => {
    if (!enabled || !editing) return;
    const onIme = (e: Event) => { if ((e as CustomEvent<boolean>).detail === false) setEditing(false); };
    window.addEventListener(IME_EVENT, onIme);
    return () => window.removeEventListener(IME_EVENT, onIme);
  }, [enabled, editing]);

  const open = () => {
    if (!ref.current) return;
    wantKeyboard.current = true;
    setEditing(true);
  };
  const close = () => { typed.current = false; setEditing(false); dismissKeyboard(); };

  if (!enabled) return { ref, editing: false, open, close, props: {} };
  return {
    ref,
    editing,
    open,
    close,
    props: {
      inputMode: editing ? (opts.mode ?? "text") : ("none" as const),
      onClick: () => { if (!editing) open(); },
      onBlur: () => { if (!refocusing.current) { typed.current = false; setEditing(false); } },
      // typing without the on-screen keyboard (a hardware keyboard, a desktop browser): the field is being edited,
      // so Enter submits instead of asking for a keyboard nobody needs
      onInput: () => { typed.current = true; },
      onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Escape" && editing) {
          // first Back/Escape closes the keyboard and stays on the field; the next one leaves the page
          e.preventDefault();
          close();
          return;
        }
        if (e.key !== "Enter") return;
        e.preventDefault();
        if (!editing && !typed.current) open(); else { close(); onDone?.(); }
      }
    }
  };
}
