import { useMemo, useSyncExternalStore } from "react";
import useSWR from "swr";
import { keys } from "../api";
import { useGenres, usePage, useTitle, useTrending } from "../hooks";
import { useHistoryMap, useLists, useProfile, useRatings, useWatchlist } from "../store";
import { isKidsSafe } from "../kids";
import { useTaste } from "../tasteProfile";
import { playbackPlatform } from "../playback/registry";
import { healthVersion, subscribeHealth, suppressedSet } from "../playback/health";
import { getFeedback, subscribeFeedback } from "./feedback";
import { buildModel, type PreferenceModel } from "./model";
import { buildSections, discoveryGenres } from "./sections";
import { intelState, rerank, useSettledIntelVersion } from "../intel/runtime";
import type { ListPayload, PandaItem, TitleDetails } from "../types";

let fbVersion = 0;
subscribeFeedback(() => { fbVersion++; });

/**
 * Search's discovery rows for the active profile: Panda Top Picks, Recommended for you, Trending, Popular now,
 * Because you watched…, Hidden gems, genre discovery and Recently added. Everything is computed on the device.
 * Seed details and genre lists load after the trending list, so the first row never waits for them.
 */
export function useRecommendations() {
  const profile = useProfile();
  const kids = Boolean(profile?.kids);
  const taste = useTaste();
  const history = useHistoryMap();
  const watchlist = useWatchlist();
  const lists = useLists();
  const ratings = useRatings();
  const fbv = useSyncExternalStore(subscribeFeedback, () => fbVersion, () => fbVersion);
  const hv = useSyncExternalStore(subscribeHealth, healthVersion, healthVersion);
  const platform = useMemo(playbackPlatform, []);
  // settled per visit: background training never reshuffles the rows (or drops TV focus) while they are shown
  const iv = useSettledIntelVersion(profile?.id);

  const model = useMemo<PreferenceModel>(
    () => buildModel({ taste: kids ? null : taste, history, watchlist, lists, ratings, feedback: getFeedback(profile?.id) }),
    // fbv: feedback store version
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kids, taste, history, watchlist, lists, ratings, profile?.id, fbv]
  );

  const trending = useTrending("all", "day");
  const popular = useTrending("all", "week");
  const home = usePage(kids ? "kids" : "home");
  const ready = Boolean(trending.data || trending.error);
  const s0 = useSeed(model.seeds[0]?.item, ready), s1 = useSeed(model.seeds[1]?.item, ready), s2 = useSeed(model.seeds[2]?.item, ready), s3 = useSeed(model.seeds[3]?.item, ready);
  const genres = useGenres().data;
  const want = useMemo(() => discoveryGenres(model), [model]);
  const gid = (name: string | undefined) => (name ? genres?.movie.find((g) => g.name === name)?.id ?? null : null);
  const g0 = useGenreList(ready ? gid(want[0]) : null), g1 = useGenreList(ready ? gid(want[1]) : null);

  const result = useMemo(() => {
    const allow = kids ? isKidsSafe : undefined;
    const seedDetails = [s0, s1, s2, s3];
    const similar = model.seeds.slice(0, 4).map((seed, n) => ({ seed, items: seedDetails[n]?.moreLikeThis ?? [] })).filter((x) => x.items.length);
    const rails = (home.data?.rails ?? []).map((r) => ({ id: r.id, items: r.items }));
    const recent = (home.data?.rails ?? []).filter((r) => r.id === "new" || r.id === "latest-tv").flatMap((r) => r.items);
    const genreLists = [[want[0], g0], [want[1], g1]].filter((x): x is [string, PandaItem[]] => Boolean(x[0] && x[1]?.length)).map(([genre, items]) => ({ genre, items }));
    return buildSections({
      model, suppressed: suppressedSet(platform), allow, name: profile?.name,
      similar, trending: trending.data?.results, popular: popular.data?.results, rails, recent, genreLists,
      rerank: intelState() ? (l) => rerank(l) : undefined
    });
    // hv: playback health version; iv: on-device model version
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, s0, s1, s2, s3, g0, g1, want, home.data, trending.data, popular.data, kids, platform, profile?.name, hv, iv]);

  return {
    ...result, model,
    loading: !trending.data && !trending.error,
    error: (trending.error ?? null) as Error | null,
    retry: () => { void trending.mutate(); void popular.mutate(); }
  };
}

function useSeed(item: PandaItem | undefined, ready: boolean): TitleDetails | undefined {
  return useTitle(ready && item ? item.type : null, ready && item ? item.tmdbId : null).data;
}

function useGenreList(id: number | null): PandaItem[] | undefined {
  return useSWR<ListPayload>(id ? keys.discover("movie", { genre: String(id) }) : null, { revalidateOnFocus: false }).data?.results;
}
