/**
 * Trailer Autoplay Manager (v1.3.2, docs/TRAILERS.md).
 *
 * One manager decides which background trailer may run, for every surface: the TV hero and row
 * backdrops, the phone hero, and both Details pages. A surface asks for its trailer when a title becomes
 * the active one (TV focus, desktop hover = focus, the visible active slide or Details media on phones).
 * The manager then waits `preload` and `delay`, and moves the request through
 *   idle → preload (player created, buffering, invisible, silent) → play.
 * The player itself (`components/Trailer.tsx`) still owns the reveal: hidden for REVEAL_DELAY_MS after
 * PLAYING, then the fade-in.
 *
 * Rules:
 * - Only one request is ever current: a new request cancels the previous one at once (its stage drops to
 *   idle, so its player unmounts or pauses), so two trailer players never run together.
 * - Releasing (focus change, scrolled off screen, page unmounted) cancels the pending delay or stops it.
 * - Page hidden, reduced motion (Settings switch, `html[data-motion=reduce]` or the system setting),
 *   data saver (Stream quality "Data Saver", `navigator.connection.saveData`, 2G/3G) or a lite device
 *   block autoplay; when the block lifts while a title is still active, its delay starts over.
 * - Fast scrolling never starts a trailer: every focus change restarts the delay, so only a title that
 *   stays active for the whole delay plays.
 * - A trailer that fails is not retried for that title this session; one that ended (play once) does not
 *   restart until the title is requested again. Either way the artwork returns.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

export type TrailerStage = "idle" | "preload" | "play";

/** A trailer stays invisible and silent until it has been PLAYING this long (YouTube's title overlay is gone by then). */
export const REVEAL_DELAY_MS = 2000;
/** Background trailers start this far in, so the hidden overlay time is not spent on the first frames. */
export const START_SECONDS = 1;
/** The player is created this long before it should play, so playback starts without a visible wait. */
export const PRELOAD_LEAD_MS = 3000;
/** Default delay before a focused title's trailer plays (Settings › Trailer delay, per profile). */
export const DEFAULT_DELAY_S = 5;

export interface AutoplayEnv {
  /** Settings › Reduce motion. */
  reduceMotion: boolean;
  /** Settings › Stream quality is "Data Saver" (480). */
  qualityDataSaver: boolean;
  /** Low-memory device (hooks.useLiteMotion). */
  lite: boolean;
}

type Conn = { saveData?: boolean; effectiveType?: string; addEventListener?: (t: string, fn: () => void) => void };
const connection = (): Conn | undefined => typeof navigator === "undefined" ? undefined : (navigator as Navigator & { connection?: Conn }).connection;

/** Browser-level data saver: saveData, or a 2G/3G effective connection. */
export function networkDataSaver(c: Conn | undefined = connection()): boolean {
  if (!c) return false;
  if (c.saveData) return true;
  return c.effectiveType === "slow-2g" || c.effectiveType === "2g" || c.effectiveType === "3g";
}

