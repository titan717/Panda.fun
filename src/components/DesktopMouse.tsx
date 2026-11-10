import "./desktop-mouse.css";
import { useEffect, useRef, useState } from "react";
import { getNextFocus } from "@bbc/tv-lrud-spatial";
import { Icon } from "./Icon";
import { focusEl, focusFirst, tvNavigation } from "../lib/focus";

/**
 * v1.2.8 desktop mouse, loaded only where a fine pointer can hover (finePointer() in lib/device), so phones and
 * TVs never download it.
 *
 * Wheel: on focus-driven TV pages (Home, Details, My Space) the wheel steps focus one row at a time, like Up/Down
 * on the remote, so the page never scrolls out of step with the focused title. Pages and panels that scroll on
 * their own (Settings, Search, episode lists, sheets) keep native wheel scrolling.
 *
 * Paddles: rows only scroll with the D-pad, so a mouse could not reach cards past the right edge.
 * When a fine pointer rests on a horizontal row that overflows, two edge paddles appear over it (one per side
 * that can scroll) and page the row by most of its width. They are pointer-only: never focusable, never shown on
 * TVs, phones or touch screens, and the remote and keyboard keep their spatial navigation unchanged.
 */
const ROWS = "[data-scroll-x], .m-row-track";

interface Box { left: number; top: number; width: number; height: number; canLeft: boolean; canRight: boolean }

const WHEEL_STEP = 60, WHEEL_GAP = 220;
let wheelAcc = 0, wheelAt = 0;

/** The nearest ancestor of `el` (up to `stop`) that scrolls vertically by itself, else null (focus-driven page). */
export function nativeScroller(el: HTMLElement | null, stop: HTMLElement | null): HTMLElement | null {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.dataset.scrollY === "row") return null;
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 1) return n;
    if (n === stop) break;
  }
  return null;
}

export function onWheel(e: WheelEvent) {
  const nav = tvNavigation();
  if (!nav.enabled || e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
  const t = e.target as HTMLElement | null;
  const page = t?.closest<HTMLElement>(".tv-page");
  if (!page || nativeScroller(t, page)) return;
  e.preventDefault();
  const now = performance.now();
  if (now - wheelAt > 400) wheelAcc = 0;
  wheelAcc += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
  if (Math.abs(wheelAcc) < WHEEL_STEP || now - wheelAt < WHEEL_GAP) return;
  const down = wheelAcc > 0;
  wheelAcc = 0; wheelAt = now;
  const active = document.activeElement as HTMLElement | null;
  const scope = nav.scope ?? page;
  if (!active || active === document.body || !scope.contains(active) || active.closest("nav.rail")) { focusFirst(page); return; }
  const next = getNextFocus(active, down ? 40 : 38, scope);
  if (next && !next.closest("[inert]")) focusEl(next);
}

export function DesktopMouse() {
  useEffect(() => {
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);
  return <RowPaddles />;
}

/** Where the paddles sit for `row`, or null when it does not overflow. */
export function paddleBox(row: HTMLElement): Box | null {
  const max = row.scrollWidth - row.clientWidth;
  if (max <= 4) return null;
  const r = row.getBoundingClientRect();
  if (r.height < 40 || r.bottom < 0 || r.top > window.innerHeight) return null;
  return { left: r.left, top: r.top, width: r.width, height: r.height, canLeft: row.scrollLeft > 4, canRight: row.scrollLeft < max - 4 };
}

/** Page `row` one step left (-1) or right (+1): 85 % of the visible width, so one card stays in view for context. */
export function pageRow(row: HTMLElement, dir: -1 | 1) {
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  row.scrollBy({ left: dir * Math.max(200, row.clientWidth * 0.85), behavior: smooth ? "smooth" : "auto" });
}

export function RowPaddles() {
  const rowRef = useRef<HTMLElement | null>(null);
  const [box, setBox] = useState<Box | null>(null);

  useEffect(() => {
    let raf = 0;
    const measure = () => { raf = 0; const row = rowRef.current; setBox(row && document.contains(row) ? paddleBox(row) : null); };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure); };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const t = e.target as HTMLElement | null;
      if (t?.closest(".row-paddle")) return;
      const row = t?.closest<HTMLElement>(ROWS) ?? null;
      if (row !== rowRef.current) { rowRef.current = row; schedule(); }
    };
    const onLeave = () => { rowRef.current = null; schedule(); };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", schedule);
    // rows and pages scroll (by paddle, D-pad or wheel): keep the paddles on their row and their arrows current
    document.addEventListener("scroll", schedule, { capture: true, passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("scroll", schedule, { capture: true });
    };
  }, []);

  if (!box) return null;
  const go = (dir: -1 | 1) => { const row = rowRef.current; if (row) pageRow(row, dir); };
  const style = (side: "left" | "right") => ({
    top: box.top, height: box.height,
    left: side === "left" ? Math.max(0, box.left) : undefined,
    right: side === "right" ? Math.max(0, window.innerWidth - box.left - box.width) : undefined,
  });
  return (
    <>
      {box.canLeft && <button type="button" className="row-paddle row-paddle--left" style={style("left")} tabIndex={-1} aria-label="Scroll row left" onClick={() => go(-1)}><Icon name="chevronLeft" /></button>}
      {box.canRight && <button type="button" className="row-paddle row-paddle--right" style={style("right")} tabIndex={-1} aria-label="Scroll row right" onClick={() => go(1)}><Icon name="chevronRight" /></button>}
    </>
  );
}
