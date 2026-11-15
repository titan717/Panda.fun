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

/** Left edge of `el` in the content coordinates of the scroll row `row` (ignores transforms, works through positioned wrappers). */
export function trackLeft(el: HTMLElement, row: HTMLElement) {
  let x = 0;
  for (let n: HTMLElement | null = el; n && n !== row; n = n.offsetParent as HTMLElement | null) {
    if (!row.contains(n)) return x - row.offsetLeft - row.clientLeft;
    x += n.offsetLeft;
  }
  return x;
}

/**
 * Scroll a TV rail so `anchor` leads it. Measured on the next frame: focus re-renders the cards (the card that
 * lost focus shrinks back to a poster, the new one widens), and measuring before that commit overshot the row by
 * the width the old card gives back. The frame runs before paint, so the row never shows the wrong position.
 */
function leadRow(row: HTMLElement, anchor: HTMLElement, pad: number) {
  const run = () => {
    if (!row.isConnected || !anchor.isConnected) return;
    const left = Math.max(0, trackLeft(anchor, row) - pad);
    if (Math.abs(row.scrollLeft - left) > 1) row.scrollTo({ left, behavior: "auto" });
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(run); else run();
}

export interface NearestScroll {
  scrollTop: number; clientHeight: number; scrollHeight: number;
  /** element top in the scroller's content coordinates, and its height */
  top: number; height: number;
  /** space kept clear above and below the focused element (look-ahead, room for the focus glow and group titles) */
  margin: number;
  first: boolean; last: boolean;
}

/**
 * Vertical scroll for lists of settings-like rows (`data-scroll-y="nearest"`, v1.3.2): the page moves only when the
 * focused element would come closer than `margin` to an edge, and then by just enough, so Down scrolls one row at a
 * time and Up reverses it exactly. The first focusable scrolls to the very top (its heading shows), the last to the
 * very bottom (notes after it show). An element taller than the view lines up with its top edge.
 * Returns the new scrollTop, or null when the element is already comfortably visible.
 */
export function nearestScrollTop(m: NearestScroll): number | null {
  const max = Math.max(0, m.scrollHeight - m.clientHeight);
  const margin = Math.max(0, Math.min(m.margin, (m.clientHeight - m.height) / 2));
  let want: number | null = null;
  if (m.first && m.top + m.height <= m.clientHeight - margin) want = 0;
  else if (m.last && m.top >= max + Math.min(margin, 12)) want = max;
  else if (m.top - margin < m.scrollTop) want = m.top - margin;
  else if (m.top + m.height + margin > m.scrollTop + m.clientHeight) want = m.height + 2 * margin > m.clientHeight ? m.top - margin : m.top + m.height + margin - m.clientHeight;
  if (want === null) return null;
  want = Math.round(Math.max(0, Math.min(max, want)));
  return Math.abs(want - m.scrollTop) > 1 ? want : null;
}

/** Keep the focused element visible inside horizontal rows and the vertical page scroller. */
export function revealFocus(el: HTMLElement) {
  const behavior: ScrollBehavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  const row = el.closest<HTMLElement>("[data-scroll-x]");
  if (row) {
    const cs = getComputedStyle(row), pad = parseFloat(cs.paddingLeft) || 0;
    // v1.2.9 TV rails: the focused card leads the row. Right slides the card that had focus out past the left edge,
    // Left brings it back; the jump is instant, like the card's own resize, so the row never lags the remote.
    const tvRail = document.documentElement.dataset.mode === "tv" && row.dataset.scrollX !== "edge";
    // a Top 10 card leads with its numeral
    const anchor = tvRail ? el.closest<HTMLElement>(".tv-card-wrap") ?? el : el;
    // measure against the row itself: cards may sit in a positioned wrapper (Top 10 rank), so offsetLeft is not row-relative
    const start = trackLeft(anchor, row) - pad;
    // the right padding is the overscan-safe margin: a focused card never ends inside it
    const over = start + pad + anchor.offsetWidth + (parseFloat(cs.paddingRight) || pad) - row.clientWidth;
    if (tvRail) leadRow(row, anchor, pad);
    else if (row.dataset.scrollX === "start") row.scrollTo({ left: Math.max(0, start), behavior });
    else if (start < row.scrollLeft) row.scrollTo({ left: Math.max(0, start), behavior });
    else if (over > row.scrollLeft) row.scrollTo({ left: over, behavior });
  }
  const page = el.closest<HTMLElement>("[data-scroll-y]");
  if (page && page.dataset.scrollY === "nearest") {
    const box = page.getBoundingClientRect(), rect = el.getBoundingClientRect();
    const items = Array.from(page.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => !n.closest(".lrud-ignore, [inert]") && (n.offsetWidth > 0 || n.offsetHeight > 0));
    const i = items.indexOf(el);
    const top = nearestScrollTop({
      scrollTop: page.scrollTop, clientHeight: page.clientHeight, scrollHeight: page.scrollHeight,
      top: rect.top - box.top - page.clientTop + page.scrollTop, height: rect.height,
      margin: Number(page.dataset.scrollMargin ?? 0.16) * page.clientHeight, first: i === 0, last: i >= 0 && i === items.length - 1
    });
    if (top !== null) page.scrollTo({ top, behavior });
  } else if (page) {
    const rect = (el.closest<HTMLElement>("[data-row]") ?? el).getBoundingClientRect();
    const box = page.getBoundingClientRect();
    // v1.4.0: a scroller taller than the screen (the TV episode list) only counts its visible part
    const visTop = Math.max(box.top, 0), visBottom = Math.min(box.bottom, window.innerHeight);
    const offset = Number(page.dataset.scrollOffset ?? 0.18) * Math.min(page.clientHeight, visBottom - visTop || page.clientHeight);
    const top = rect.top - box.top + page.scrollTop;
    const out = rect.top < visTop + 8 || rect.bottom > visBottom - 8;
    if (page.dataset.scrollY === "row" || out) {
      if (page.scrollHeight > page.clientHeight + 1) page.scrollTo({ top: Math.max(0, top - offset), behavior });
      // the scroller cannot move (its content fits it): scroll the page instead, honouring scroll-margin
      else if (out && !row) el.scrollIntoView({ block: "nearest", inline: "nearest", behavior });
    }
  }
}

/**
 * v1.2.9: side zones (the TV sidebar, `data-nav-side`) are entered only sideways. The sidebar spans the full
 * screen height, so for Up/Down lrud-spatial often scored one of its items closer than the next content row
 * (Details: Watch Now ↓ landed on the sidebar instead of the tabs; Categories did the same). Vertical moves
 * from the content now ignore side zones; when nothing lies below or above, focus stays where it is.
 */
export function nextFocus(from: HTMLElement, key: string, code: number, scope: HTMLElement) {
  if (key !== "up" && key !== "down") return getNextFocus(from, code, scope);
  const sides = Array.from(scope.querySelectorAll<HTMLElement>("[data-nav-side]")).filter((z) => !z.contains(from) && !z.classList.contains("lrud-ignore"));
  for (const z of sides) z.classList.add("lrud-ignore");
  try { return getNextFocus(from, code, scope); } finally { for (const z of sides) z.classList.remove("lrud-ignore"); }
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
  const code = ({ left: 37, up: 38, right: 39, down: 40 } as Record<string, number | undefined>)[key];
  if (code) {
    if (active && isTyping(active) && (key === "left" || key === "right")) {
      const { selectionStart: a, selectionEnd: b, value } = active as HTMLInputElement;
      // let the caret move inside the field until it reaches the edge
      if (key === "left" ? a !== 0 || b !== 0 : a !== value.length) return;
    }
    const scope = scopeStack[scopeStack.length - 1] ?? document.getElementById("app") ?? document.body;
    const from = active && active !== document.body && scope.contains(active) ? active : null;
    e.preventDefault();
    if (!from) { focusFirst(scope); return; }
    const next = nextFocus(from, key, code, scope);
    if (next && !next.closest("[inert]")) focusEl(next);
    return;
  }
  if (key === "enter" && active && !isTyping(active)) {
    if (!/^(BUTTON|A|INPUT|SELECT)$/.test(active.tagName)) {
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
/** TV navigation state for the lazy desktop-mouse module (v1.2.8): is spatial navigation on, and the innermost focus scope. */
export function tvNavigation() { return { enabled: tvEnabled, scope: scopeStack[scopeStack.length - 1] ?? null }; }

/**
 * Focus memory per history entry (v1.3.2): the id of the last focused element inside a screen is kept in
 * history.state, so returning with Back (Details -> Home) lands on the card you left from, while a fresh visit
 * (new history entry) starts at the top. Only elements with an id are remembered.
 */
export const FOCUS_MEMORY_KEY = "pandaFocus";

export function useFocusMemory(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.id) return;
      const state = (history.state ?? {}) as Record<string, unknown>;
      if (state[FOCUS_MEMORY_KEY] === t.id) return;
      try { history.replaceState({ ...state, [FOCUS_MEMORY_KEY]: t.id }, ""); } catch { /* sandboxed history */ }
    };
    el.addEventListener("focusin", onFocusIn);
    return () => el.removeEventListener("focusin", onFocusIn);
  }, [ref]);
}

