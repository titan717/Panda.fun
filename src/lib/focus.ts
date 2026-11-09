import { getNextFocus } from "@bbc/tv-lrud-spatial";
import { useEffect, useRef } from "react";
import { navKey, isTyping } from "./keys";

/**
 * Spatial navigation for TV/desktop layouts (D-pad, arrow keys) built on BBC's lrud-spatial,
 * plus a single back-key stack shared by both layouts (Escape, Backspace, webOS 461, Tizen 10009, Android back).
 */

type BackHandler = () => boolean | void;
const backStack: { id: number; fn: BackHandler }[] = [];
let backSeq = 0;
let rootBack: (() => void) | null = null;
const scopeStack: HTMLElement[] = [];
let tvEnabled = false;

export function setRootBackHandler(fn: (() => void) | null) { rootBack = fn; }

/** Register a back handler while `active`. The most recently registered handler runs first. */
export function useBackHandler(fn: BackHandler, active = true) {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; });
  useEffect(() => {
    if (!active) return;
    const id = ++backSeq;
    backStack.push({ id, fn: () => ref.current() });
    return () => { const i = backStack.findIndex((h) => h.id === id); if (i >= 0) backStack.splice(i, 1); };
  }, [active]);
}

export function runBack() {
  for (let i = backStack.length - 1; i >= 0; i--) {
    const handled = backStack[i]!.fn();
    if (handled !== false) return;
  }
  if (rootBack) rootBack();
}

/** Trap spatial navigation inside `el` (dialogs, menus, player overlay) while mounted. */
export function useFocusScope(ref: React.RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const previous = document.activeElement as HTMLElement | null;
    scopeStack.push(el);
    if (!el.contains(document.activeElement)) focusFirst(el);
    return () => {
      const i = scopeStack.lastIndexOf(el);
      if (i >= 0) scopeStack.splice(i, 1);
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [ref, active]);
}

const FOCUSABLE = "[tabindex]:not([tabindex='-1']), a[href], button:not([disabled]), input:not([disabled])";

export function focusFirst(scope: ParentNode | null | undefined, selector = FOCUSABLE) {
  const el = scope?.querySelector<HTMLElement>(`[data-autofocus]`) ?? scope?.querySelector<HTMLElement>(selector);
  if (el) { el.focus({ preventScroll: true }); revealFocus(el); return true; }
  return false;
}

/** Focus `el` and scroll its containers so it is fully visible (spec 6.6). */
export function focusEl(el: HTMLElement | null | undefined) {
  if (!el) return false;
  el.focus({ preventScroll: true });
  revealFocus(el);
  return true;
}

/** Keep the focused element visible inside horizontal rows and the vertical page scroller. */
export function revealFocus(el: HTMLElement) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
  const row = el.closest<HTMLElement>("[data-scroll-x]");
  if (row) {
    const pad = parseFloat(getComputedStyle(row).paddingLeft) || 0;
    const target = el.offsetLeft - pad;
    const mode = row.dataset.scrollX;
    if (mode === "start") row.scrollTo({ left: Math.max(0, target), behavior });
    else {
      const left = el.offsetLeft, right = left + el.offsetWidth;
      if (left - pad < row.scrollLeft) row.scrollTo({ left: Math.max(0, left - pad), behavior });
      else if (right + pad > row.scrollLeft + row.clientWidth) row.scrollTo({ left: right + pad - row.clientWidth, behavior });
    }
  }
  const page = el.closest<HTMLElement>("[data-scroll-y]");
  if (page) {
    const anchor = el.closest<HTMLElement>("[data-row]") ?? el;
    const offset = Number(page.dataset.scrollOffset ?? 0.18) * page.clientHeight;
    const top = anchor.getBoundingClientRect().top - page.getBoundingClientRect().top + page.scrollTop;
    if (page.dataset.scrollY === "row") page.scrollTo({ top: Math.max(0, top - offset), behavior });
    else {
      const rect = anchor.getBoundingClientRect();
      const box = page.getBoundingClientRect();
      if (rect.top < box.top + 8 || rect.bottom > box.bottom - 8) page.scrollTo({ top: Math.max(0, top - offset), behavior });
    }
  }
}

function onKeyDown(e: KeyboardEvent) {
  const key = navKey(e);
  if (!key) return;
  if (key === "back") {
    if (e.defaultPrevented) return;
    e.preventDefault();
    runBack();
    return;
  }
  if (!tvEnabled || e.defaultPrevented) return;
  const active = document.activeElement as HTMLElement | null;
  if (key === "left" || key === "right" || key === "up" || key === "down") {
    if (active && isTyping(active) && (key === "left" || key === "right")) {
      const input = active as HTMLInputElement;
      const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
      const atEnd = input.selectionStart === input.value.length;
      if ((key === "left" && !atStart) || (key === "right" && !atEnd)) return;
    }
    const scope = scopeStack[scopeStack.length - 1] ?? document.getElementById("app") ?? document.body;
    const from = active && active !== document.body && scope.contains(active) ? active : null;
    e.preventDefault();
    if (!from) { focusFirst(scope); return; }
    const code = { left: 37, up: 38, right: 39, down: 40 }[key];
    const next = getNextFocus(from, code, scope);
    if (next) {
      const blocked = next.closest("[inert]");
      if (!blocked) focusEl(next);
    }
    return;
  }
  if (key === "enter" && active && !isTyping(active)) {
    const tag = active.tagName;
    if (tag !== "BUTTON" && tag !== "A" && tag !== "INPUT" && tag !== "SELECT") {
      e.preventDefault();
      active.click();
    }
  }
}

// Hover moves TV focus only when the pointer really moves: browsers also fire pointerover at a resting
// pointer when a sheet closes or the page changes under it, which used to pull focus away (v1.2.3).
let lastX = -1, lastY = -1;
function onPointerMove(e: PointerEvent) {
  if (!tvEnabled || e.pointerType === "touch" || (e.clientX === lastX && e.clientY === lastY)) return;
  lastX = e.clientX; lastY = e.clientY;
  const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-hover-focus]");
  if (el && document.activeElement !== el) el.focus({ preventScroll: true });
}

let installed = false;
export function installKeyHandling(tv: boolean) {
  tvEnabled = tv;
  if (installed) return;
  installed = true;
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
}

export function setTvNavigation(tv: boolean) { tvEnabled = tv; }
