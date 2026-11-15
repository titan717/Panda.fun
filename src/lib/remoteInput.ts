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

/**
 * Ask the platform for the on-screen keyboard for the focused field. Returns how it was requested (for tests and logs).
 *
 * v1.4.1 root cause (Gboard never opened from TV Search; the phone layout on the same TV was fine): the field was
 * switched out of inputMode="none" by a React re-render, and the native side was asked 64 ms later to restart the
 * input connection. On a TV box the WebView had often not received the new input mode yet, so the IME was bound to
 * a "no keyboard" field and showSoftInput did nothing. Now the switch happens in the OK key press itself: the
 * field's inputMode is set on the element, then it is blurred and focused again while the key press still counts as
 * a user gesture, which is the same path that opens the keyboard on the phone layout (a focus with a user gesture).
 * The native request follows two frames later, once the renderer has sent the new state, and retries on its own until
 * the IME is visible (MainActivity.showSoftKeyboard).
 */
export function requestKeyboard(el: HTMLElement, refocus: () => void): "native" | "virtualKeyboard" | "refocus" {
  refocus();
  const later = (fn: () => void) => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(() => requestAnimationFrame(fn)) : setTimeout(fn, 32));
  if (native?.showKeyboard) {
    later(() => { try { if (document.activeElement === el) native?.showKeyboard?.(); } catch { /* older app without the bridge method */ } });
    return "native";
  }
  const vk = typeof navigator !== "undefined" ? navigator.virtualKeyboard : undefined;
  if (vk && document.activeElement === el) {
    try { vk.show(); return "virtualKeyboard"; } catch { /* needs a user gesture; the refocus above is the fallback */ }
  }
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
  // the browser fallback blurs and refocuses the field; that blur must not end editing
  const refocusing = useRef(false);
  // typed into without the on-screen keyboard (hardware keyboard / desktop). A ref, not state: re-rendering on the
  // first keystroke made preact re-apply the controlled value before the page saw it and the first letter was lost.
  const typed = useRef(false);

  // Android app: the IME was closed (Back on the keyboard, or it lost the field): the field is back to remote mode
  useEffect(() => {
    if (!enabled || !editing) return;
    const onIme = (e: Event) => { if ((e as CustomEvent<boolean>).detail === false) { if (ref.current) ref.current.inputMode = "none"; setEditing(false); } };
    window.addEventListener(IME_EVENT, onIme);
    return () => window.removeEventListener(IME_EVENT, onIme);
  }, [enabled, editing]);

  // OK on the field: switch it to a real text field and ask for the keyboard in the same key press (see requestKeyboard).
  // Idempotent: on some TVs OK arrives as both an Enter keydown and a click.
  const open = () => {
    const el = ref.current;
    if (!el || el.inputMode === (opts.mode ?? "text")) return;
    el.inputMode = opts.mode ?? "text";
    setEditing(true);
    requestKeyboard(el, () => {
      refocusing.current = true;
      try { el.blur(); el.focus({ preventScroll: true }); } finally { refocusing.current = false; }
    });
  };
  const close = () => { typed.current = false; if (ref.current) ref.current.inputMode = "none"; setEditing(false); dismissKeyboard(); };

  if (!enabled) return { ref, editing: false, open, close, props: {} };
  return {
    ref,
    editing,
    open,
    close,
    props: {
      inputMode: editing ? (opts.mode ?? "text") : ("none" as const),
      onClick: () => { if (!editing) open(); },
      onBlur: () => { if (!refocusing.current) { typed.current = false; if (ref.current) ref.current.inputMode = "none"; setEditing(false); } },
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
