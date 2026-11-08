import { useEffect, useMemo, useRef, useState } from "react";
import { useSearch as useQueryString } from "wouter";
import { useDebounced, useSearch, useTrending } from "./hooks";
import { actions, useProfile, useRecentSearches } from "./store";
import { isKidsSafe } from "./rows";
import { listen, voiceSupported } from "./voice";
import { toast } from "../components/ui";
import type { PandaItem } from "./types";

export type SearchFilter = "all" | "movie" | "tv";
export type SearchSort = "relevance" | "newest" | "rating";
export const SEARCH_SORTS: { id: SearchSort; label: string }[] = [{ id: "relevance", label: "Best match" }, { id: "newest", label: "Newest" }, { id: "rating", label: "Top rated" }];

/** Shared search state for TV and mobile (spec 8, 13): debounced live results, filters, recents, voice. */
export function useSearchState() {
  const qs = useQueryString();
  const initial = new URLSearchParams(qs).get("q") ?? "";
  const [query, setQuery] = useState(initial);
  const [filter, setFilter] = useState<SearchFilter>("all");
  const [genre, setGenre] = useState<string | null>(null);
  const [sort, setSort] = useState<SearchSort>("relevance");
  const debounced = useDebounced(query, 350);
  const search = useSearch(debounced);
  const trending = useTrending("all", "day");
  const recents = useRecentSearches();
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

  const popular = useMemo(() => (trending.data?.results ?? []).filter((i) => !profile?.kids || isKidsSafe(i)), [trending.data, profile?.kids]);

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
    popular, popularLoading: !trending.data && !trending.error,
    recents, commit, clearRecents: actions.clearRecentSearches,
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
