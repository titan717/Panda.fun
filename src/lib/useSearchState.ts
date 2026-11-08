import { useEffect, useMemo, useRef, useState } from "react";
import { useSearch as useQueryString } from "wouter";
import { useDebounced, useSearch, useTrending } from "./hooks";
import useSWR from "swr";
import { keys } from "./api";
import { actions, usePrefs, useProfile, useRecentSearches, useRecentTitles } from "./store";
import { isNew, isUpcoming } from "./format";
import { isKidsSafe } from "./rows";
import { listen, voiceSupported } from "./voice";
import { toast } from "../components/ui";
import type { PandaItem, Top10Payload } from "./types";

export type SearchFilter = "all" | "movie" | "tv";
/** "Popular Searches in" tabs (blueprint 13.3, TV 8.x). */
export type PopularTab = "india" | "new" | "movie" | "tv" | "all";
export const POPULAR_TABS: { id: PopularTab; label: string; icon: "trend" | "flame" | "movie" | "tv" }[] = [
  { id: "india", label: "India", icon: "trend" }, { id: "new", label: "Hot & New", icon: "flame" }, { id: "movie", label: "Movies", icon: "movie" }, { id: "tv", label: "Shows", icon: "tv" }
];
export type SearchSort = "relevance" | "newest" | "rating";
export const SEARCH_SORTS: { id: SearchSort; label: string }[] = [{ id: "relevance", label: "Best match" }, { id: "newest", label: "Newest" }, { id: "rating", label: "Top rated" }];

/** Shared search state for TV and mobile (spec 8, 13): debounced live results, filters, recents, voice. */
export function useSearchState(defaultTab: PopularTab = "india") {
  const qs = useQueryString();
  const initial = new URLSearchParams(qs).get("q") ?? "";
  const [query, setQuery] = useState(initial);
  const [filter, setFilter] = useState<SearchFilter>("all");
  const [genre, setGenre] = useState<string | null>(null);
  const [sort, setSort] = useState<SearchSort>("relevance");
  const debounced = useDebounced(query, 350);
  const search = useSearch(debounced);
  const [popularTab, setPopularTab] = useState<PopularTab>(defaultTab);
  const trending = useTrending(popularTab === "movie" || popularTab === "tv" ? popularTab : "all", popularTab === "new" ? "week" : "day");
  // India: the Top 10 for the profile's Top 10 language and for Hindi, merged (backend /panda/top10/:lang)
  const lang = usePrefs().top10Lang;
  const indiaA = useSWR<Top10Payload>(popularTab === "india" ? keys.top10(lang) : null, { revalidateOnFocus: false });
  const indiaB = useSWR<Top10Payload>(popularTab === "india" && lang !== "hi" ? keys.top10("hi") : null, { revalidateOnFocus: false });
  const recents = useRecentSearches();
  const recentTitles = useRecentTitles();
  const profile = useProfile();
  const [listening, setListening] = useState(false);
  const stop = useRef<() => void>(() => {});

  useEffect(() => {
    // keep the URL shareable without adding history entries
    const url = new URL(window.location.href);
    if (debounced.trim()) url.searchParams.set("q", debounced.trim()); else url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);
  }, [debounced]);

  useEffect(() => () => stop.current(), []);

  // a new query starts with every filter cleared
  useEffect(() => { setGenre(null); setSort("relevance"); }, [debounced]);

  const base = useMemo(() => (search.data?.results ?? []).filter((i) => (filter === "all" || i.type === filter) && (!profile?.kids || isKidsSafe(i))), [search.data, filter, profile?.kids]);
  /** Genres present in the results, most common first (at most six). */
  const genres = useMemo(() => {
    const n = new Map<string, number>();
    for (const i of base) for (const g of i.genres) n.set(g, (n.get(g) ?? 0) + 1);
    return [...n.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g]) => g);
  }, [base]);
  const results = useMemo(() => sortResults(genre ? base.filter((i) => i.genres.includes(genre)) : base, sort), [base, genre, sort]);

  const popular = useMemo(() => {
    const source = popularTab === "india"
      ? [...(indiaA.data?.results ?? []), ...(indiaB.data?.results ?? [])].filter((i, n, all) => all.findIndex((x) => x.id === i.id) === n)
      : trending.data?.results ?? [];
    const list = source.filter((i) => !profile?.kids || isKidsSafe(i));
    // Hot & New: this week's trending titles released in the last 90 days or still to come
    if (popularTab !== "new") return list;
    const fresh = list.filter((i) => isNew(i, 90) || isUpcoming(i));
    return fresh.length >= 6 ? fresh : list;
  }, [trending.data, indiaA.data, indiaB.data, profile?.kids, popularTab]);

  const active = debounced.trim().length >= 2;
  const commit = (q = query) => { if (q.trim().length >= 2) actions.addRecentSearch(q); };
  const startVoice = () => {
    stop.current();
    stop.current = listen((t) => setQuery(t), setListening, (m) => toast(m));
  };

  return {
    query, setQuery, filter, setFilter, debounced, active,
    genre, setGenre, genres, sort, setSort,
    interpreted: search.data?.query === debounced.trim() ? search.data?.interpreted ?? null : null,
    corrected: search.data?.query === debounced.trim() ? search.data?.corrected ?? null : null,
    people: search.data?.query === debounced.trim() ? search.data?.people ?? [] : [],
    results, loading: active && !search.data && !search.error, error: search.error, retry: () => search.mutate(),
    stale: active && search.data?.query !== debounced.trim(),
    popular,
    popularLoading: popularTab === "india" ? !indiaA.data && !indiaA.error : !trending.data && !trending.error,
    popularError: (popularTab === "india" ? indiaA.error : trending.error) as Error | undefined,
    retryPopular: () => { void (popularTab === "india" ? indiaA.mutate() : trending.mutate()); },
    popularTab, setPopularTab,
    recents, recentTitles, openTitle: (item: PandaItem) => { commit(); actions.addRecentTitle(item); },
    commit, clearRecents: actions.clearRecentSearches,
    voiceSupported, listening, startVoice
  };
}

/** Client-side sort of search results; "Best match" keeps the backend order. */
export function sortResults(list: PandaItem[], sort: SearchSort) {
  if (sort === "relevance") return list;
  const out = [...list];
  if (sort === "newest") out.sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""));
  else out.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  return out;
}
