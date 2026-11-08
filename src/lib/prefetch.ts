import { preload } from "swr";
import { fetcher, keys } from "./api";
import { canPrefetch, resetNetwork } from "./network";
import { preloadImages } from "./preload";
import type { MediaType, PandaItem } from "./types";

/**
 * Prefetch intelligence (v1.1.6, spec §8 "load extremely quickly").
 *
 * - Network aware: nothing speculative is fetched on Data Saver, 2G/slow-2G or when the user picked
 *   the "Data saver" stream quality (D-83).
 * - Intent based: a finger landing on a mobile poster starts the title request ~100–200 ms before
 *   the tap completes, and Details warms the playback source's origin so Play starts sooner.
 * - Bounded: every warm-up is de-duplicated so scrolling a long row never floods the network.
 */
export { canPrefetch, setPrefetchDataSaver } from "./network";

const warmedTitles = new Set<string>();
const MAX_WARM = 120;

/** Starts loading a title's details payload and hero images before navigation. */
export function prefetchTitle(type: MediaType, id: number, images: Array<string | null | undefined> = []): boolean {
  if (!canPrefetch() || !id) return false;
  const key = keys.title(type, id);
  if (warmedTitles.has(key)) return false;
  if (warmedTitles.size >= MAX_WARM) warmedTitles.clear();
  warmedTitles.add(key);
  void preload(key, fetcher).catch(() => warmedTitles.delete(key));
  if (images.length) preloadImages(images, 2);
  return true;
}

export function prefetchItem(item: PandaItem): boolean {
  return prefetchTitle(item.type, item.tmdbId, [item.backdropLarge ?? item.backdrop, item.logo]);
}

/** Season payload for the episode the user is about to play (next-episode, resume). */
export function prefetchSeason(id: number, season: number): boolean {
  if (!canPrefetch() || !id || !season) return false;
  void preload(keys.season(id, season), fetcher).catch(() => undefined);
  return true;
}

export function prefetchSegments(imdbId: string | null | undefined, s?: number, e?: number): boolean {
  if (!canPrefetch() || !imdbId) return false;
  void preload(keys.segments(imdbId, s, e), fetcher).catch(() => undefined);
  return true;
}

export const SOURCE_ORIGINS = { cinesrc: "https://cinesrc.st", vidy: "https://vidy.st" } as const;
const connected = new Set<string>();

/** Opens DNS + TLS to the playback source so the embedded player's first request is faster. */
export function preconnect(origin: string): boolean {
  if (typeof document === "undefined" || connected.has(origin)) return false;
  connected.add(origin);
  for (const rel of ["dns-prefetch", "preconnect"]) {
    const l = document.createElement("link");
    l.rel = rel;
    l.href = origin;
    if (rel === "preconnect") l.crossOrigin = "anonymous";
    document.head.appendChild(l);
  }
  return true;
}

export function preconnectSource(source: keyof typeof SOURCE_ORIGINS) {
  if (!canPrefetch()) return false;
  return preconnect(SOURCE_ORIGINS[source] ?? SOURCE_ORIGINS.cinesrc);
}

export function resetPrefetch() { warmedTitles.clear(); connected.clear(); resetNetwork(); }

/** What Details knows about the user's next Play press. */
export interface PlayTarget { type: MediaType; tmdbId: number; imdbId: string | null; season?: number; episode?: number }

/**
 * Details idle warm-up: open the preferred source's connection, fetch the skip markers for the episode
 * Play will start, and (TV shows) the season payload the player's episode picker needs.
 * Returns the work that was started, for tests and PERF logging.
 */
export function warmPlayback(t: PlayTarget, source: keyof typeof SOURCE_ORIGINS = "cinesrc") {
  if (!canPrefetch()) return { source: false, segments: false, season: false };
  const s = t.type === "tv" ? t.season ?? 1 : undefined;
  const e = t.type === "tv" ? t.episode ?? 1 : undefined;
  return {
    source: preconnectSource(source),
    segments: prefetchSegments(t.imdbId, s, e),
    season: t.type === "tv" && s ? prefetchSeason(t.tmdbId, s) : false
  };
}
