import { useEffect, useState } from "react";
import "../styles/intro-tv.css";

/**
 * v1.3.1 TV launch intro (D-181): the approved retro stop-motion paper-cutout film, ported to React/SVG.
 *
 * Eyes in the dark (glowing blue #36b3ff, gold lens rings, a blue anamorphic streak), a blink, an iris-in while the
 * paper panda pops together piece by piece (cartoon outline, headphones, tinted shades with a glint, a lopsided smirk,
 * a bamboo stick), a stepped zoom into the left eye, then a fade to black onto the Who's watching? horizon.
 *
 * Everything is drawn from one pure function of the frame number at 12 fps ("on twos"), so the motion steps like
 * stop-motion and tests can check any frame. Look details: boiling edges (a displacement filter whose seed changes
 * every frame, in the same filter pass as the paper shadows), film grain (a generated noise tile that jumps each frame,
 * compositor-only), scratches, a corner cue mark and the iris. Lite mode drops the boil, the paper shadows, the grain
 * and the warm tint, and so does a TV that keeps dropping drawings (see useFrame). Reduced motion shows the
 * assembled panda as one still frame. No crimson anywhere: blue eyes, warm paper, greens, ink and gold.
 */

import { EYE_L, frameMs, frameOf, PIECES, RETRO, ZOOM_MAX, type PieceId } from "../lib/introTimeline";

export { EYE_L, FPS, frameMs, frameOf, PIECES, POPS, RETRO, ZOOM_MAX, type PieceId } from "../lib/introTimeline";

/** Deterministic noise in [0, 1) (the same frame always draws the same). */
export const rnd = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const cl = (v: number) => Math.max(0, Math.min(1, v));
const r2 = (v: number) => Math.round(v * 100) / 100;

export interface RetroFrame {
  f: number;
  /** SVG transform per visible piece; missing = not popped in yet. */
  pieces: Partial<Record<PieceId, string>>;
  eyeL: boolean; eyeR: boolean; eyesOpacity: number;
  streak: number | null; // ry of the anamorphic streak, null = hidden
  glint: number | null; // glint scale, null = hidden
  iris: number | null; // radius of the iris opening, null = fully open
  cam: string; scale: number; shadows: boolean;
  fade: number; cue: boolean; scratches: [number, number] | null;
  boilSeed: number; grain: [number, number];
}

/** Everything on screen for frame `f`. `still` = the reduced-motion frame: the panda assembled and settled. */
export function retroFrame(f: number, still = false): RetroFrame {
  const t = frameMs(f);
  const pieces: Partial<Record<PieceId, string>> = {};
  PIECES.forEach((p, k) => {
    const n = f - frameOf(p.at);
    if (n < 0) return;
    const j = still || n >= 4 ? 0 : 4 - n; // a few frames of settling after each pop
    const jit = "jit" in p ? p.jit : 1;
    const dx = (rnd(f * 3 + k + 1) - 0.5) * 9 * j * jit;
    const dy = (rnd(f * 5 + k + 1) - 0.5) * 9 * j * jit - j * 5;
    const rot = (rnd(f * 7 + k + 1) - 0.5) * 5 * j;
    const s = 1 - 0.035 * j;
    const [cx, cy] = p.c;
    pieces[p.id] = j === 0 ? "" : `translate(${r2(cx + dx)} ${r2(cy + dy)}) rotate(${r2(rot)}) scale(${r2(s)}) translate(${-cx} ${-cy})`;
  });
  const blink = !still && t >= RETRO.blink && t < RETRO.blinkEnd;
  const eyeL = still || (t >= RETRO.eyeL && !blink);
  const eyeR = still || (t >= RETRO.eyeR && !blink);
  const eyesOpacity = still ? 1 : t < RETRO.eyeL ? 0 : t < RETRO.zoom ? r2(0.7 + rnd(f * 17) * 0.3) : 1;
  const streak = !still && eyeL && t < RETRO.zoom - 100 ? r2(3 + rnd(f * 5) * 4 + (t < RETRO.eyeL + 600 ? ((t - RETRO.eyeL) / 1000) * 40 : 0)) : null;
  const glint = !still && t >= RETRO.glint && t < RETRO.glintEnd ? r2(0.6 + rnd(f) * 0.8) : null;
  const ik = still ? 1 : cl((t - RETRO.assemble) / RETRO.iris);
  const iris = ik >= 1 ? null : 230 + (Math.round(ik * 8) / 8) * 1100;
  const z = still ? 0 : cl((t - RETRO.zoom) / (RETRO.inside - RETRO.zoom));
  const scale = Math.exp(Math.log(ZOOM_MAX) * z ** 1.6);
  const cx = 800 + (EYE_L[0] - 800) * z, cy = 450 + (EYE_L[1] - 450) * z;
  const cam = z === 0 ? "" : `translate(800 450) scale(${scale.toFixed(3)}) translate(${r2(-cx)} ${r2(-cy)})`;
  const fade = still ? 0 : Math.round(cl((t - RETRO.fade) / RETRO.fadeLen) * 6) / 6;
  const c0 = frameOf(RETRO.inside);
  const cue = !still && ((f >= 4 && f <= 6) || (f >= c0 && f <= c0 + 2));
  const scratches: [number, number] | null = !still && rnd(f * 11) > 0.72 ? [Math.round(rnd(f) * 1600), Math.round(rnd(f + 9) * 1600)] : null;
  return {
    f, pieces, eyeL, eyeR, eyesOpacity, streak, glint, iris, cam, scale,
    // paper shadows stop once the camera is deep in the zoom (invisible against the eye by then, and one filter
    // step less for the most expensive frames)
    shadows: scale <= 3,
    fade, cue, scratches,
    boilSeed: still ? 1 : 1 + (f % 6),
    grain: still ? [0, 0] : [Math.round(rnd(f * 13) * 160) - 80, Math.round(rnd(f * 19) * 160) - 80],
  };
}

