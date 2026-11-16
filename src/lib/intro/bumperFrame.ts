/**
 * v1.4.2 IntroBumper renderer: a faithful TypeScript port of the approved `frame(t)` from panda-intro-canvas.html.
 * Same timings, curves, colours and composite order; only the globals became a closure over one canvas. This module
 * (and the logo it imports) is loaded with a dynamic import, so neither is part of the main bundle.
 *
 * Timeline (seconds): faint glow from 0.4; a thin gradient bar grows from 0.38 into a play triangle (0.95–1.55);
 * it thickens and fills (1.45–1.85) on the two kick beats (1.55, 1.85), collapses into a point (1.95–2.3) as the
 * pink flash peaks (2.05–2.6); the logo is revealed by an expanding radial mask with two rings (2.2–3.2), a light
 * sweep crosses it (3.1–3.75) and the frame fades to black (3.82–4.0).
 */
import logoUrl from "../../assets/intro/panda-intro-logo.webp?url";

export const BUMPER_DUR = 4;
/** The "final logo frame": the logo fully revealed, after the light sweep and before the fade to black. */
export const BUMPER_FINAL_T = 3.8;
export const BUMPER_LOGO_URL: string = logoUrl;

const cl = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sg = (t: number, a: number, b: number) => cl((t - a) / (b - a));
const eo = (x: number) => 1 - Math.pow(1 - x, 3);
const eio = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
/** Exported for tests: the easing helpers are part of the spec. */
export const curves = { cl, sg, eo, eio };

export interface BumperRenderer {
  /** Match the canvas backing store to its CSS size (DPR capped at 2). */
  resize(): void;
  /** Draw the frame at `t` seconds (clamped to 0..DUR). */
  draw(t: number): void;
}

/** Load the extracted logo. Resolves null (never rejects) if it cannot be decoded: the frame then draws without it. */
export function loadBumperLogo(src: string = BUMPER_LOGO_URL): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    try {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = src;
    } catch { resolve(null); }
  });
}

/**
 * A renderer bound to `canvas`. `size` reports the CSS size to draw at (defaults to the canvas's client box, or the
 * window when the canvas has not been laid out yet). Throws if a 2D context is unavailable.
 */
