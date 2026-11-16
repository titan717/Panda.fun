import useSWRInfinite from "swr/infinite";
import { keys } from "./api";
import type { ListPayload, MediaType } from "./types";
import { usePersonalPages } from "./intel/personalize";

export interface BrowseParams { kind: "movie" | "tv" | "trending"; genre?: string; lang?: string; country?: string; sort?: string }

/** Sort ids handled on the device: both fetch the catalogue's popularity order; only "For you" reorders it. */
export const FOR_YOU = "foryou";
export const POPULAR = "popular";

/** Infinite browse grid data (spec 9.3) backed by /panda/discover and /panda/trending. */
export function useBrowse(p: BrowseParams) {
  const getKey = (page: number, prev: ListPayload | null) => {
    if (prev && (prev.results.length === 0 || (prev.totalPages && page + 1 > prev.totalPages))) return null;
    if (page >= 25) return null;
    return p.kind === "trending"
      ? keys.trending("all", "week", page + 1)
      : keys.discover(p.kind as MediaType, { genre: p.genre, lang: p.lang, country: p.country, sort: p.sort === FOR_YOU || p.sort === POPULAR ? undefined : p.sort, page: page + 1 });
  };
  const swr = useSWRInfinite<ListPayload>(getKey, { revalidateFirstPage: false, revalidateOnFocus: false });
  const pages = swr.data ?? [];
  // "For you" (the default order) personalises each page once; an explicit sort keeps the catalogue order exactly
  const personal = !p.sort || p.sort === FOR_YOU;
  const items = usePersonalPages(pages.map((pg) => pg.results), personal);
  const last = pages[pages.length - 1];
  const done = Boolean(last && (last.results.length === 0 || (last.totalPages !== undefined && pages.length >= last.totalPages))) || pages.length >= 25;
  const loadingMore = swr.isLoading || (swr.size > 0 && swr.data && typeof swr.data[swr.size - 1] === "undefined");
  return { items, error: swr.error as Error | undefined, loading: swr.isLoading, loadingMore: Boolean(loadingMore), done, loadMore: () => { if (!done && !loadingMore) void swr.setSize(swr.size + 1); }, retry: () => swr.mutate() };
}
