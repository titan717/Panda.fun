import useSWR, { type SWRConfiguration } from "swr";
import { useEffect, useState } from "react";
import { keys } from "./api";
import type { CategoriesPayload, GenresPayload, ListPayload, MediaType, PagePayload, PageKind, SearchPayload, SeasonDetails, TitleDetails, Top10Payload } from "./types";

const slow: SWRConfiguration = { revalidateOnFocus: false, dedupingInterval: 60_000 };

export const usePage = (kind: PageKind) => useSWR<PagePayload>(keys.page(kind), slow);
export const useTitle = (type: MediaType | null, id: number | null) => useSWR<TitleDetails>(type && id ? keys.title(type, id) : null, slow);
export const useSeason = (id: number | null, season: number | null) => useSWR<SeasonDetails>(id && season ? keys.season(id, season) : null, slow);
export const useTop10 = (lang: string) => useSWR<Top10Payload>(keys.top10(lang), slow);
export const useCategories = () => useSWR<CategoriesPayload>(keys.categories(), { ...slow, dedupingInterval: 3_600_000 });
export const useGenres = () => useSWR<GenresPayload>(keys.genres(), { ...slow, dedupingInterval: 3_600_000 });
export const useTrending = (type: "all" | MediaType = "all", window: "day" | "week" = "day") => useSWR<ListPayload>(keys.trending(type, window), slow);
export const useDiscover = (type: MediaType, o: Parameters<typeof keys.discover>[1]) => useSWR<ListPayload>(keys.discover(type, o), slow);
export const useSearch = (q: string) => useSWR<SearchPayload>(q.trim().length >= 2 ? keys.search(q.trim()) : null, { ...slow, keepPreviousData: true });

export function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function useOnline() {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

/** Fires `fn` once `active` has stayed true for `ms` (hero/detail trailer delays). */
export function useDwell(active: boolean, ms: number) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!active) { setDone(false); return; }
    const t = setTimeout(() => setDone(true), ms);
    return () => clearTimeout(t);
  }, [active, ms]);
  return done;
}

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const h = () => setM(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [q]);
  return m;
}

export const useReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");
