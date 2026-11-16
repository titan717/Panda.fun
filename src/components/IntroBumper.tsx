import { useEffect, useRef, useState } from "react";
import { reducedMotionNow } from "../lib/intro/motion";

/**
 * v1.4.2 IntroBumper: the approved 4 s Panda.fun canvas bumper (panda-intro-canvas.html, ported in
 * lib/intro/bumperFrame.ts) with its synthesised score (lib/intro/bumperScore.ts). Used as the launch intro on phones
 * and TVs (components/Intro.tsx) and as the pre-movie bumper (components/PreMovieBumper.tsx).
 *
 * - The renderer, the logo and the score are fetched with a dynamic import: none of it is in the main bundle.
 * - Own clock: requestAnimationFrame against a start timestamp taken at mount (so picture, sound and the timeout share
 *   one time base, and a slow chunk load skips the start instead of pushing the end out). DPR capped at 2, resizes.
 * - `onDone` is called exactly once: at the natural end (4.0 s, the frame is black by then), at the hold end in still
 *   mode, or by the hard 4.2 s timeout, whichever comes first, even if rAF stalls, the logo fails or anything throws.
 * - Reduced motion (system, Settings, or `still`): the final logo frame is drawn once, no rAF loop, no sound; it
 *   holds for `holdMs` and then ends.
 * - Unmount cancels the rAF, timers, the resize listener and closes the AudioContext.
 */
export const BUMPER_DURATION_MS = 4000;
export const BUMPER_HARD_MS = 4200;
export const BUMPER_HOLD_MS = 1200;

export interface IntroBumperProps {
  /** Called once when the bumper is over (natural end, hold end or the hard timeout). */
  onDone: () => void;
  /** Called (at most once) when the renderer could not run: chunk load failed, no 2D canvas, a draw threw. */
  onError?: (e: unknown) => void;
  /** Force the static final frame. Default: reduced motion from the system or Settings. */
  still?: boolean;
  /** Still mode: how long the final frame stays (ms). */
  holdMs?: number;
  /** Play the score (it still follows the sound-off setting, volume and autoplay rules). Default true. */
  sound?: boolean;
  className?: string;
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export function IntroBumper({ onDone, onError, still, holdMs = BUMPER_HOLD_MS, sound = true, className }: IntroBumperProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // one start time for the whole mount (StrictMode re-runs the effect; the clock must not restart)
  const [t0] = useState(now);
  const [isStill] = useState(() => still ?? reducedMotionNow());
  const [drawn, setDrawn] = useState(false);
  const cbs = useRef({ onDone, onError });
  cbs.current = { onDone, onError };
  const finished = useRef(false);
  const failed = useRef(false);

  useEffect(() => {
    let alive = true;
    let raf = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let stopScore: (() => void) | null = null;
    let onResize: (() => void) | null = null;
    const done = () => {
      if (finished.current) return;
      finished.current = true;
      try { cbs.current.onDone(); } catch { /* the caller must still be released */ }
    };
    const fail = (e: unknown) => {
      if (failed.current || !alive) return;
      failed.current = true;
      if (raf) { try { cancelAnimationFrame(raf); } catch { /* ignore */ } raf = 0; }
      try { cbs.current.onError?.(e); } catch { /* ignore */ }
    };
    const elapsedMs = () => now() - t0;
    // hard timeout from the shared start time: nothing below can keep the bumper up longer
    timers.push(setTimeout(done, Math.max(0, BUMPER_HARD_MS - elapsedMs())));
    if (isStill) timers.push(setTimeout(done, Math.max(0, holdMs - elapsedMs())));

    void (async () => {
      try {
        const mod = await import("../lib/intro/bumperFrame");
        if (!alive) return;
        const logo = await mod.loadBumperLogo();
        if (!alive) return;
        const el = canvas.current;
        if (!el) return;
        // without the logo there is nothing to reveal: let the caller show its fallback (the timeout still runs)
        if (!logo) { fail(new Error("bumper logo failed to load")); return; }
        const r = mod.createBumperRenderer(el, logo);
        onResize = () => { try { r.resize(); if (isStill) r.draw(mod.BUMPER_FINAL_T); } catch (e) { fail(e); } };
        window.addEventListener("resize", onResize);
        if (isStill) { r.draw(mod.BUMPER_FINAL_T); setDrawn(true); return; }
        const loop = () => {
          raf = 0;
          if (!alive || finished.current) return;
          const t = elapsedMs() / 1000;
          try { r.draw(t); } catch (e) { fail(e); return; }
          if (t >= mod.BUMPER_DUR) { done(); return; }
          raf = requestAnimationFrame(loop);
        };
        loop();
        setDrawn(true);
      } catch (e) { fail(e); }
    })();

    if (sound && !isStill) {
      void import("../lib/intro/bumperScore")
        .then((s) => s.startBumperScore(() => elapsedMs() / 1000))
        .then((h) => { if (!h) return; if (alive && !finished.current) stopScore = () => h.stop(); else h.stop(); })
        .catch(() => undefined);
    }

    return () => {
      alive = false;
      if (raf) { try { cancelAnimationFrame(raf); } catch { /* ignore */ } }
      for (const t of timers) clearTimeout(t);
      if (onResize) window.removeEventListener("resize", onResize);
      try { stopScore?.(); } catch { /* ignore */ }
    };
  }, [t0, isStill, holdMs, sound]);

  return (
    <div className={`bumper${className ? ` ${className}` : ""}`} data-bumper data-still={isStill ? "true" : "false"} data-drawn={drawn ? "true" : "false"} aria-hidden="true">
      <canvas ref={canvas} className="bumper-canvas" />
    </div>
  );
}

export default IntroBumper;
