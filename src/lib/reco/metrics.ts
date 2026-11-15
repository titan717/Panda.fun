import { useEffect, type RefObject } from "react";
import { getState } from "../store";

/**
 * On-device recommendation metrics (directive §8). Nothing leaves the device and there is no backend: these
 * numbers exist so a developer (or a curious viewer with diagnostics on) can see whether the rows are working
 * on *this* device, and so a future version can compare tuning changes against real behaviour instead of the
 * synthetic offline evaluation alone.
 *
 * Logged per profile (localStorage `panda:v1:recometrics`):
 *  - shown:  a recommended title was at least 60 % on screen in a row ("impression"), first time per surface.
 *  - opened: the viewer opened a recommended title from a row.
 * Watch starts and completions are not logged separately: they are read from the profile's own watch history
 * (a title opened from a row that later has > 60 s watched, or is marked completed, after the open).
 */
export interface Mark { at: number; surface: string }
interface ProfileLog { shown: Record<string, Mark>; opened: Record<string, Mark> }
type Store = Record<string, ProfileLog>;

const KEY = "panda:v1:recometrics";
const MAX = 400;
let cache: Store | null = null;

function read(): Store {
  if (cache) return cache;
  let out: Store = {};
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "null") as unknown;
    if (p && typeof p === "object") out = p as Store;
  } catch { /* corrupt: start clean */ }
  cache = out;
  return out;
}

function trim(m: Record<string, Mark>) {
  const e = Object.entries(m);
  return e.length <= MAX ? m : Object.fromEntries(e.sort((a, b) => b[1].at - a[1].at).slice(0, MAX));
}

function update(pid: string, f: (l: ProfileLog) => ProfileLog) {
  const s = read();
  const next = f(s[pid] ?? { shown: {}, opened: {} });
  cache = { ...s, [pid]: { shown: trim(next.shown), opened: trim(next.opened) } };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* full: keep in memory */ }
}

const pidOf = (p?: string | null) => p ?? getState().activeProfileId ?? "_";

/** An impression: once per title per surface; the first sighting is kept (re-scrolling past it is not a new one). */
export function logShown(id: string, surface: string, profileId?: string | null, at = Date.now()) {
  const pid = pidOf(profileId);
  const cur = read()[pid]?.shown[id];
  if (cur && cur.surface === surface) return;
  update(pid, (l) => ({ ...l, shown: { ...l.shown, [id]: { at, surface } } }));
}

/** An open from a recommendation row. The surface is the row the title was last seen in. */
export function logOpened(id: string, profileId?: string | null, at = Date.now()) {
  const pid = pidOf(profileId);
  const surface = read()[pid]?.shown[id]?.surface ?? "unknown";
  update(pid, (l) => ({ ...l, opened: { ...l.opened, [id]: { at, surface } } }));
}

export interface HistoryLike { position: number; completed: boolean; updatedAt: number }
export interface Funnel { surface: string; shown: number; opened: number; started: number; completed: number; ctr: number; startRate: number; completionRate: number }

const ratio = (a: number, b: number) => (b ? a / b : 0);

/** Impression → open → watch start → completion, per surface and in total ("all"). */
export function recoFunnel(profileId: string | null | undefined, history: Record<string, HistoryLike | undefined>): Funnel[] {
  const log = read()[profileId ?? "_"] ?? { shown: {}, opened: {} };
  const surfaces = new Map<string, { shown: number; opened: number; started: number; completed: number }>();
  const bump = (s: string, k: "shown" | "opened" | "started" | "completed") => {
    for (const key of [s, "all"]) {
      const v = surfaces.get(key) ?? { shown: 0, opened: 0, started: 0, completed: 0 };
      v[k]++; surfaces.set(key, v);
    }
  };
  for (const m of Object.values(log.shown)) bump(m.surface, "shown");
  for (const [id, m] of Object.entries(log.opened)) {
    bump(m.surface, "opened");
    const h = history[id];
    if (!h || h.updatedAt < m.at) continue;
    if (h.completed || h.position > 60) bump(m.surface, "started");
    if (h.completed) bump(m.surface, "completed");
  }
  return [...surfaces.entries()]
    .map(([surface, v]) => ({ surface, ...v, ctr: ratio(v.opened, v.shown), startRate: ratio(v.started, v.opened), completionRate: ratio(v.completed, v.started) }))
    .sort((a, b) => (a.surface === "all" ? -1 : b.surface === "all" ? 1 : b.shown - a.shown));
}

export function clearRecoMetrics(profileId?: string | null) {
  const s = { ...read() };
  if (profileId === undefined) for (const k of Object.keys(s)) delete s[k];
  else delete s[profileId ?? "_"];
  cache = s;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
export function resetRecoMetricsCacheForTest() { cache = null; }

/**
 * Observes `[data-reco-id]` cards under `root` and logs an impression when one is ≥ 60 % visible. The surface is
 * the closest `[data-reco-surface]` ancestor (the section id). Re-scans when `deps` change (rows reorder or load).
 */
export function useRecoImpressions(root: RefObject<HTMLElement | null>, deps: unknown) {
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const t = e.target as HTMLElement;
        const id = t.dataset.recoId;
        const surface = t.closest<HTMLElement>("[data-reco-surface]")?.dataset.recoSurface;
        if (id && surface) logShown(id, surface);
        io.unobserve(t);
      }
    }, { threshold: 0.6 });
    el.querySelectorAll("[data-reco-id]").forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [root, deps]);
}
