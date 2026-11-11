import { useCallback, useEffect, useRef, useState } from "react";
import { PandaMark } from "./Icon";
import { useReducedMotion } from "../lib/hooks";
import { introDone, introPending } from "../lib/launch";
import "../styles/intro.css";

/**
 * v1.2.9 launch intros (directive §5). Both run only on a fresh start, never block input for long and can be
 * skipped with a tap, a click or any remote key.
 *  - Phone: a quick, minimal 3D turn of the panda mark through glass rings, then the wordmark (~1.1 s).
 *  - TV: a cinematic push-in: drifting light particles, a slow camera move through depth layers, a light sweep
 *    across the wordmark (~2.3 s).
 * Reduced motion shows a still mark for a moment instead. The app renders underneath the whole time, so the
 * intro hides loading rather than adding to it.
 */
const TIMING = { m: { leave: 900, done: 1200 }, tv: { leave: 2000, done: 2400 }, still: { leave: 300, done: 450 } };

export function useIntro(tv: boolean) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<"show" | "leave" | "done">(() => (introPending() ? "show" : "done"));
  const t = reduce ? TIMING.still : tv ? TIMING.tv : TIMING.m;
  useEffect(() => {
    if (phase === "done") return;
    if (phase === "leave") { const b = setTimeout(() => { introDone(); setPhase("done"); }, t.done - t.leave); return () => clearTimeout(b); }
    const a = setTimeout(() => setPhase("leave"), t.leave);
    return () => clearTimeout(a);
  }, [phase, t.leave, t.done]);
  const skip = useCallback(() => setPhase((p) => (p === "show" ? "leave" : p)), []);
  return { phase, skip, reduce };
}

export function Intro({ tv, phase, skip, reduce }: { tv: boolean; phase: "show" | "leave"; skip: () => void; reduce: boolean }) {
  // any key skips; the key is swallowed so it never moves focus in the app underneath
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { e.preventDefault(); e.stopImmediatePropagation(); skip(); };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [skip]);
  const cls = `intro intro--${tv ? "tv" : "m"} ${reduce ? "intro--still" : ""} ${phase === "leave" ? "is-leaving" : ""}`;
  return (
    <div className={cls} role="status" aria-label="Loading Panda.fun" onPointerDown={skip}>
      {tv && !reduce && <Particles />}
      <div className="intro-stage">
        <div className="intro-rig">
          <span className="intro-ring intro-ring--a" />
          <span className="intro-ring intro-ring--b" />
          <span className="intro-ring intro-ring--c" />
          <span className="intro-glow" />
          <PandaMark size={tv ? 150 : 96} className="intro-mark" />
        </div>
        <p className="intro-word"><span>Panda</span><em>.fun</em></p>
        {tv && <p className="intro-tag">Movies and series, made for the big screen</p>}
      </div>
    </div>
  );
}

/** Light dust drifting toward the camera; 2D canvas at half resolution so a TV box keeps 60 fps. */
function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    const w = (c.width = Math.round(window.innerWidth / 2));
    const h = (c.height = Math.round(window.innerHeight / 2));
    const hue = [150, 190, 275];
    const dots = Array.from({ length: 90 }, () => ({ x: (Math.random() - 0.5) * w * 1.6, y: (Math.random() - 0.5) * h * 1.6, z: Math.random() * 0.9 + 0.1, c: hue[Math.floor(Math.random() * 3)] }));
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(48, now - last) / 1000;
      last = now;
      g.clearRect(0, 0, w, h);
      for (const d of dots) {
        d.z -= dt * 0.22;
        if (d.z <= 0.05) { d.z = 1; d.x = (Math.random() - 0.5) * w * 1.6; d.y = (Math.random() - 0.5) * h * 1.6; }
        const k = 0.35 / d.z;
        const x = w / 2 + d.x * k;
        const y = h / 2 + d.y * k;
        if (x < 0 || x > w || y < 0 || y > h) continue;
        const r = Math.min(2.6, 0.5 + (1 - d.z) * 2.2);
        g.fillStyle = `hsla(${d.c}, 90%, 72%, ${Math.min(0.85, (1 - d.z) * 1.1)})`;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="intro-dust" aria-hidden="true" />;
}
