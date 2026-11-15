/**
 * Dev-only harness (served by `vite`, never built): exposes window.__render(t) for the ported IntroBumper frame, like
 * the approved panda-intro-canvas.html does with ?render. Used by scripts/intro/screens.mjs.
 */
import { createBumperRenderer, loadBumperLogo } from "../../src/lib/intro/bumperFrame";

declare global { interface Window { __render?: (t: number) => void; __ready?: boolean } }

void loadBumperLogo().then((logo) => {
  const r = createBumperRenderer(document.getElementById("c") as HTMLCanvasElement, logo, () => ({ w: innerWidth, h: innerHeight }));
  window.__render = (t: number) => { r.resize(); r.draw(t); };
  window.__ready = true;
});