/** System or app reduced-motion. */
export function motionReduced(prefReduce: boolean): boolean {
  if (prefReduce) return true;
  if (typeof document !== "undefined" && document.documentElement.dataset.motion === "reduce") return true;
  try { return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

/** Why autoplay is blocked right now, or null when it may run. */
export function autoplayBlock(env: AutoplayEnv): "hidden" | "motion" | "data" | "lite" | null {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return "hidden";
  if (motionReduced(env.reduceMotion)) return "motion";
  if (env.qualityDataSaver || networkDataSaver()) return "data";
  if (env.lite) return "lite";
  return null;
}

export interface TrailerRequest {
  /** Which surface asks ("tv-hero", "tv-row", "tv-details", "m-hero", "m-details"). */
  surface: string;
  /** The title (PandaItem id). */
  key: string;
  /** Total wait from the request until play, in ms. */
  delayMs: number;
  /** Lead time for preload before play (clamped to the delay). */
  preloadMs?: number;
}

export interface TrailerSnapshot {
  token: number;
  surface: string;
  key: string;
  stage: TrailerStage;
  /** The player reported the reveal (artwork crossfades away). */
  shown: boolean;
}

const IDLE: TrailerSnapshot = { token: 0, surface: "", key: "", stage: "idle", shown: false };

export function createTrailerManager(initial: Partial<AutoplayEnv> = {}) {
  let env: AutoplayEnv = { reduceMotion: false, qualityDataSaver: false, lite: false, ...initial };
  let seq = 0;
  let req: (TrailerRequest & { token: number }) | null = null;
  let snap: TrailerSnapshot = IDLE;
  let timers: ReturnType<typeof setTimeout>[] = [];
  const failed = new Set<string>();
  const ended = new Set<number>();
  const listeners = new Set<() => void>();
  let installed = false;

  const emit = () => listeners.forEach((l) => l());
  const set = (next: TrailerSnapshot) => {
    if (next.token === snap.token && next.stage === snap.stage && next.shown === snap.shown && next.key === snap.key) return;
    snap = next; emit();
  };
  const clear = () => { timers.forEach(clearTimeout); timers = []; };

  /** Start (or restart) the current request's delay, if allowed. */
  function arm() {
    clear();
    if (!req) { set(IDLE); return; }
    const r = req;
    set({ token: r.token, surface: r.surface, key: r.key, stage: "idle", shown: false });
    if (failed.has(r.key) || ended.has(r.token) || autoplayBlock(env)) return;
    const delay = Math.max(0, r.delayMs);
    const lead = Math.min(delay, Math.max(0, r.preloadMs ?? PRELOAD_LEAD_MS));
    const go = (stage: TrailerStage) => () => {
      if (!req || req.token !== r.token) return;
      if (autoplayBlock(env)) { arm(); return; }
      set({ ...snap, stage });
    };
    if (delay === 0) { set({ ...snap, stage: "play" }); return; }
    if (delay - lead > 0) timers.push(setTimeout(go("preload"), delay - lead));
    else set({ ...snap, stage: "preload" });
    timers.push(setTimeout(go("play"), delay));
  }

  function install() {
    if (installed || typeof window === "undefined") return;
    installed = true;
    const recheck = () => { if (!req) return; if (autoplayBlock(env)) { clear(); set({ ...snap, stage: "idle", shown: false }); } else if (snap.stage === "idle") arm(); };
    document.addEventListener("visibilitychange", recheck);
    try { window.matchMedia?.("(prefers-reduced-motion: reduce)").addEventListener?.("change", recheck); } catch { /* old engines */ }
    try { connection()?.addEventListener?.("change", recheck); } catch { /* not supported */ }
    try {
      if (typeof MutationObserver !== "undefined") new MutationObserver(recheck).observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
    } catch { /* not supported */ }
  }

  return {
    /** Ask for a trailer; cancels whatever was current. Returns the request token. */
    request(r: TrailerRequest): number {
      install();
      if (req && req.surface === r.surface && req.key === r.key && req.delayMs === r.delayMs && req.preloadMs === r.preloadMs) return req.token;
      if (req) ended.delete(req.token);
      req = { ...r, token: ++seq };
      arm();
      return req.token;
    },
    /** The title is no longer active: cancel the delay or stop the trailer (no-op for a stale token). */
    release(token: number) {
      if (!req || req.token !== token) return;
      ended.delete(token);
      req = null; clear(); set(IDLE);
    },
    /** The player revealed the trailer. */
    shown(token: number) { if (snap.token === token && snap.stage === "play" && !snap.shown) set({ ...snap, shown: true }); },
    /** Every key failed: the artwork stays and this title is not retried this session. */
    fail(token: number) {
      if (!req || req.token !== token) return;
      failed.add(req.key); clear(); set({ ...snap, stage: "idle", shown: false });
    },
    /** A play-once trailer ended: back to the artwork until the title is requested again. */
    end(token: number) {
      if (!req || req.token !== token) return;
      ended.add(token); clear(); set({ ...snap, stage: "idle", shown: false });
    },
    /** Stop everything (player opened, route change). */
    stopAll() { req = null; clear(); set(IDLE); },
    /** Preference-driven policy (reduced motion switch, Data Saver quality, lite device). */
    setEnv(next: Partial<AutoplayEnv>) {
      const prev = env;
      env = { ...env, ...next };
      if (prev.reduceMotion === env.reduceMotion && prev.qualityDataSaver === env.qualityDataSaver && prev.lite === env.lite) return;
      if (!req) return;
      if (autoplayBlock(env)) { clear(); set({ ...snap, stage: "idle", shown: false }); } else if (snap.stage === "idle") arm();
    },
    /** Re-check the browser policy (visibility, motion, connection) now. */
    recheck() { if (req) { if (autoplayBlock(env)) { clear(); set({ ...snap, stage: "idle", shown: false }); } else if (snap.stage === "idle") arm(); } },
    hasFailed: (key: string) => failed.has(key),
    snapshot: () => snap,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    /** Tests only. */
    reset() { req = null; clear(); failed.clear(); ended.clear(); snap = IDLE; env = { reduceMotion: false, qualityDataSaver: false, lite: false }; emit(); }
  };
}

export type TrailerManager = ReturnType<typeof createTrailerManager>;

/** The app-wide manager. */
export const trailerManager: TrailerManager = createTrailerManager();

export interface TrailerAutoplay {
  /** This surface's stage; idle unless it holds the current request. */
  stage: TrailerStage;
  /** The trailer has been revealed: hide the artwork. */
  shown: boolean;
  /** This title's trailer failed earlier: show artwork only. */
  failed: boolean;
  /** Wire to <Trailer onPlaying / onFail / onEnd>. */
  onPlaying: () => void;
  onFail: () => void;
  onEnd: () => void;
}

/**
 * Ask the manager for a trailer while `key` is the active title on `surface` (pass null when nothing is
 * active). `delayS` is the profile's trailer delay. Release happens on key change, `active=false` and unmount.
 */
export function useTrailerAutoplay(surface: string, key: string | null, delayS: number, opts: { preloadS?: number; manager?: TrailerManager } = {}): TrailerAutoplay {
  const m = opts.manager ?? trailerManager;
  const token = useRef(0);
  const delayMs = Math.max(0, (Number.isFinite(delayS) ? delayS : DEFAULT_DELAY_S) * 1000);
  const preloadMs = opts.preloadS === undefined ? undefined : opts.preloadS * 1000;
  useEffect(() => {
    if (!key) return;
    const t = m.request({ surface, key, delayMs, preloadMs });
    token.current = t;
    return () => { m.release(t); if (token.current === t) token.current = 0; };
  }, [m, surface, key, delayMs, preloadMs]);
  const snap = useSyncExternalStore(m.subscribe, m.snapshot, m.snapshot);
  const mine = !!key && snap.surface === surface && snap.key === key && snap.token !== 0;
  const onPlaying = useCallback(() => m.shown(token.current), [m]);
  const onFail = useCallback(() => m.fail(token.current), [m]);
  const onEnd = useCallback(() => m.end(token.current), [m]);
  return { stage: mine ? snap.stage : "idle", shown: mine && snap.shown, failed: !!key && m.hasFailed(key), onPlaying, onFail, onEnd };
}

/** Pushes the profile's autoplay policy into the manager (mount on each surface that autoplays; idempotent). */
export function useTrailerPolicy(env: AutoplayEnv, manager: TrailerManager = trailerManager) {
  const { reduceMotion, qualityDataSaver, lite } = env;
  useEffect(() => { manager.setEnv({ reduceMotion, qualityDataSaver, lite }); }, [manager, reduceMotion, qualityDataSaver, lite]);
}

/** True while `el` is at least `ratio` visible (phones: the active hero card or Details media must really be on screen). */
export function useMostlyVisible(ref: { current: Element | null }, ratio = 0.6, enabled = true) {
  const subscribe = useCallback((notify: () => void) => {
    const el = ref.current;
    if (!enabled || !el || typeof IntersectionObserver === "undefined") return () => undefined;
    const io = new IntersectionObserver((entries) => {
      const e = entries[entries.length - 1];
      visible.set(el, !!e && e.isIntersecting && e.intersectionRatio >= ratio);
      notify();
    }, { threshold: [0, ratio, 1] });
    io.observe(el);
    return () => { io.disconnect(); visible.delete(el); };
  }, [ref, ratio, enabled]);
  // no IntersectionObserver (old WebViews, tests): treat as visible
  const get = () => !enabled ? false : typeof IntersectionObserver === "undefined" ? true : ref.current ? visible.get(ref.current) ?? false : false;
  return useSyncExternalStore(subscribe, get, get);
}
const visible = new WeakMap<Element, boolean>();
