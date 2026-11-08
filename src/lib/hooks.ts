import useSWR, { type SWRConfiguration } from "swr";
import { useEffect, useState } from "react";
import { keys } from "./api";
import { usePrefs } from "./store";
import type { CategoriesPayload, Collection, GenresPayload, ListPayload, MediaType, PagePayload, PageKind, PersonDetails, SearchPayload, SeasonDetails, SourceHealthPayload, TitleDetails, Top10Payload, WallPayload } from "./types";

const slow: SWRConfiguration = { revalidateOnFocus: false, dedupingInterval: 60_000 };

export const usePage = (kind: PageKind) => useSWR<PagePayload>(keys.page(kind), slow);
export const useTitle = (type: MediaType | null, id: number | null) => useSWR<TitleDetails>(type && id ? keys.title(type, id) : null, slow);
export const useSeason = (id: number | null, season: number | null) => useSWR<SeasonDetails>(id && season ? keys.season(id, season) : null, slow);
export const usePerson = (id: number | null) => useSWR<PersonDetails>(id ? keys.person(id) : null, slow);
export const useCollection = (id: number | null) => useSWR<Collection>(id ? keys.collection(id) : null, slow);
export const useTop10 = (lang: string) => useSWR<Top10Payload>(keys.top10(lang), slow);
export const useCategories = () => useSWR<CategoriesPayload>(keys.categories(), { ...slow, dedupingInterval: 3_600_000 });
export const useGenres = () => useSWR<GenresPayload>(keys.genres(), { ...slow, dedupingInterval: 3_600_000 });
export const useWall = () => useSWR<WallPayload>(keys.wall(), { ...slow, dedupingInterval: 3_600_000 });
export const useTrending = (type: "all" | MediaType = "all", window: "day" | "week" = "day") => useSWR<ListPayload>(keys.trending(type, window), slow);
export const useDiscover = (type: MediaType, o: Parameters<typeof keys.discover>[1]) => useSWR<ListPayload>(keys.discover(type, o), slow);
export const useSearch = (q: string) => useSWR<SearchPayload>(q.trim().length >= 2 ? keys.search(q.trim()) : null, { ...slow, keepPreviousData: true });

/** Live source status from the backend, refreshed every minute while Settings › Sources is open. */
export const useSourceHealth = () => useSWR<SourceHealthPayload>(keys.sourceHealth(), { refreshInterval: 60_000, revalidateOnMount: true, dedupingInterval: 10_000 });

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

/** Reduced motion from the system setting or the profile's Settings › Display switch. */
export const useReducedMotion = () => {
  const system = useMediaQuery("(prefers-reduced-motion: reduce)");
  const pref = usePrefs().reduceMotion;
  return system || pref;
};

/**
 * Trailer timing (MASTER §4.B): after `delayS` seconds of uninterrupted focus the trailer plays;
 * from `preloadS` seconds before that it is created and buffering. Any focus change resets both.
 */
export function useTrailerStage(active: boolean, delayS: number, resetKey = "", preloadS = 3): "idle" | "preload" | "play" {
  const [stage, setStage] = useState<"idle" | "preload" | "play">("idle");
  useEffect(() => {
    setStage("idle");
    if (!active) return;
    const pre = Math.max(0, delayS - preloadS) * 1000;
    const t1 = setTimeout(() => setStage("preload"), pre);
    const t2 = setTimeout(() => setStage("play"), delayS * 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [active, delayS, resetKey, preloadS]);
  return stage;
}

/** Devices that should not run video trailers (low memory or data saver); they get a slow backdrop zoom. */
export function useLiteMotion() {
  const [lite] = useState(() => {
    if (typeof navigator === "undefined") return false;
    const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    return (n.deviceMemory !== undefined && n.deviceMemory <= 1) || n.connection?.saveData === true;
  });
  return lite;
}
