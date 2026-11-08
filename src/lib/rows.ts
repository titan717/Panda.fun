import { useMemo } from "react";
import { usePage, useTop10 } from "./hooks";
import { continueWatching, useHistoryMap, usePrefs, useProfile, watchedTitles, type HistoryEntry } from "./store";
import { languageName } from "./format";
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

  const rows = useMemo<HomeRow[]>(() => {
    const out: HomeRow[] = [];
    const typeFilter = (i: PandaItem) => (kind === "movies" ? i.type === "movie" : kind === "tv" ? i.type === "tv" : true) && (!kids || isKidsSafe(i));
    const cw = continueWatching(history).filter((h) => typeFilter(h.item));
    if (cw.length && kind !== "new") out.push({ id: "continue", kind: "continue", title: `Continue Watching for ${profile?.name ?? "You"}`, entries: cw.slice(0, 20), link: "/continue-watching" });
    if (kind === "home" && !kids) {
      const watched = watchedTitles(history).filter((i) => i.type === "tv");
      if (watched.length >= 2) out.push({ id: "watched", kind: "poster", title: "Shows You Watched", items: watched.slice(0, 20), link: null });
      const t = top10.data?.results.slice(0, 10) ?? [];
      if (t.length) out.push({ id: "top10", kind: "top10", title: `Top 10 in India Today - ${top10.data?.label ?? languageName(prefs.top10Lang)}`, items: t, link: null, lang: prefs.top10Lang });
    }
    for (const r of page.data?.rails ?? []) {
      const items = kids ? r.items.filter(isKidsSafe) : r.items;
      if (items.length) out.push({ id: r.id, kind: r.style === "landscape" ? "landscape" : "poster", title: r.title, items, link: r.link });
    }
    return out;
  }, [history, kind, kids, page.data, profile?.name, prefs.top10Lang, top10.data]);

  const hero = useMemo(() => (page.data?.hero ?? []).filter((i) => !kids || isKidsSafe(i) || effective === "kids"), [page.data, kids, effective]);
  return { rows, hero, page };
}
