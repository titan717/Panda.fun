import { useCallback, useEffect, useRef, useState } from "react";
import { INTRO } from "../lib/intro";
import { navKey } from "../lib/keys";
import { useReducedMotion } from "../lib/hooks";
import { IntroBoundary } from "./Intro";
import { BUMPER_HARD_MS, IntroBumper } from "./IntroBumper";

/**
 * v1.4.2 pre-movie bumper: the IntroBumper over the Player while the stream loads underneath (the embed is created at
 * once, so the bumper never delays it). It ends at its own 4 s end, at the hard 4.2 s timeout, as soon as `end` turns
 * true (the Playback Fallback Controller reports real playback, or playback failed), or when skipped. A stream that
 * starts sooner than 4 s therefore cuts the bumper short rather than playing hidden underneath it.
 *
 * Skip follows the launch intro's rules (INTRO.skipAfterMs): after 1 s a Skip button appears (focused on TV) and
 * OK/Enter or Back skip; until then remote keys are held back so nothing moves underneath. Back never leaves the
 * Player while the bumper is up; it only skips it. Reduced motion: the static final logo frame for INTRO.staticMs.
 */
export function PreMovieBumper({ tv, end, onDone }: { tv: boolean; end: boolean; onDone: () => void }) {
  const reduce = useReducedMotion();
  const [still] = useState(reduce);
  const [leaving, setLeaving] = useState(false);
  const [canSkip, setCanSkip] = useState(false);
  const skipBtn = useRef<HTMLButtonElement>(null);
  const ended = useRef(false);
  const leavingRef = useRef(false);
  const canSkipRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const finish = useCallback(() => {
    if (ended.current) return;
    ended.current = true;
    try { doneRef.current(); } catch { /* the bumper must always go */ }
  }, []);
  const leave = useCallback(() => {
    if (leavingRef.current || ended.current) return;
    leavingRef.current = true;
    setLeaving(true);
    timers.current.push(setTimeout(finish, INTRO.leaveMs));
  }, [finish]);

  useEffect(() => {
    const list = timers.current;
    list.push(setTimeout(() => { canSkipRef.current = true; setCanSkip(true); }, INTRO.skipAfterMs));
    // belt and braces: IntroBumper has its own 4.2 s timeout, this one also covers a render failure
    list.push(setTimeout(finish, BUMPER_HARD_MS));
    const onKey = (e: KeyboardEvent) => {
      if (ended.current) return;
      const k = navKey(e);
      if ((k === "enter" || k === "back") && canSkipRef.current) leave();
      try { if (e.cancelable) e.preventDefault(); e.stopImmediatePropagation(); } catch { /* never throw from input */ }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      for (const t of list) clearTimeout(t);
      list.length = 0;
    };
  }, [finish, leave]);

  // the stream is ready (or failed): get out of the way at once
  useEffect(() => { if (end) leave(); }, [end, leave]);

  // TV: Skip keeps focus while the bumper is up, even if the Player autofocuses its controls underneath
  useEffect(() => {
    if (!canSkip || !tv || leaving) return;
    skipBtn.current?.focus({ preventScroll: true });
    const keep = (e: FocusEvent) => {
      if (ended.current) return;
      const t = e.target as Element | null;
      if (t && !t.closest("[data-premovie]")) skipBtn.current?.focus({ preventScroll: true });
    };
    document.addEventListener("focusin", keep, true);
    return () => document.removeEventListener("focusin", keep, true);
  }, [canSkip, tv, leaving]);

  return (
    <div className={`premovie${leaving ? " is-leaving" : ""}`} data-premovie role="dialog" aria-modal="true" aria-label="Your title is starting" style={{ ["--leave" as string]: `${INTRO.leaveMs}ms` }}>
      <IntroBoundary onError={finish}>
        <IntroBumper still={still} holdMs={INTRO.staticMs} onDone={() => (still ? leave() : finish())} onError={leave} />
      </IntroBoundary>
      {canSkip && !leaving && (
        <button ref={skipBtn} type="button" className="intro-skip" onClick={leave} aria-label="Skip" data-hover-focus>
          Skip{tv && <span className="intro-skip-hint">OK</span>}
        </button>
      )}
    </div>
  );
}
