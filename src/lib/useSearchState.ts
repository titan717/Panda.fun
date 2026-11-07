import { useEffect, useMemo, useRef, useState } from "react";
import { useSearch as useQueryString } from "wouter";
import { useDebounced, useSearch, useTrending } from "./hooks";
import { actions, useProfile, useRecentSearches } from "./store";
import { isKidsSafe } from "./rows";
import { listen, voiceSupported } from "./voice";
import { toast } from "../components/ui";

export type SearchFilter = "all" | "movie" | "tv";

/** Shared search state for TV and mobile (spec 8, 13): debounced live results, filters, recents, voice. */
export function useSearchState() {
  const qs = useQueryString();
  const initial = new URLSearchParams(qs).get("q") ?? "";
  const [query, setQuery] = useState(initial);
  const [filter, setFilter] = useState<SearchFilter>("all");
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

  const results = useMemo(() => {
    const list = search.data?.results ?? [];
    return list.filter((i) => (filter === "all" || i.type === filter) && (!profile?.kids || isKidsSafe(i)));
  }, [search.data, filter, profile?.kids]);

  const popular = useMemo(() => (trending.data?.results ?? []).filter((i) => !profile?.kids || isKidsSafe(i)), [trending.data, profile?.kids]);

  const active = debounced.trim().length >= 2;
  const commit = (q = query) => { if (q.trim().length >= 2) actions.addRecentSearch(q); };
  const startVoice = () => {
    stop.current();
    stop.current = listen((t) => setQuery(t), setListening, (m) => toast(m));
  };

  return {
    query, setQuery, filter, setFilter, debounced, active,
    results, loading: active && !search.data && !search.error, error: search.error, retry: () => search.mutate(),
    stale: active && search.data?.query !== debounced.trim(),
    popular, popularLoading: !trending.data && !trending.error,
    recents, commit, clearRecents: actions.clearRecentSearches,
    voiceSupported, listening, startVoice
  };
}