/** The reduced-motion still: the panda assembled, eyes open, just before the zoom. */
export const STILL_FRAME = frameOf(RETRO.zoom) - 1;

/** A small grey noise tile for the film grain (made once; null where canvas is unavailable). */
function makeGrain(): string | null {
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 160;
    const g = c.getContext("2d");
    if (!g) return null;
    const img = g.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.floor(Math.random() * 256); img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    return c.toDataURL("image/png");
  } catch { return null; }
}

/** Dropped drawings (frames skipped because the device fell behind) before the film switches to lite effects. */
export const SLOW_AFTER = 4;
/** Drops in the first half second are not counted: the app boots underneath then and the main thread is busy. */
export const SLOW_FROM = 6;

/** Feed it every frame the clock reaches; it returns true once the renderer has fallen behind for good. */
export function dropTracker() {
  let prev = 0, dropped = 0;
  return (next: number) => {
    if (next > prev + 1 && prev >= SLOW_FROM) dropped += next - prev - 1;
    if (next > prev) prev = next;
    return dropped >= SLOW_AFTER;
  };
}

/**
 * Steps the frame at 12 fps from the first paint until the film ends. Reduced motion: one still frame.
 * The timeline never waits for the renderer: a late frame jumps straight to the right drawing. If a TV keeps
 * dropping drawings (SLOW_AFTER in total after the first SLOW_FROM frames), `slow` turns on and the film continues with lite effects.
 */
function useFrame(still: boolean, from?: number) {
  const [f, setF] = useState(still ? STILL_FRAME : 0);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (still) return;
    const start = from ?? performance.now(); // the overlay's start, so a late chunk joins on the right frame
    const last = frameOf(RETRO.done);
    const behind = dropTracker();
    let raf = 0;
    const tick = (now: number) => {
      const next = Math.min(last, frameOf(now - start));
      if (behind(next)) setSlow(true);
      setF((cur) => (cur === next ? cur : next));
      if (next < last) raf = requestAnimationFrame(tick);
    };
    try { raf = requestAnimationFrame(tick); } catch { /* no rAF: the first frame stays, the timeline still ends the intro */ }
    return () => { try { cancelAnimationFrame(raf); } catch { /* ignore */ } };
  }, [still, from]);
  return { f, slow };
}

const STALKS = [[210, 60, 46, 780], [1330, 40, 52, 800], [1430, 120, 40, 720]] as const;
const HEAD_ARC = "M560 335 Q800 135 1040 335";