/** Focus the element remembered for this history entry, if it is still inside `scope`. */
export function recallFocus(scope: HTMLElement | null | undefined) {
  const id = (history.state as Record<string, unknown> | null)?.[FOCUS_MEMORY_KEY];
  if (!scope || typeof id !== "string") return false;
  const el = document.getElementById(id);
  return el && scope.contains(el) ? focusEl(el) : false;
}

/**
 * Like recallFocus, for screens whose content arrives after mount (Search discovery rows): if this history entry
 * remembers a focused id, wait up to `timeoutMs` for it to appear and focus it. Returns a cleanup function.
 * `fallback` runs immediately when nothing is remembered (or once the wait gives up and focus is still on <body>).
 */
export function recallFocusWhenReady(scope: HTMLElement | null, fallback: () => void, timeoutMs = 4000) {
  const id = (history.state as Record<string, unknown> | null)?.[FOCUS_MEMORY_KEY];
  if (!scope || typeof id !== "string") { fallback(); return () => undefined; }
  if (recallFocus(scope)) return () => undefined;
  fallback();
  let done = false;
  const stop = () => { done = true; mo.disconnect(); clearTimeout(t); };
  const mo = new MutationObserver(() => {
    if (done) return;
    const el = document.getElementById(id);
    // only take over while the user has not moved on from the fallback
    if (el && scope.contains(el)) { stop(); if (!userMoved) focusEl(el); }
  });
  let userMoved = false;
  const onKey = () => { userMoved = true; };
  window.addEventListener("keydown", onKey, { once: true, capture: true });
  mo.observe(scope, { childList: true, subtree: true });
  const t = setTimeout(stop, timeoutMs);
  return () => { stop(); window.removeEventListener("keydown", onKey, true); };
}
