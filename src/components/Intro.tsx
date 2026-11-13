import { Component, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLiteMotion, useReducedMotion } from "../lib/hooks";
import { getIntroPhase, introDone, introPending, setIntroPhase, type IntroPhase } from "../lib/launch";
import { getMutedMemory, isAudioUnlocked } from "../lib/audio";
import { getPrefs } from "../lib/store";
import "../styles/intro.css";

/**
 * v1.3.0 launch intro (D-177). No text: two crimson eyes open and blink in the dark, an ivory/charcoal panda face
 * forms around them, the camera dives through the eyes into a burst of brand light ribbons, and the ribbons collapse
 * into the horizon line that Who's watching? sits on, so the handoff is seamless.
 *
 * It cannot be skipped. While it is on screen every key, pointer, touch and wheel event is caught on window in the
 * capture phase and dropped, so nothing reaches (or moves focus in) the app that renders underneath the whole time.
 * Only the timeline ends it, and a hard timeout ends it even if animation, audio or rendering fails.
 * The score is synthesised with Web Audio in a lazy chunk (lib/introScore.ts), and only when audio is unlocked.
 */

/** Beat times in ms from the first frame. Phone = the same beats compressed to 2.4 s. */
export interface IntroBeats { eyes: number; blink: number; face: number; zoom: number; burst: number; horizon: number; leave: number; done: number; hard: number }
export const BEATS: Record<"tv" | "m" | "stillTv" | "stillM", IntroBeats> = {
  tv: { eyes: 400, blink: 1000, face: 1500, zoom: 2000, burst: 2600, horizon: 3000, leave: 3400, done: 3600, hard: 4200 },
  m: { eyes: 200, blink: 600, face: 900, zoom: 1150, burst: 1500, horizon: 1850, leave: 2200, done: 2400, hard: 3000 },
  // reduced motion: a 0.6 s still frame (eyes + panda), a soft tone, then a fade. Still not skippable.
  stillTv: { eyes: 0, blink: 0, face: 0, zoom: 0, burst: 0, horizon: 0, leave: 600, done: 850, hard: 4200 },
  stillM: { eyes: 0, blink: 0, face: 0, zoom: 0, burst: 0, horizon: 0, leave: 600, done: 850, hard: 3000 },
};
export const beatsFor = (tv: boolean, reduce: boolean) => BEATS[reduce ? (tv ? "stillTv" : "stillM") : tv ? "tv" : "m"];

/** Every input the intro swallows (phone-remote keys arrive as key events too; remote text is ignored in remote.ts). */
export const BLOCKED_EVENTS = ["keydown", "keyup", "keypress", "pointerdown", "pointerup", "pointermove", "mousedown", "mouseup", "click", "dblclick", "auxclick", "contextmenu", "touchstart", "touchmove", "touchend", "wheel"] as const;

/**
 * The intro's clock: the fade at `leave`, the end at `done`, and an independent hard timeout that ends it if anything
 * on the way failed (a throwing callback, a stalled timer queue, a broken animation). Exported for tests.
 */
export function scheduleIntro(b: IntroBeats, leave: () => void, done: () => void) {
  let ended = false;
  const finish = () => {
    if (ended) return;
    try { done(); ended = true; } catch { /* the hard timeout tries again */ }
  };
  const a = setTimeout(() => { try { leave(); } catch { finish(); } }, b.leave);
  const c = setTimeout(finish, b.done);
  const hard = setTimeout(() => { finish(); ended = true; }, b.hard);
  return () => { clearTimeout(a); clearTimeout(c); clearTimeout(hard); };
}

