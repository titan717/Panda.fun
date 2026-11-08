import { useMemo } from "react";
import { usePage, useTitle, useTop10 } from "./hooks";
import { buildPersonalRows, pickSeeds, type Seed } from "./personal";
import { continueWatching, useHistoryMap, usePrefs, useProfile, useRatings, useWatchlist, watchedTitles, type HistoryEntry } from "./store";
import { languageName } from "./format";
import { useCalendarItems } from "./badges";
import type { PageKind, PandaItem, TitleDetails } from "./types";

export type HomeRow =
  | { id: string; kind: "poster" | "landscape"; title: string; items: PandaItem[]; link: string | null }
  | { id: string; kind: "top10"; title: string; items: PandaItem[]; link: null; lang: string }
  | { id: string; kind: "continue"; title: string; entries: HistoryEntry[]; link: string };

const KIDS_GENRES = new Set(["Animation", "Family", "Kids"]);
export const isKidsSafe = (i: PandaItem) => i.genres.some((g) => KIDS_GENRES.has(g));
/** Ratings that are never suitable for a Kids profile, across US film/TV, UK, India and common numeric systems. */
const MATURE = /^(R|NC-17|X|TV-MA|TV-14|PG-13|15|16|18|18\+|A|UA 16\+|R18|MA15\+|MA|M18|NC16)$/i;
/** Full check once the details (with certification) are known. */
export const isKidsSafeTitle = (d: Pick<TitleDetails, "genres" | "certification">) =>
  d.genres.some((g) => KIDS_GENRES.has(g)) && !(d.certification && MATURE.test(d.certification.trim()));

/** Rows for Home/Movies/TV/New & Hot (BLUEPRINT_SPEC 6.7, 12.3). Kids profiles get the kids page and kid-safe history only. */
export function useHomeRows(kind: PageKind) {
  const profile = useProfile();
  const prefs = usePrefs();
  const kids = Boolean(profile?.kids);
  const effective: PageKind = kids && kind === "home" ? "kids" : kind;
  const page = usePage(effective);
  const top10 = useTop10(prefs.top10Lang);
  const history = useHistoryMap();
  const watchlist = useWatchlist();
  const ratings = useRatings();
  const calendar = useCalendarItems();

  // Personal rows only on Home for grown-up profiles; seed details load after the page so they never delay it.
  const personal = kind === "home" && !kids;
  const seeds = useMemo<Seed[]>(() => (personal ? pickSeeds(history, watchlist, ratings) : []), [personal, history, watchlist, ratings]);
  const seedKey = seeds.map((s) => s.item.id).join(",");
  const ready = Boolean(page.data);
  const s0 = useSeedTitle(seeds[0], ready), s1 = useSeedTitle(seeds[1], ready), s2 = useSeedTitle(seeds[2], ready), s3 = useSeedTitle(seeds[3], ready), s4 = useSeedTitle(seeds[4], ready);
  const mine = useMemo(() => {
    const exclude = new Set<string>([...Object.keys(history), ...watchlist.map((i) => i.id)]);
    return buildPersonalRows(seeds, [s0, s1, s2, s3, s4], exclude, ratings);
    // seedKey stands in for seeds
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey, s0, s1, s2, s3, s4, history, watchlist, ratings]);

  const rows = useMemo<HomeRow[]>(() => {
    const out: HomeRow[] = [];
    const typeFilter = (i: PandaItem) => (kind === "movies" ? i.type === "movie" : kind === "tv" ? i.type === "tv" : true) && (!kids || isKidsSafe(i));
    const cw = continueWatching(history).filter((h) => typeFilter(h.item));
    if (cw.length && kind !== "new") out.push({ id: "continue", kind: "continue", title: `Continue Watching for ${profile?.name ?? "You"}`, entries: cw.slice(0, 20), link: "/continue-watching" });
    const notDisliked = (i: PandaItem) => ratings[i.id] !== "dislike";
    const because = mine.because.map((b, n): HomeRow => ({ id: `because-${n}`, kind: "poster", title: `Because You Watched ${b.seed.title}`, items: b.items, link: null }));
    if (kind === "home" && !kids) {
      if (mine.topPicks.length) out.push({ id: "top-picks", kind: "poster", title: `Top Picks for ${profile?.name ?? "You"}`, items: mine.topPicks, link: null });
      const t = (top10.data?.results ?? []).filter(notDisliked).slice(0, 10);
      if (t.length) out.push({ id: "top10", kind: "top10", title: `Top 10 in India Today - ${top10.data?.label ?? languageName(prefs.top10Lang)}`, items: t, link: null, lang: prefs.top10Lang });
      if (because[0]) out.push(because[0]);
      const watched = watchedTitles(history).filter((i) => i.type === "tv");
      if (watched.length >= 2) out.push({ id: "watched", kind: "poster", title: "Shows You Watched", items: watched.slice(0, 20), link: null });
    }
    if (kind === "new") {
      // the profile's own calendar first (Watchlist, reminders, shows in progress), then the editorial rails
      const fresh = calendar.fresh.filter(typeFilter);
      const upcoming = calendar.upcoming.filter(typeFilter);
      if (fresh.length) out.push({ id: "cal-fresh", kind: "poster", title: "New Episodes for You", items: fresh, link: "/calendar" });
      if (upcoming.length) out.push({ id: "cal-upcoming", kind: "poster", title: "Coming Up for You", items: upcoming, link: "/calendar" });
    }
    let rail = 0;
    for (const r of page.data?.rails ?? []) {
      const items = (kids ? r.items.filter(isKidsSafe) : r.items).filter(notDisliked);
      if (!items.length) continue;
      out.push({ id: r.id, kind: r.style === "landscape" ? "landscape" : "poster", title: r.title, items, link: r.link });
      if (++rail === 3 && because[1]) out.push(because[1]);
    }
    if (rail < 3 && because[1]) out.push(because[1]);
    return out;
  }, [history, kind, kids, page.data, profile?.name, prefs.top10Lang, top10.data, ratings, mine, calendar]);

  const hero = useMemo(() => (page.data?.hero ?? []).filter((i) => (!kids || isKidsSafe(i) || effective === "kids") && ratings[i.id] !== "dislike"), [page.data, kids, effective, ratings]);
  return { rows, hero, page };
}

/** Details of one seed title (its "More Like This" list), fetched once the page itself has loaded. */
function useSeedTitle(seed: Seed | undefined, ready: boolean) {
  return useTitle(ready && seed ? seed.item.type : null, ready && seed ? seed.item.tmdbId : null).data;
}