export function createBumperRenderer(canvas: HTMLCanvasElement, logo: HTMLImageElement | null, size?: () => { w: number; h: number }): BumperRenderer {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  const lg = document.createElement("canvas");
  lg.width = lg.height = 1000;
  const lx = lg.getContext("2d");
  let W = 0, H = 0;

  const measure = size ?? (() => ({ w: canvas.clientWidth || window.innerWidth, h: canvas.clientHeight || window.innerHeight }));

  function resize() {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    const { w, h } = measure();
    W = w; H = h;
    canvas.width = Math.max(1, Math.round(W * d));
    canvas.height = Math.max(1, Math.round(H * d));
    ctx!.setTransform(d, 0, 0, d, 0, 0);
  }

  function glow(x: number, y: number, r: number, col: string, a: number) {
    if (a <= 0) return;
    const g = ctx!.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col.replace("A", String(a)));
    g.addColorStop(1, col.replace("A", "0"));
    ctx!.save(); ctx!.globalCompositeOperation = "lighter"; ctx!.fillStyle = g; ctx!.fillRect(x - r, y - r, 2 * r, 2 * r); ctx!.restore();
  }

  function frame(t: number) {
    const c = ctx!;
    c.globalCompositeOperation = "source-over"; c.globalAlpha = 1; c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, u = Math.min(W / 1600, H / 900), M = Math.min(W * 0.96, H * 1.04);
    const b1 = t > 1.55 ? Math.exp(-(t - 1.55) * 7) : 0, b2 = t > 1.85 ? 0.6 * Math.exp(-(t - 1.85) * 7) : 0, beat = b1 + b2;
    glow(cx, cy + H * 0.16, H * 0.8, "rgba(110,40,255,A)", 0.06 * sg(t, 0.4, 1.4) + 0.26 * beat + 0.1 * sg(t, 2, 2.8));

    /* triangle */
    const Lh = 300 * u, tw = Lh * 0.866, x0 = -tw / 3, xt = (2 * tw) / 3, ta = 1 - sg(t, 2.2, 2.3);
    if (ta > 0 && t > 0.38) {
      c.save(); c.translate(cx, cy);
      const sc = (1 + 0.05 * b1 + (0.03 * b2) / 0.6) * Math.max(0.001, 1 - eio(sg(t, 1.95, 2.3)));
      c.scale(sc, sc);
      c.globalCompositeOperation = "source-over"; c.globalAlpha = ta * sg(t, 0.38, 0.55);
      const g = c.createLinearGradient(x0, -Lh / 2, xt, Lh / 2);
      g.addColorStop(0, "#ff2bd6"); g.addColorStop(0.5, "#9a2bff"); g.addColorStop(1, "#3a2bff");
      const lw = (4 + 22 * eio(sg(t, 1.45, 1.75))) * u, k = eio(sg(t, 0.95, 1.55)), lh = Lh * eo(sg(t, 0.38, 1.0)), f = eio(sg(t, 1.45, 1.85));
      c.strokeStyle = g; c.fillStyle = g; c.lineJoin = "round"; c.lineCap = "round"; c.shadowColor = "#a030ff"; c.shadowBlur = (26 + 50 * beat) * u;
      if (f < 1) {
        c.lineWidth = lw; c.beginPath(); c.moveTo(x0, -lh / 2); c.lineTo(x0, lh / 2);
        c.moveTo(x0, -Lh / 2); c.lineTo(x0 + (xt - x0) * k, (-Lh / 2) * (1 - k)); c.moveTo(x0, Lh / 2); c.lineTo(x0 + (xt - x0) * k, (Lh / 2) * (1 - k)); c.stroke();
      }
      if (f > 0) {
        c.save(); c.beginPath(); c.rect(x0 - lw, -Lh, (tw + 2 * lw) * f, 2 * Lh); c.clip();
        c.lineWidth = lw; c.beginPath(); c.moveTo(x0, -Lh / 2); c.lineTo(xt, 0); c.lineTo(x0, Lh / 2); c.closePath(); c.fill(); c.stroke();
        c.shadowBlur = 0;
        const h = c.createLinearGradient(x0, -Lh / 2, x0 + tw * 0.5, 0);
        h.addColorStop(0, "rgba(255,255,255,.2)"); h.addColorStop(1, "rgba(255,255,255,0)");
        c.fillStyle = h; c.fill(); c.restore();
      }
      c.restore();
    }

    /* reveal */
    glow(cx, cy, 320 * u, "rgba(255,170,255,A)", 0.9 * Math.sin(Math.PI * sg(t, 2.05, 2.6)));
    const R = eo(sg(t, 2.2, 3)) * M * 0.78;
    glow(cx, cy, M * 0.7, "rgba(138,43,255,A)", 0.3 * sg(t, 2.4, 3.2));
    if (R > 2 && logo && logo.width && lx) {
      lx.globalCompositeOperation = "source-over"; lx.clearRect(0, 0, 1000, 1000); lx.drawImage(logo, 0, 0, 1000, 1000);
      lx.globalCompositeOperation = "destination-in";
      const r = (R / M) * 1000, g = lx.createRadialGradient(500, 500, 0, 500, 500, r);
      g.addColorStop(0, "#000"); g.addColorStop(0.82, "#000"); g.addColorStop(1, "rgba(0,0,0,0)");
      lx.fillStyle = g; lx.fillRect(0, 0, 1000, 1000);
      if (t > 3.1 && t < 3.75) {
        lx.globalCompositeOperation = "source-atop";
        const x = -300 + 1700 * eio(sg(t, 3.1, 3.75)), s = lx.createLinearGradient(x - 160, 0, x + 160, 0);
        s.addColorStop(0, "rgba(255,255,255,0)"); s.addColorStop(0.5, "rgba(255,255,255,.55)"); s.addColorStop(1, "rgba(255,255,255,0)");
        lx.setTransform(1, 0, -0.35, 1, 170, 0); lx.fillStyle = s; lx.fillRect(-300, 0, 2200, 1000); lx.setTransform(1, 0, 0, 1, 0, 0);
      }
      const ls = 1.05 - 0.05 * eo(sg(t, 2.2, 3.5));
      c.save(); c.translate(cx, cy); c.scale(ls, ls); c.drawImage(lg, -M / 2, -M / 2, M, M); c.restore();
    }

    /* rings */
    const ring = (r: number, a: number) => {
      if (a <= 0 || r < 2) return;
      c.save(); c.globalCompositeOperation = "lighter";
      const g = c.createLinearGradient(cx - r, cy, cx + r, cy);
      g.addColorStop(0, "rgba(255,43,214," + a + ")"); g.addColorStop(1, "rgba(80,60,255," + a + ")");
      c.strokeStyle = g; c.lineWidth = 2.5 * u; c.shadowColor = "#a030ff"; c.shadowBlur = 18 * u;
      c.beginPath(); c.arc(cx, cy, r, 0, 6.283); c.stroke(); c.restore();
    };
    ring(R, 0.9 * sg(t, 2.2, 2.35) * (1 - sg(t, 2.65, 3.15)));
    ring(eo(sg(t, 2.3, 3.1)) * M * 0.9, 0.4 * sg(t, 2.3, 2.45) * (1 - sg(t, 2.7, 3.2)));
    const fo = sg(t, 3.82, 4);
    if (fo > 0) { c.fillStyle = "rgba(0,0,0," + fo + ")"; c.fillRect(0, 0, W, H); }
  }

  resize();
  return { resize, draw: (t: number) => frame(Math.min(Math.max(t, 0), BUMPER_DUR)) };
}
