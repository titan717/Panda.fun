import { apiGet, keys } from "../api";
import { canPrefetch } from "../network";
import type { TitleDetails } from "../types";
import type { LearnerState } from "./learner";
import { intelState, noteDetails, predict, subscribeIntel } from "./runtime";

/**
 * v1.5.0 details prefetch for Panda Intelligence.
 *
 * Lists (rows, search, history) do not carry directors, cast or franchise; title details do. The model learns those
 * features whenever details are opened (useTitle → noteDetails). This fills the gap for a few high-value titles the
 * profile has not opened since v1.5.0, so "Because you like <director>" rails and person-level taste work sooner:
 *
 *   - candidates, in order: the profile's recently watched titles, then its rated and saved titles, then the
 *     titles the model currently predicts highest among those it has seen in rows;
 *   - at most MAX_PER_RUN per run and MAX_PER_SESSION per profile per session, CONCURRENCY at a time;
 *   - a title is never requested twice in a session, and details already in the SWR cache are reused, not refetched;
 *   - nothing runs on Data Saver, slow connections, "Data saver" quality or ≤1 GB devices (canPrefetch + memory);
 *   - it starts only after an idle delay, so it never competes with Home's first requests;
 *   - switching profile aborts the run and its in-flight requests.
 * The requests are the same public catalogue requests Details makes; nothing about the profile is sent.
 */
export const MAX_PER_RUN = 8;
export const MAX_PER_SESSION = 24;
export const CONCURRENCY = 2;
export const START_DELAY_MS = 6000;

export interface DetailsCache { get(key: string): TitleDetails | undefined; put(key: string, d: TitleDetails): void }
let cache: DetailsCache | null = null;
/** App wires the SWR cache in, so prefetched details are shared with Details and never fetched twice. */
export function setDetailsCache(c: DetailsCache | null) { cache = c; }

type Fetch = (path: string, signal: AbortSignal) => Promise<TitleDetails>;
let fetchDetails: Fetch = (path, signal) => apiGet<TitleDetails>(path, { signal, retries: 0, timeoutMs: 10_000 });

const requested = new Set<string>();
const perProfile = new Map<string, number>();
let run: { pid: string; ctrl: AbortController } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
export const prefetchStats = { fetched: 0, reused: 0, failed: 0, aborted: 0, runs: 0 };

function lowMemory() {
  const n = typeof navigator !== "undefined" ? (navigator as Navigator & { deviceMemory?: number }) : undefined;
  return n?.deviceMemory !== undefined && n.deviceMemory <= 1;
}

const parse = (id: string) => {
  const m = /^(movie|tv):(\d+)$/.exec(id);
  return m ? { type: m[1] as "movie" | "tv", tmdbId: Number(m[2]) } : null;
};

/** The titles worth details, best first (pure; exported for tests). */
export function detailCandidates(s: LearnerState, src: { history: Record<string, { item: { id: string }; updatedAt: number }>; ratings: Record<string, unknown>; watchlist: readonly { id: string }[] }, now = Date.now()): string[] {
  const needs = (id: string) => {
    const f = s.features[id];
    return !s.forgotten[id] && !(f?.directors && f.cast);
  };
  const out: string[] = [];
  const add = (id: string) => { if (!out.includes(id) && needs(id) && parse(id)) out.push(id); };
  for (const h of Object.values(src.history).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 30)) add(h.item.id);
  for (const id of Object.keys(src.ratings)) add(id);
  for (const i of src.watchlist.slice(0, 20)) add(i.id);
  const seen = Object.keys(s.shown).filter((id) => s.features[id] && needs(id));
  const scored = seen.map((id) => {
    const f = s.features[id]!;
    const p = predict({ id, type: f.type, tmdbId: 0, title: f.title, genres: f.genres, language: f.language ?? undefined, year: f.year ?? undefined, rating: f.rating ?? undefined } as never, s, now);
    return { id, p: p ?? 0 };
  }).sort((a, b) => b.p - a.p || (a.id < b.id ? -1 : 1));
  for (const x of scored.slice(0, 20)) add(x.id);
  return out;
}

async function runOnce(pid: string, ids: string[], ctrl: AbortController) {
  prefetchStats.runs++;
  const queue = ids.filter((id) => !requested.has(`${pid}|${id}`));
  const budget = Math.min(MAX_PER_RUN, MAX_PER_SESSION - (perProfile.get(pid) ?? 0));
  const picked = queue.slice(0, Math.max(0, budget));
  const work = async () => {
    for (;;) {
      if (ctrl.signal.aborted) return;
      const id = picked.shift();
      if (!id) return;
      const t = parse(id)!;
      requested.add(`${pid}|${id}`);
      perProfile.set(pid, (perProfile.get(pid) ?? 0) + 1);
      const key = keys.title(t.type, t.tmdbId);
      const hit = cache?.get(key);
      if (hit) { prefetchStats.reused++; noteDetails(hit); continue; }
      try {
        const d = await fetchDetails(key, ctrl.signal);
        if (ctrl.signal.aborted || intelState()?.profileId !== pid) { prefetchStats.aborted++; return; }
        prefetchStats.fetched++;
        cache?.put(key, d);
        noteDetails(d);
      } catch {
        if (ctrl.signal.aborted) { prefetchStats.aborted++; return; }
        prefetchStats.failed++;
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, work));
}

/**
 * Schedule a prefetch run for the active profile after `delay` ms (Home calls this once it has painted).
 * Returns false when this device or connection should not prefetch.
 */
export function schedulePrefetch(src: Parameters<typeof detailCandidates>[1], delay = START_DELAY_MS): boolean {
  if (!canPrefetch() || lowMemory()) return false;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const s = intelState();
    if (!s) return;
    if (run && run.pid === s.profileId) return; // one run at a time
    const ids = detailCandidates(s, src);
    if (!ids.length) return;
    const ctrl = new AbortController();
    run = { pid: s.profileId, ctrl };
    void runOnce(s.profileId, ids, ctrl).finally(() => { if (run?.ctrl === ctrl) run = null; });
  }, delay);
  return true;
}

/** Abort the current run (profile switched, model reset). */
export function cancelPrefetch() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (run) { run.ctrl.abort(); run = null; }
}

let lastPid: string | null = null;
subscribeIntel(() => {
  const pid = intelState()?.profileId ?? null;
  if (pid !== lastPid) { lastPid = pid; if (run && run.pid !== pid) cancelPrefetch(); }
});

export function resetPrefetchForTest(f?: Fetch) {
  cancelPrefetch();
  requested.clear(); perProfile.clear();
  Object.assign(prefetchStats, { fetched: 0, reused: 0, failed: 0, aborted: 0, runs: 0 });
  if (f) fetchDetails = f;
}
/** Wait for the current run (tests). */
export const prefetchIdle = async () => { for (let i = 0; i < 50 && (run || timer); i++) await new Promise((r) => setTimeout(r, 5)); };
