import { focusFirst } from "../lib/focus";
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "../lib/hooks";
import { getIntroPhase, setIntroPhase, type IntroPhase } from "../lib/launch";
import { introDue, markIntroSeen, planIntro, type IntroPlan, type IntroView } from "../lib/intro";
import { navKey } from "../lib/keys";
import { BRAND } from "../lib/brand";
import { IntroBumper } from "./IntroBumper";
import "../styles/intro.css";

/**
 * v1.4.0 launch intro, driven by the Intro Manager (lib/intro). One overlay plays whatever the config names for the
 * platform: since v1.4.2 the canvas IntroBumper on phones and TVs (its final logo frame under reduced motion), or a
 * video, the built-in mascot animation, or the branded still (the fallback when a video or the bumper cannot run).
 *
 * Skippable: after `skipAfterMs` a Skip button appears; on TV OK/Enter and Back skip too. Until then keys are held
 * back so nothing moves underneath. A hard timeout (duration + 2 s) always ends it, whatever fails.
 */

/** A brand image that turns into text if the file is missing (assets ship separately). */
function BrandImg({ src, className, text }: { src: string; className: string; text?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return text ? <span className={`${className} intro-text`}>{text}</span> : null;
  return <img className={className} src={src} alt="" draggable={false} decoding="async" onError={() => setFailed(true)} />;
}

function StillFrame() {
  return (
    <div className="intro-still" aria-hidden="true">
      <span className="intro-glow" />
      <BrandImg className="intro-mascot" src={BRAND.mascot} />
      <BrandImg className="intro-logo" src={BRAND.wordmark} text={BRAND.name} />
    </div>
  );
}

function MascotAnimation() {
  return (
    <div className="intro-anim" aria-hidden="true">
      <span className="intro-glow" />
      <span className="intro-ring" />
      <span className="intro-ring intro-ring--2" />
      <div className="intro-turn"><BrandImg className="intro-mascot" src={BRAND.mascot} /></div>
      <BrandImg className="intro-logo" src={BRAND.wordmark} text={BRAND.name} />
      <span className="intro-spark intro-spark--a" /><span className="intro-spark intro-spark--b" /><span className="intro-spark intro-spark--c" />
    </div>
  );
}

/** The overlay for one plan. Exported for tests. */
export function IntroOverlay({ plan, tv, onDone }: { plan: IntroPlan; tv: boolean; onDone?: () => void }) {
  const [view, setView] = useState<IntroView>(plan.view);
  const [phase, setPhase] = useState<Exclude<IntroPhase, "done">>("show");
  const [canSkip, setCanSkip] = useState(false);
  const skipBtn = useRef<HTMLButtonElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const started = useRef(false);
  const ended = useRef(false);
  const leaving = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const at = (ms: number, f: () => void) => { timers.current.push(setTimeout(f, ms)); };

  const finish = useCallback(() => {
    if (ended.current) return;
    ended.current = true;
    try { markIntroSeen(plan.version); } catch { /* storage unavailable: no replay in this load anyway */ }
    setIntroPhase("done");
    try { onDone?.(); } catch { /* the overlay must always go */ }
  }, [plan.version, onDone]);
  const leave = useCallback(() => {
    if (leaving.current || ended.current) return;
    leaving.current = true;
    setPhase("leave");
    setIntroPhase("leave");
    timers.current.push(setTimeout(finish, plan.leaveMs));
  }, [finish, plan.leaveMs]);
  const isStill = useRef(plan.view === "static");
  const fallback = useCallback(() => {
    if (leaving.current || ended.current || isStill.current) return;
    isStill.current = true;
    setView("static");
    timers.current.push(setTimeout(leave, plan.staticMs));
  }, [leave, plan.staticMs]);
  const fns = useRef({ leave, fallback, finish });
  fns.current = { leave, fallback, finish };
  const canSkipRef = useRef(false);

  useEffect(() => {
    setIntroPhase("show");
    at(plan.skipAfterMs, () => { canSkipRef.current = true; setCanSkip(true); });
    if (plan.view === "video") at(plan.startTimeoutMs, () => { if (!started.current) fns.current.fallback(); });
    else if (plan.view !== "bumper") at(plan.durationMs, () => fns.current.leave()); // the bumper ends itself (onDone)
    at(plan.hardMs, () => fns.current.finish());
    // OK/Enter and Back skip once allowed; every key is held back from the app while the intro is up
    const onKey = (e: KeyboardEvent) => {
      if (ended.current) return;
      const k = navKey(e);
      if ((k === "enter" || k === "back") && canSkipRef.current) fns.current.leave();
      try { if (e.cancelable) e.preventDefault(); e.stopImmediatePropagation(); } catch { /* never throw from input */ }
    };
    window.addEventListener("keydown", onKey, true);
    const list = timers.current;
    return () => {
      window.removeEventListener("keydown", onKey, true);
      for (const t of list) clearTimeout(t);
      list.length = 0;
      if (getIntroPhase() !== "done") setIntroPhase("done");
    };
    // mount-only: one plan per cold start
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // autoplay can be refused (no gesture yet): the video is muted, but if play() still rejects, show the still
  useEffect(() => {
    const v = video.current;
    if (view !== "video" || !v) return;
    try { const p = v.play() as Promise<void> | undefined; p?.catch?.(() => fns.current.fallback()); } catch { fns.current.fallback(); }
  }, [view]);

  // TV: Skip keeps focus while the intro is up, even if the screen underneath autofocuses something as it loads
  // (the remote keys are captured above either way; this keeps the focus ring where the viewer expects it).
  useEffect(() => {
    if (!canSkip || !tv) return;
    skipBtn.current?.focus({ preventScroll: true });
    const keep = (e: FocusEvent) => {
      if (ended.current) return;
      const t = e.target as Element | null;
      if (t && !t.closest("[data-intro]")) skipBtn.current?.focus({ preventScroll: true });
    };
    document.addEventListener("focusin", keep, true);
    return () => document.removeEventListener("focusin", keep, true);
  }, [canSkip, tv]);

  const cls = `intro intro--${tv ? "tv" : "m"} intro--${view}${phase === "leave" ? " is-leaving" : ""}`;
  return (
    <div className={cls} role="dialog" aria-modal="true" aria-label={`${BRAND.name} is starting`} data-intro data-view={view} style={{ ["--leave" as string]: `${plan.leaveMs}ms` }}>
      {view === "video" && plan.src && (
        <video ref={video} className={`intro-video intro-video--${plan.fit}`} src={plan.src} muted playsInline autoPlay preload="auto" disablePictureInPicture aria-hidden="true"
          onPlaying={() => { started.current = true; }} onEnded={() => fns.current.leave()} onError={() => fns.current.fallback()} />
      )}
      {view === "animation" && <MascotAnimation />}
      {view === "bumper" && (
        // the moving bumper ends on a black frame, so it hands off at once; the still fades out like the other views
        <IntroBumper still={plan.still} holdMs={plan.durationMs} onDone={() => (plan.still ? fns.current.leave() : fns.current.finish())} onError={() => fns.current.fallback()} />
      )}
      {view === "static" && <StillFrame />}
      {canSkip && (
        <button ref={skipBtn} type="button" className="intro-skip" onClick={() => fns.current.leave()} aria-label="Skip intro" data-hover-focus>
          Skip{tv && <span className="intro-skip-hint">OK</span>}
        </button>
      )}
    </div>
  );
}

/** If the intro itself ever throws while rendering, it disappears instead of covering the app. */
export class IntroBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { try { this.props.onError(); } catch { /* ignore */ } }
  render() { return this.state.failed ? null : this.props.children; }
}

/** The plan for this cold start, fixed at the first frame (a layout or motion change mid-intro never restarts it). */
export function useLaunchIntro(tv: boolean) {
  const reduce = useReducedMotion();
  const [plan] = useState<IntroPlan | null>(() => {
    const p = introDue() ? planIntro({ tv, reduce }) : null;
    if (!p && introDue()) markIntroSeen(); // reduced motion set to "skip": counts as played
    setIntroPhase(p ? "show" : "done"); // before the first render of Who's watching / onboarding, which wait for it
    return p;
  });
  const [frozenTv] = useState(tv);
  const [done, setDone] = useState(!plan);
  const end = useCallback(() => {
    try { markIntroSeen(); } catch { /* ignore */ }
    setIntroPhase("done"); setDone(true);
    // The Skip button had focus; once the overlay is gone, hand focus to the screen underneath instead of <body>
    // (on TV a body focus would make the first D-pad press land in the side rail).
    if (frozenTv) requestAnimationFrame(() => requestAnimationFrame(() => handOffFocus()));
  }, [frozenTv]);
  return { plan: done ? null : plan, tv: frozenTv, end };
}

/** After the intro: focus the first item of the visible screen, unless something (a dialog, the picker) already has it. */
export function handOffFocus() {
  const a = document.activeElement;
  if (a && a !== document.body && a !== document.documentElement && a.isConnected) return;
  const scope = document.querySelector(".profiles, .onboarding, [role=dialog]:not([data-intro]), .tv-page, main");
  if (scope) focusFirst(scope);
}

/** App-level launch intro: plays on a cold start per INTRO.replay (lib/intro/config.ts), never on rerender or navigation. */
export function LaunchIntro({ tv }: { tv: boolean }) {
  const intro = useLaunchIntro(tv);
  if (!intro.plan) return null;
  return <IntroBoundary onError={intro.end}><IntroOverlay plan={intro.plan} tv={intro.tv} onDone={intro.end} /></IntroBoundary>;
}
