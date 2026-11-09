import { useEffect, useRef, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { navKey } from "../lib/keys";
import { holdDelay } from "../lib/captions";

/** A button that repeats while it is held, with the finger, the mouse, OK on the remote or Enter (v1.2.7 timing and height). */
export function HoldButton({ id, label, sub, icon, onStep, disabled, className }: { id: string; label: string; sub?: string; icon?: React.ReactNode; onStep: () => void; disabled?: boolean; className?: string }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const n = useRef(0);
  const step = useRef(onStep);
  step.current = onStep;
  const stop = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; n.current = 0; };
  useEffect(() => stop, []);
  const run = () => { step.current(); timer.current = setTimeout(() => { n.current++; run(); }, holdDelay(n.current)); };
  return (
    <button id={id} type="button" className={className ?? "so-hold"} disabled={disabled} data-hover-focus
      onPointerDown={(e: RPointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const el = e.currentTarget as HTMLElement;
        el.focus();
        // captured, so a re-render or the chrome fading under the finger never ends the hold early
        try { el.setPointerCapture(e.pointerId); } catch { /* not capturable (synthetic event) */ }
        stop(); run();
      }}
      onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onBlur={stop}
      onKeyDown={(e: RKeyboardEvent) => { if (navKey(e.nativeEvent) === "enter" || e.key === " ") { e.preventDefault(); step.current(); } }}
      onKeyUp={(e: RKeyboardEvent) => { if (e.key === " ") e.preventDefault(); }}
      onClick={(e) => { e.preventDefault(); }}>
      {icon}<strong>{label}</strong>{sub && <small>{sub}</small>}
    </button>
  );
}

