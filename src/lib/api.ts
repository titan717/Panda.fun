import type {
  CategoriesPayload, GenresPayload, ListPayload, MediaType, PagePayload, PageKind, PlaybackPayload,
  SearchPayload, SeasonDetails, TitleDetails, Top10Payload
} from "./types";

export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "https://movieapi-3d0v.onrender.com/api/v1";

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET a movieapi path with timeout and retry (network errors and 5xx/429 are retried with backoff).
 * The Render free tier cold-starts in ~30 s, so the first attempt gets a generous timeout.
 */
export async function apiGet<T>(path: string, init: { signal?: AbortSignal; retries?: number; timeoutMs?: number } = {}): Promise<T> {
  const retries = init.retries ?? 2;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? (attempt === 0 ? 45_000 : 20_000));
    const onAbort = () => controller.abort();
    init.signal?.addEventListener("abort", onAbort);
    try {
      const res = await fetch(`${API_BASE}${path}`, { signal: controller.signal, headers: { Accept: "application/json" } });
      const body = (await res.json().catch(() => null)) as { success?: boolean; data?: T; error?: { code?: string; message?: string } } | null;
      if (!res.ok || !body?.success) {
        const err = new ApiError(body?.error?.message ?? `Request failed (${res.status})`, res.status, body?.error?.code);
        if (res.status >= 500 || res.status === 429) { lastError = err; throw err; }
        throw Object.assign(err, { fatal: true });
      }
      return body.data as T;
    } catch (e) {
      lastError = e;
      if ((e as { fatal?: boolean }).fatal || init.signal?.aborted) throw e;
      if (attempt < retries) await sleep(800 * 2 ** attempt);
    } finally {
      clearTimeout(timeout);
      init.signal?.removeEventListener("abort", onAbort);
    }
  }
  if (lastError instanceof ApiError) throw lastError;
  throw new ApiError(typeof navigator !== "undefined" && !navigator.onLine ? "You're offline." : "Couldn't reach Panda servers.", 0, "NETWORK");
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
  search: (q: string, page = 1) => `/panda/search${qs({ q, page })}`,
  discover: (type: MediaType, o: { genre?: string; lang?: string; country?: string; sort?: string; page?: number }) => `/panda/discover/${type}${qs(o)}`,
  trending: (type: "all" | MediaType = "all", window: "day" | "week" = "day", page = 1) => `/panda/trending${qs({ type, window, page })}`,
  top10: (lang: string) => `/panda/top10/${lang}`,
  genres: () => `/panda/genres`,
  categories: () => `/panda/categories`,
  play: (type: MediaType, id: number, o: { s?: number; e?: number; t?: number } = {}) => `/panda/play/${type}/${id}${qs({ ...o, color: "#1f80e0" })}`,
  health: () => `/health`
};

export const api = {
  page: (kind: PageKind) => apiGet<PagePayload>(keys.page(kind)),
  title: (type: MediaType, id: number) => apiGet<TitleDetails>(keys.title(type, id)),
  season: (id: number, s: number) => apiGet<SeasonDetails>(keys.season(id, s)),
  search: (q: string, page = 1, signal?: AbortSignal) => apiGet<SearchPayload>(keys.search(q, page), { signal, retries: 1 }),
  discover: (type: MediaType, o: Parameters<typeof keys.discover>[1]) => apiGet<ListPayload>(keys.discover(type, o)),
  top10: (lang: string) => apiGet<Top10Payload>(keys.top10(lang)),
  genres: () => apiGet<GenresPayload>(keys.genres()),
  categories: () => apiGet<CategoriesPayload>(keys.categories()),
  play: (type: MediaType, id: number, o: { s?: number; e?: number; t?: number } = {}) => apiGet<PlaybackPayload>(keys.play(type, id, o), { retries: 1, timeoutMs: 20_000 })
};

/** Generic SWR fetcher: the key is the API path. */
export const fetcher = <T,>(path: string) => apiGet<T>(path);