/** The film itself (the overlay, input block, score and timeline live in Intro.tsx). */
export function RetroIntro({ reduce, lite, start }: { reduce: boolean; lite: boolean; start?: number }) {
  const { f, slow } = useFrame(reduce, start);
  const fr = retroFrame(f, reduce);
  const fx = !lite && !slow; // the heavier effects: boil, paper shadow, grain, warm tint
  const [grain] = useState(() => (lite ? null : makeGrain()));
  const p = fr.pieces;
  const tf = (id: PieceId) => (p[id] ? { transform: p[id] } : {});
  const shown = (id: PieceId) => p[id] !== undefined;
  const irisD = fr.iris === null ? null : `M0 0H1600V900H0Z M${800 - fr.iris} 430a${fr.iris} ${fr.iris} 0 1 0 ${2 * fr.iris} 0a${fr.iris} ${fr.iris} 0 1 0 ${-2 * fr.iris} 0Z`;
  return (
    <div className={`intro-retro${fx ? "" : " intro-retro--lite"}`} aria-hidden="true" data-frame={f} data-slow={slow || undefined}>
      <svg className="intro-retro-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          {/* one filter pass for both effects (boiling edges, then the paper shadow of the boiled cut-outs): a single
              off-screen buffer the size of the screen, in screen space, so the zoom never enlarges it */}
          {fx && (
            <filter id="pf-boil" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves={2} seed={fr.boilSeed} result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G" result="boiled" />
              {fr.shadows && <feDropShadow id="pf-paper" in="boiled" dx="7" dy="11" stdDeviation="3.5" floodColor="#000" floodOpacity=".5" />}
            </filter>
          )}
          <linearGradient id="pf-streak"><stop offset="0" stopColor="#2f9bff" stopOpacity="0" /><stop offset=".5" stopColor="#d9f1ff" stopOpacity=".95" /><stop offset="1" stopColor="#2f9bff" stopOpacity="0" /></linearGradient>
          <radialGradient id="pf-glow"><stop offset="0" stopColor="#36b3ff" stopOpacity=".6" /><stop offset="1" stopColor="#36b3ff" stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="1600" height="900" fill="#191817" />
        <g filter={fx ? "url(#pf-boil)" : undefined} data-boil={fx ? fr.boilSeed : undefined}>
          <g transform={fr.cam || undefined} data-cam>
            <g>
              {shown("disc") && <circle cx="800" cy="450" r="400" fill="#7c9365" {...tf("disc")} data-piece="disc" />}
              <g fill="#6a8256">
                {STALKS.map(([x, y, w, h], i) => {
                  const id = `stalk${i}` as PieceId;
                  return shown(id) ? <rect key={id} x={x} y={y} width={w} height={h} rx="8" {...tf(id)} data-piece={id} /> : null;
                })}
              </g>
              {shown("earL") && <g {...tf("earL")} data-piece="earL"><circle cx="590" cy="240" r="96" fill="#101010" /><circle cx="594" cy="246" r="48" fill="#46413c" /></g>}
              {shown("earR") && <g {...tf("earR")} data-piece="earR"><circle cx="1010" cy="240" r="96" fill="#101010" /><circle cx="1006" cy="246" r="48" fill="#46413c" /></g>}
              {shown("head") && <ellipse cx="800" cy="460" rx="292" ry="242" fill="#f1e9d8" stroke="#101010" strokeWidth="11" {...tf("head")} data-piece="head" />}
              {shown("shine") && <path d="M590 340 Q615 280 700 252" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="13" strokeLinecap="round" {...tf("shine")} data-piece="shine" />}
              {shown("phones") && (
                <g {...tf("phones")} data-piece="phones">
                  <path d={HEAD_ARC} fill="none" stroke="#101010" strokeWidth="24" strokeLinecap="round" />
                  <path d={HEAD_ARC} fill="none" stroke="#36b3ff" strokeWidth="5" strokeLinecap="round" />
                  <ellipse cx="548" cy="340" rx="40" ry="68" fill="#1d1b1a" stroke="#101010" strokeWidth="9" />
                  <ellipse cx="548" cy="340" rx="22" ry="46" fill="none" stroke="#36b3ff" strokeWidth="5" />
                  <ellipse cx="1052" cy="340" rx="40" ry="68" fill="#1d1b1a" stroke="#101010" strokeWidth="9" />
                  <ellipse cx="1052" cy="340" rx="22" ry="46" fill="none" stroke="#36b3ff" strokeWidth="5" />
                </g>
              )}
              {shown("patchL") && <g {...tf("patchL")} data-piece="patchL"><ellipse cx="690" cy="425" rx="92" ry="114" transform="rotate(32 690 425)" fill="#101010" /></g>}
              {shown("patchR") && <g {...tf("patchR")} data-piece="patchR"><ellipse cx="910" cy="425" rx="92" ry="114" transform="rotate(-32 910 425)" fill="#101010" /></g>}
              {shown("brows") && <g fill="none" stroke="#101010" strokeWidth="18" strokeLinecap="round" {...tf("brows")} data-piece="brows"><path d="M595 292 L770 312" /><path d="M845 285 Q925 222 1008 268" /></g>}
              {shown("nose") && <ellipse cx="800" cy="540" rx="52" ry="34" fill="#101010" {...tf("nose")} data-piece="nose" />}
              {/* the lopsided smirk: lower on the left, hooked up on the right */}
              {shown("mouth") && <path d="M722 596 Q780 640 842 604 Q876 590 890 562" fill="none" stroke="#101010" strokeWidth="11" strokeLinecap="round" {...tf("mouth")} data-piece="mouth" />}
              {shown("bamboo") && (
                <g strokeLinecap="round" {...tf("bamboo")} data-piece="bamboo">
                  <line x1="872" y1="590" x2="1000" y2="540" stroke="#7c9365" strokeWidth="15" />
                  <line x1="872" y1="590" x2="1000" y2="540" stroke="#3e5232" strokeWidth="15" strokeDasharray="3 42" />
                </g>
              )}
              <g opacity={fr.eyesOpacity} data-eyes>
                {fr.streak !== null && <ellipse cx="800" cy="420" rx="760" ry={fr.streak} fill="url(#pf-streak)" data-streak />}
                {([["L", 690, fr.eyeL], ["R", 910, fr.eyeR]] as const).map(([s, x, on]) => on && (
                  <g key={s} data-eye={s}>
                    <circle cx={x} cy="420" r="95" fill="url(#pf-glow)" />
                    <circle cx={x} cy="420" r="31" fill="none" stroke="#d6b477" strokeWidth="4" data-ring />
                    <circle cx={x} cy="420" r="25" fill="#36b3ff" />
                    <circle cx={x - 9} cy="410" r="8" fill="#fff" />
                  </g>
                ))}
              </g>
              {shown("shades") && (
                <g {...tf("shades")} data-piece="shades">
                  <rect x="596" y="366" width="190" height="122" rx="48" transform="rotate(-5 691 427)" fill="#0a2a52" fillOpacity=".5" stroke="#101010" strokeWidth="14" />
                  <rect x="814" y="366" width="190" height="122" rx="48" transform="rotate(5 909 427)" fill="#0a2a52" fillOpacity=".5" stroke="#101010" strokeWidth="14" />
                  <path d="M786 392 L814 392" stroke="#101010" strokeWidth="14" strokeLinecap="round" />
                  <path d="M628 470 L672 384 M656 474 L690 408 M846 470 L890 384 M874 474 L908 408" stroke="#fff" strokeOpacity=".5" strokeWidth="9" strokeLinecap="round" />
                </g>
              )}
              {fr.glint !== null && <path d="M0 -52 L10 -10 L52 0 L10 10 L0 52 L-10 10 L-52 0 L-10 -10Z" transform={`translate(632 386) scale(${fr.glint})`} fill="#fff" data-glint />}
            </g>
          </g>
        </g>
        {irisD && <path d={irisD} fill="#000" fillRule="evenodd" data-iris />}
        <rect width="1600" height="900" fill="#000" opacity={fr.fade} data-fade />
        {fr.cue && <circle cx="1480" cy="86" r="24" fill="none" stroke="#f1e9d8" strokeWidth="5" data-cue />}
        {fr.scratches && (
          <g stroke="#f1e9d8" strokeWidth="2" opacity=".3" data-scratches>
            <line x1={fr.scratches[0]} x2={fr.scratches[0] + Math.round((rnd(f) - 0.5) * 20)} y1="0" y2="900" />
            <line x1={fr.scratches[1]} x2={fr.scratches[1] + Math.round((rnd(f) - 0.5) * 20)} y1="0" y2="900" />
          </g>
        )}
      </svg>
      {fx && <div className="intro-retro-tint" />}
      <div className="intro-retro-vig" />
      {fx && <div className="intro-retro-grain" data-grain style={{ backgroundImage: grain ? `url(${grain})` : undefined, transform: `translate3d(${fr.grain[0]}px, ${fr.grain[1]}px, 0)` }} />}
    </div>
  );
}
