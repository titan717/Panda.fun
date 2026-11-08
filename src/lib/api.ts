import type {
  CalendarPayload, CategoriesPayload, GenresPayload, ListPayload, MediaType, PagePayload, PageKind, PlaybackPayload,
  SearchPayload, SeasonDetails, SourceHealthPayload, TitleDetails, Top10Payload, WallPayload
} from "./types";
import { validatorFor } from "./validate";

/** Production movieapi deployment on Vercel. VITE_API_BASE may point at another Vercel/local deployment. */
export const DEFAULT_API_BASE = "https://apikinoma.vercel.app/api/v1";

export function resolveApiBase(env: string | undefined): string {
  const v = env?.trim().replace(/\/$/, "");
  if (!v) return DEFAULT_API_BASE;
  try {
    const u = new URL(v);
    // Only accept Vercel deployments or local development servers (DECISIONS D-21).
    if (u.protocol === "https:" && u.hostname.endsWith(".vercel.app")) return v;
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return v;
  } catch { /* malformed → default */ }
  return DEFAULT_API_BASE;
}

export const API_BASE = resolveApiBase(import.meta.env.VITE_API_BASE as string | undefined);

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
});

type GetInit = { signal?: AbortSignal; retries?: number; timeoutMs?: number };
const inflight = new Map<string, Promise<unknown>>();

async function request<T>(path: string, init: GetInit): Promise<T> {
  const retries = init.retries ?? 2;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? (attempt === 0 ? 12_000 : 15_000));
    const onAbort = () => controller.abort();
    init.signal?.addEventListener("abort", onAbort);
    try {
      const res = await fetch(`${API_BASE}${path}`, { signal: controller.signal, headers: { Accept: "application/json" } });
      const body = (await res.json().catch(() => null)) as { success?: boolean; data?: unknown; error?: { code?: string; message?: string } } | null;
      if (!res.ok || !body?.success) {
        const err = new ApiError(body?.error?.message ?? `Request failed (${res.status})`, res.status, body?.error?.code);
        if (res.status >= 500 || res.status === 429) { lastError = err; throw err; }
        throw Object.assign(err, { fatal: true });
      }
      const validate = validatorFor(path);
      try {
        return (validate ? validate(path, body.data) : body.data) as T;
      } catch (e) {
        throw Object.assign(e as Error, { fatal: true });
      }
    } catch (e) {
      lastError = e;
      if ((e as { fatal?: boolean }).fatal || init.signal?.aborted) throw e;
      if (attempt < retries) await sleep(500 * 2 ** attempt + Math.random() * 250, init.signal);
    } finally {
      clearTimeout(timeout);
      init.signal?.removeEventListener("abort", onAbort);
    }
  }
  if (lastError instanceof ApiError) throw lastError;
  throw new ApiError(typeof navigator !== "undefined" && !navigator.onLine ? "You're offline." : "Couldn't reach Panda servers.", 0, "NETWORK");
}

/**
 * GET a movieapi path: validated payload, timeout, retry with jittered backoff (network, 5xx, 429),
 * caller abort, and in-flight de-duplication (identical concurrent GETs share one request
 * unless the caller passes its own AbortSignal).
 */
export function apiGet<T>(path: string, init: GetInit = {}): Promise<T> {
  if (init.signal) return request<T>(path, init);
  const existing = inflight.get(path);
  if (existing) return existing as Promise<T>;
  const p = request<T>(path, init).finally(() => inflight.delete(path));
  inflight.set(path, p);
  return p;
}

const qs = (o: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

/** SWR keys are the API paths themselves so the persisted cache can be shared across screens. */
export const keys = {
  page: (kind: PageKind) => `/panda/page/${kind}`,
  title: (type: MediaType, id: number) => `/panda/title/${type}/${id}`,
  season: (id: number, season: number) => `/panda/title/tv/${id}/season/${season}`,
  person: (id: number) => `/panda/person/${id}`,
  collection: (id: number) => `/panda/collection/${id}`,
  search: (q: string, page = 1) => `/panda/search${qs({ q, page })}`,
  discover: (type: MediaType, o: { genre?: string; lang?: string; country?: string; sort?: string; page?: number }) => `/panda/discover/${type}${qs(o)}`,
  trending: (type: "all" | MediaType = "all", window: "day" | "week" = "day", page = 1) => `/panda/trending${qs({ type, window, page })}`,
  top10: (lang: string) => `/panda/top10/${lang}`,
  genres: () => `/panda/genres`,
  categories: () => `/panda/categories`,
  play: (type: MediaType, id: number, o: { s?: number; e?: number; t?: number; quality?: string } = {}) => `/panda/play/${type}/${id}${qs({ ...o, color: "1f80e0" })}`,
  sourceHealth: () => `/panda/sources/health`,
  segments: (imdbId: string, s?: number, e?: number) => `/panda/segments/${imdbId}${qs({ s, e })}`,
  wall: () => `/panda/wall`,
  /** ids are sorted so the same followed set always shares one cache entry. */
  calendar: (ids: string[]) => `/panda/calendar${qs({ ids: [...ids].sort().join(",") })}`,
  health: () => `/health`
};

export const api = {
  page: (kind: PageKind) => apiGet<PagePayload>(keys.page(kind)),
  title: (type: MediaType, id: number) => apiGet<TitleDetails>(keys.title(type, id)),
  season: (id: number, s: number) => apiGet<SeasonDetails>(keys.season(id, s)),
  search: (q: string, page = 1, signal?: AbortSignal) => apiGet<SearchPayload>(keys.search(q, page), { signal, retries: 1 }),
  discover: (type: MediaType, o: Parameters<typeof keys.discover>[1]) => apiGet<ListPayload>(keys.discover(type, o)),
  trending: (type: "all" | MediaType = "all", window: "day" | "week" = "day", page = 1) => apiGet<ListPayload>(keys.trending(type, window, page)),
  top10: (lang: string) => apiGet<Top10Payload>(keys.top10(lang)),
  genres: () => apiGet<GenresPayload>(keys.genres()),
  categories: () => apiGet<CategoriesPayload>(keys.categories()),
  play: (type: MediaType, id: number, o: { s?: number; e?: number; t?: number; quality?: string } = {}) => apiGet<PlaybackPayload>(keys.play(type, id, o), { retries: 1, timeoutMs: 10_000 }),
  wall: () => apiGet<WallPayload>(keys.wall()),
  calendar: (ids: string[], signal?: AbortSignal) => apiGet<CalendarPayload>(keys.calendar(ids), { signal, retries: 1 }),
  report: (r: PlaybackReport) => sendReport(r),
  sourceHealth: () => apiGet<SourceHealthPayload>(keys.sourceHealth(), { retries: 0, timeoutMs: 10_000 })
};

export interface PlaybackReport { type: MediaType; tmdbId: number; season?: number; episode?: number; source: string | null; issue: string; position: number }

/** "Report an Issue" from the player (§20.9). Fire-and-forget; text/plain keeps it a simple CORS request. */
export async function sendReport(r: PlaybackReport) {
  const body = JSON.stringify(r);
  const url = `${API_BASE}/panda/report`;
  if (navigator.sendBeacon?.(url, new Blob([body], { type: "text/plain" }))) return;
  await fetch(url, { method: "POST", body, headers: { "Content-Type": "text/plain" }, keepalive: true });
}

/** Generic SWR fetcher: the key is the API path. */
export const fetcher = <T,>(path: string) => apiGet<T>(path);
