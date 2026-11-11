// panda.fun landing page (/welcome, v1.2.9): reveals, release info, showcase and the lazy 3D hero.
import "./landing.css";
import { releaseInfo, type Release } from "./release";

const RELEASE_API = "https://api.github.com/repos/titan717/Panda.fun/releases/latest";
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.documentElement.classList.add("js");

// nav background once the page scrolls
const nav = document.getElementById("nav");
const onScroll = () => nav?.classList.toggle("is-scrolled", window.scrollY > 12);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// staggered reveals
const reveals = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
if (reduced || !("IntersectionObserver" in window)) {
  reveals.forEach((el) => el.classList.add("is-in"));
} else {
  const io = new IntersectionObserver((entries) => {
    let i = 0;
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target as HTMLElement;
      el.style.transitionDelay = `${Math.min(i++ * 70, 350)}ms`;
      el.classList.add("is-in");
      io.unobserve(el);
    }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  reveals.forEach((el) => io.observe(el));
}

const year = document.querySelector<HTMLElement>("[data-year]");
if (year) year.textContent = String(new Date().getFullYear());

// ---- release info: only real values from the GitHub release, nothing invented ----
async function loadRelease() {
  const meta = document.querySelector<HTMLElement>("[data-release]");
  try {
    // cached for 30 minutes per tab: GitHub allows 60 unauthenticated API calls per hour per IP
    const KEY = "panda:welcome:release";
    let data: Release | null = null;
    try {
      const hit = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as { at: number; r: Release } | null;
      if (hit && Date.now() - hit.at < 30 * 60_000) data = hit.r;
    } catch { /* ignore */ }
    if (!data) {
      const res = await fetch(RELEASE_API, { headers: { Accept: "application/vnd.github+json" } });
      if (!res.ok) throw new Error(String(res.status));
      data = (await res.json()) as Release;
      try { sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), r: { tag_name: data.tag_name, published_at: data.published_at, assets: data.assets?.map(({ name, size, browser_download_url }) => ({ name, size, browser_download_url })) } })); } catch { /* ignore */ }
    }
    const info = releaseInfo(data);
    if (!info.url) throw new Error("no apk");
    document.querySelectorAll<HTMLAnchorElement>("[data-apk]").forEach((a) => { a.href = info.url!; });
    if (info.sha) document.querySelectorAll<HTMLAnchorElement>("[data-sha]").forEach((a) => { a.href = info.sha!; });
    const set = (k: string, v: string | null) => { const el = document.querySelector(`[data-r="${k}"]`); if (el && v) el.textContent = v; };
    set("version", info.version);
    set("size", info.size);
    set("date", info.date);
    if (meta) {
      meta.replaceChildren();
      const b = document.createElement("b");
      b.textContent = `Version ${info.version}`;
      meta.append(b, document.createTextNode([info.size, info.date ? `released ${info.date}` : null].filter(Boolean).map((x) => ` · ${x}`).join("")));
    }
  } catch {
    // keep the static "Latest release on GitHub" text and the /releases/latest/download link
  }
}
void loadRelease();

// ---- phone showcase ----
const steps = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-step]"));
const shots = Array.from(document.querySelectorAll<HTMLImageElement>("[data-shot]"));
const phone = document.querySelector<HTMLElement>("[data-phone]");
let current = 0;
function show(i: number) {
  if (i === current) return;
  current = i;
  steps.forEach((s, j) => { s.classList.toggle("is-on", j === i); s.setAttribute("aria-pressed", String(j === i)); });
  shots.forEach((s, j) => s.classList.toggle("is-on", j === i));
}
steps.forEach((s, i) => s.addEventListener("click", () => { show(i); paused = true; }));
let paused = false;
const showcase = document.getElementById("screens");
if (showcase && !reduced) {
  // cycle while the section is on screen, until the visitor picks a screen
  let timer = 0;
  new IntersectionObserver(([e]) => {
    window.clearInterval(timer);
    if (e?.isIntersecting) timer = window.setInterval(() => { if (!paused) show((current + 1) % steps.length); }, 3600);
  }, { threshold: 0.35 }).observe(showcase);
}
if (phone && !reduced && window.matchMedia("(pointer: fine)").matches) {
  phone.parentElement?.addEventListener("pointermove", (e) => {
    const r = phone.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    phone.style.setProperty("--ry", `${(-16 + x * 22).toFixed(1)}deg`);
    phone.style.setProperty("--rx", `${(4 - y * 10).toFixed(1)}deg`);
  });
  phone.parentElement?.addEventListener("pointerleave", () => { phone.style.removeProperty("--ry"); phone.style.removeProperty("--rx"); });
}

// ---- TV: tilt flattens as it scrolls into view, screens crossfade ----
const tv = document.querySelector<HTMLElement>("[data-tv]");
const frame = tv?.querySelector<HTMLElement>(".tv-frame");
if (tv && frame && !reduced) {
  let ticking = false;
  const tilt = () => {
    ticking = false;
    const r = tv.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (window.innerHeight - r.top) / (window.innerHeight * 0.9)));
    frame.style.setProperty("--tilt", `${(14 * (1 - p)).toFixed(2)}deg`);
  };
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(tilt); } }, { passive: true });
  tilt();
  const imgs = Array.from(frame.querySelectorAll("img"));
  let k = 0;
  let t = 0;
  new IntersectionObserver(([e]) => {
    window.clearInterval(t);
    if (e?.isIntersecting) t = window.setInterval(() => { imgs[k]?.classList.remove("is-on"); k = (k + 1) % imgs.length; imgs[k]?.classList.add("is-on"); }, 4200);
  }, { threshold: 0.3 }).observe(frame);
}

// ---- lazy 3D hero: after first paint, only with WebGL, never on Save-Data ----
function webgl(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}
function boot3d() {
  const host = document.querySelector<HTMLElement>("[data-panda]");
  const canvas = document.querySelector<HTMLCanvasElement>("[data-panda-canvas]");
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (!host || !canvas || conn?.saveData || !webgl()) return;
  import("./panda3d")
    .then(({ mountPanda }) => mountPanda(canvas, { reduced, onReady: () => host.classList.add("is-3d") }))
    .catch(() => { /* static SVG panda stays */ });
}
const idle = (cb: () => void) => {
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(cb, { timeout: 1500 });
  else setTimeout(cb, 300);
};
if (document.readyState === "complete") idle(boot3d);
else window.addEventListener("load", () => idle(boot3d), { once: true });
