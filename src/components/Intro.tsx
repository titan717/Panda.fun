import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "../lib/hooks";
import { getIntroPhase, setIntroPhase, type IntroPhase } from "../lib/launch";
import { introDue, markIntroSeen, planIntro, type IntroPlan, type IntroView } from "../lib/intro";
import { navKey } from "../lib/keys";
import { BRAND } from "../lib/brand";
import "../styles/intro.css";

/**
 * v1.4.0 launch intro, driven by the Intro Manager (lib/intro). One overlay plays whatever the config names for the
 * platform: the TV video, the built-in mascot animation (phones until a portrait video lands) or the branded still
 * (reduced motion, or the fallback when a video is missing, corrupt or will not start).
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
    else at(plan.durationMs, () => fns.current.leave());
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

  useEffect(() => { if (canSkip && tv) skipBtn.current?.focus({ preventScroll: true }); }, [canSkip, tv]);

  const cls = `intro intro--${tv ? "tv" : "m"} intro--${view}${phase === "leave" ? " is-leaving" : ""}`;
  return (
    <div className={cls} role="dialog" aria-modal="true" aria-label={`${BRAND.name} is starting`} data-intro data-view={view} style={{ ["--leave" as string]: `${plan.leaveMs}ms` }}>
      {view === "video" && plan.src && (
        <video ref={video} className={`intro-video intro-video--${plan.fit}`} src={plan.src} muted playsInline autoPlay preload="auto" disablePictureInPicture aria-hidden="true"
          onPlaying={() => { started.current = true; }} onEnded={() => fns.current.leave()} onError={() => fns.current.fallback()} />
      )}
      {view === "animation" && <MascotAnimation />}
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
  const end = useCallback(() => { try { markIntroSeen(); } catch { /* ignore */ } setIntroPhase("done"); setDone(true); }, []);
  return { plan: done ? null : plan, tv: frozenTv, end };
}

/** App-level launch intro: plays once per intro version per device, then never again on rerender or navigation. */
export function LaunchIntro({ tv }: { tv: boolean }) {
  const intro = useLaunchIntro(tv);
  if (!intro.plan) return null;
  return <IntroBoundary onError={intro.end}><IntroOverlay plan={intro.plan} tv={intro.tv} onDone={intro.end} /></IntroBoundary>;
}