export function useIntro(tv: boolean) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<IntroPhase>(() => {
    const p: IntroPhase = introPending() ? "show" : "done";
    setIntroPhase(p); // before the first render of Who's watching, which waits for the handoff
    return p;
  });
  // the timeline is fixed at the first frame; a layout or preference change mid-intro never restarts it
  const beats = useRef(beatsFor(tv, reduce)).current;
  const still = useRef(reduce).current;
  const frozenTv = useRef(tv).current;
  useEffect(() => {
    if (phase === "done") return;
    setIntroPhase("show"); // again after a StrictMode remount
    const cancel = scheduleIntro(beats, () => { setPhase((p) => (p === "show" ? "leave" : p)); setIntroPhase("leave"); }, () => {
      setPhase("done"); // first: removing the overlay is the one thing that must happen
      try { introDone(); } catch { /* storage unavailable: the intro may replay on reload */ }
      setIntroPhase("done");
    });
    return () => { cancel(); if (getIntroPhase() !== "done") setIntroPhase("done"); };
    // mount-only: the intro runs once per fresh start
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { phase, tv: frozenTv, reduce: still, beats, end: () => { try { introDone(); } catch { /* ignore */ } setIntroPhase("done"); setPhase("done"); } };
}

/** Swallows every input while mounted. Exported for tests. */
export function useInputBlock() {
  useEffect(() => {
    const block = (e: Event) => {
      try { if (e.cancelable) e.preventDefault(); e.stopImmediatePropagation(); } catch { /* never throw from an input handler */ }
    };
    const opts = { capture: true, passive: false } as const;
    try { for (const t of BLOCKED_EVENTS) window.addEventListener(t, block, opts); } catch { /* ignore */ }
    return () => { try { for (const t of BLOCKED_EVENTS) window.removeEventListener(t, block, opts); } catch { /* ignore */ } };
  }, []);
}

/** Starts the synthesised score when sound is allowed: audio unlocked, not muted, volume above zero. */
export function introSoundAllowed() {
  try {
    if (!isAudioUnlocked() || getMutedMemory()) return 0;
    const v = Number(getPrefs().volume);
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
  } catch { return 0; }
}

function useScore(tv: boolean, reduce: boolean, beats: IntroBeats) {
  useEffect(() => {
    const start = performance.now();
    const volume = introSoundAllowed();
    if (volume <= 0) return; // locked or muted: the visuals run in full, silently
    let stop: (() => void) | null = null;
    let cancelled = false;
    import("../lib/introScore")
      .then((m) => { if (!cancelled) stop = m.playIntroScore({ beats, start, volume, still: reduce, tv }); })
      .catch(() => undefined);
    return () => { cancelled = true; try { stop?.(); } catch { /* ignore */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

const RIBBONS = ["#2b6bff", "#8c4bff", "#ff3d8b", "#39ff88", "#2bd4d6", "#8c4bff", "#2b6bff", "#ff3d8b", "#2bd4d6"];
const POS = [8, 19, 29, 38, 50, 61, 71, 82, 92];

export function Intro({ tv, phase, reduce, beats }: { tv: boolean; phase: "show" | "leave"; reduce: boolean; beats: IntroBeats }) {
  useInputBlock();
  useScore(tv, reduce, beats);
  const lite = useLiteMotion();
  const ms = (n: number) => `${n}ms`;
  const vars = {
    "--b-eyes": ms(beats.eyes), "--b-blink": ms(beats.blink), "--b-face": ms(beats.face), "--b-zoom": ms(beats.zoom),
    "--b-burst": ms(beats.burst), "--b-horizon": ms(beats.horizon), "--b-leave": ms(beats.leave),
    "--d-eyes": ms(beats.blink - beats.eyes), "--d-blink": ms(beats.face - beats.blink), "--d-face": ms(beats.zoom - beats.face),
    "--d-zoom": ms(beats.burst - beats.zoom), "--d-burst": ms(beats.horizon - beats.burst), "--d-horizon": ms(beats.leave - beats.horizon),
    "--d-leave": ms(beats.done - beats.leave),
  } as CSSProperties;
  const ribbons = lite ? RIBBONS.filter((_, i) => i % 2 === 0) : RIBBONS;
  const pos = lite ? POS.filter((_, i) => i % 2 === 0) : POS;
  const cls = `intro intro--${tv ? "tv" : "m"}${reduce ? " intro--still" : ""}${phase === "leave" ? " is-leaving" : ""}`;
  return (
    // aria-hidden content; the status role tells screen readers the app is starting
    <div className={cls} style={vars} role="status" aria-label="Panda.fun is starting" data-intro>
      <div className="intro-stage" aria-hidden="true">
        <div className="intro-zoom">
          <div className="intro-face">
            <svg viewBox="0 0 200 200" className="intro-face-svg">
              <circle cx="46" cy="50" r="27" fill="#1b1b20" />
              <circle cx="154" cy="50" r="27" fill="#1b1b20" />
              <ellipse cx="100" cy="112" rx="80" ry="74" fill="#efe9dc" />
              <ellipse cx="70" cy="104" rx="21" ry="28" transform="rotate(28 70 104)" fill="#1b1b20" />
              <ellipse cx="130" cy="104" rx="21" ry="28" transform="rotate(-28 130 104)" fill="#1b1b20" />
              <path d="M90 140 q10 -7 20 0 q-4 10 -10 11 q-6 -1 -10 -11z" fill="#1b1b20" />
              <path d="M100 151 v8 M92 162 q8 6 16 0" stroke="#1b1b20" strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div className="intro-eyes">
            <span className="intro-eye intro-eye--l"><i /></span>
            <span className="intro-eye intro-eye--r"><i /></span>
          </div>
          <span className="intro-smear" />
        </div>
      </div>
      {!reduce && (
        <div className="intro-ribbons" aria-hidden="true">
          {ribbons.map((c, i) => <i key={i} style={{ "--c": c, "--i": i, left: `${pos[i]}%` } as CSSProperties} />)}
        </div>
      )}
      {!reduce && <span className="intro-horizon" aria-hidden="true" />}
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
