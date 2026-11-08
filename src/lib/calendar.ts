import { useMemo } from "react";
import useSWR from "swr";
import { keys } from "./api";
import { episodeProgress, selectData, useStore, type HistoryEntry } from "./store";
import { titlePath, watchPath } from "./format";
import type { CalendarEntry, CalendarPayload, PandaItem } from "./types";

/**
 * Release calendar and new-episode alerts (v1.1.7, DECISIONS D-87–D-90).
 * Everything is worked out on the device from the profile's own Watchlist, reminders and history;
 * the backend only answers "what aired / airs for these ids" (GET /panda/calendar).
 */

/** The backend accepts at most 40 ids per request (movieapi CALENDAR_MAX). */
export const CALENDAR_MAX = 40;
/** An aired episode or release stays in "Out Now" this many days. */
export const FRESH_DAYS = 14;
/** Shows watched within this many days are followed even when they are not in the Watchlist. */
const HISTORY_DAYS = 180;
/** Upcoming episodes listed per show (weekly shows would otherwise fill the page). */
const UPCOMING_PER_SHOW = 4;
const UPCOMING_MAX = 60;
const DAY = 86_400_000;

export interface Alert {
  /** Stable id: "tv:1399:2:5" for an episode, "movie:550:release" for a film. */
  key: string;
  item: PandaItem;
  kind: "episode" | "release";
  season: number | null;
  episode: number | null;
  name: string | null;
  /** YYYY-MM-DD (TMDB air or release date). */
  airDate: string;
  still: string | null;
  aired: boolean;
  /** Aired episodes open the player; everything else opens the title page. */
  href: string;
}

export interface CalendarView { fresh: Alert[]; upcoming: Alert[] }

/** Local calendar day as YYYY-MM-DD (TMDB dates have no time zone). */
export function localDay(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Local midnight of a YYYY-MM-DD date, in ms. */
export function dayStart(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).getTime();
}

const addDays = (iso: string, n: number) => localDay(dayStart(iso) + n * DAY + DAY / 2);

interface Followed { watchlist: PandaItem[]; reminders: PandaItem[]; history: Record<string, HistoryEntry> }

/**
 * Ids the profile follows, most relevant first: reminders, shows watched recently, then Watchlist
 * shows and Watchlist films that are out soon or just came out. Capped at CALENDAR_MAX.
 */
export function followedIds(d: Followed, now = Date.now()) {
  const today = localDay(now);
  const out: string[] = [];
  const add = (id: string) => { if (!out.includes(id)) out.push(id); };
  for (const r of d.reminders) add(r.id);
  Object.values(d.history)
    .filter((h) => h.item.type === "tv" && now - h.updatedAt < HISTORY_DAYS * DAY)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .forEach((h) => add(h.item.id));
  for (const w of d.watchlist) {
    if (w.type === "tv") add(w.id);
    else if (w.releaseDate && w.releaseDate >= addDays(today, -FRESH_DAYS)) add(w.id);
  }
  return out.filter((id) => /^(movie|tv):\d+$/.test(id)).slice(0, CALENDAR_MAX);
}

/** Turn calendar entries into "Out Now" alerts and the upcoming list. */
export function buildCalendar(entries: CalendarEntry[], d: Followed, now = Date.now()): CalendarView {
  const today = localDay(now);
  const freshFrom = addDays(today, -FRESH_DAYS);
  const fresh: Alert[] = [];
  const upcoming: Alert[] = [];
  const watchlisted = new Set(d.watchlist.map((i) => i.id));
  const reminded = new Set(d.reminders.map((i) => i.id));
  for (const e of entries) {
    const it = e.item;
    const h = d.history[it.id] ?? null;
    if (it.type === "tv") {
      let ahead = 0;
      for (const ep of [...e.episodes].sort((a, b) => a.airDate.localeCompare(b.airDate) || a.season - b.season || a.episode - b.episode)) {
        const base = { key: `${it.id}:${ep.season}:${ep.episode}`, item: it, kind: "episode" as const, season: ep.season, episode: ep.episode, name: ep.name, airDate: ep.airDate, still: ep.still ?? it.backdrop };
        if (ep.airDate <= today) {
          if (ep.airDate < freshFrom || episodeProgress(h, ep.season, ep.episode)?.done) continue;
          fresh.push({ ...base, aired: true, href: watchPath("tv", it.tmdbId, ep.season, ep.episode) });
        } else if (ahead < UPCOMING_PER_SHOW) {
          ahead++;
          upcoming.push({ ...base, aired: false, href: titlePath(it) });
        }
      }
    } else {
      const date = it.releaseDate;
      if (!date) continue;
      const base = { key: `${it.id}:release`, item: it, kind: "release" as const, season: null, episode: null, name: null, airDate: date, still: it.backdrop };
      if (date > today) upcoming.push({ ...base, aired: false, href: titlePath(it) });
      else if (date >= freshFrom && (reminded.has(it.id) || watchlisted.has(it.id)) && !h?.completed) fresh.push({ ...base, aired: true, href: titlePath(it) });
    }
  }
  fresh.sort((a, b) => b.airDate.localeCompare(a.airDate) || a.item.title.localeCompare(b.item.title));
  upcoming.sort((a, b) => a.airDate.localeCompare(b.airDate) || a.item.title.localeCompare(b.item.title));
  return { fresh, upcoming: upcoming.slice(0, UPCOMING_MAX) };
}

/** Alerts that aired after the profile last opened Coming Up. */
export function unseen(fresh: Alert[], seenAt: number) {
  return fresh.filter((a) => dayStart(a.airDate) > seenAt);
}

/** "Today", "Tomorrow", "Yesterday", or "Fri 14 Nov". */
export function dayLabel(iso: string, now = Date.now()) {
  const diff = Math.round((dayStart(iso) - dayStart(localDay(now))) / DAY);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return new Date(dayStart(iso)).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace(",", "");
}

/** Card subtitle: "S2 E5 • The Thaw" for episodes, "Movie" for releases. */
export function alertSub(a: Alert) {
  if (a.kind === "release") return a.aired ? "Out now" : "Movie premiere";
  return [`S${a.season} E${a.episode}`, a.name && !/^Episode \d+$/i.test(a.name) ? a.name : null].filter(Boolean).join(" • ");
}

/** Group alerts by day, keeping their order. */
export function groupByDay(list: Alert[], now = Date.now()) {
  const groups: { day: string; label: string; items: Alert[] }[] = [];
  for (const a of list) {
    const g = groups[groups.length - 1];
    if (g && g.day === a.airDate) g.items.push(a);
    else groups.push({ day: a.airDate, label: dayLabel(a.airDate, now), items: [a] });
  }
  return groups;
}

const selectFollowed = (s: Parameters<typeof selectData>[0]) => selectData(s);

/** Calendar for the active profile, cached by SWR (and IndexedDB) like every other API path. */
export function useCalendar(enabled = true) {
  const data = useStore(selectFollowed);
  const ids = useMemo(() => followedIds(data), [data.watchlist, data.reminders, data.history]); // eslint-disable-line react-hooks/exhaustive-deps
  const key = enabled && ids.length ? keys.calendar(ids) : null;
  const res = useSWR<CalendarPayload>(key, { revalidateOnFocus: false, dedupingInterval: 600_000, keepPreviousData: true });
  const view = useMemo(() => buildCalendar(res.data?.entries ?? [], data), [res.data, data]);
  return { ...view, following: ids.length, loading: Boolean(key) && !res.data && !res.error, error: res.error as Error | undefined, retry: () => void res.mutate() };
}

/* ---------- card badges driven by the calendar (v1.1.7) ---------- */

type BadgeMap = ReadonlyMap<string, string>;
let badgeMap: BadgeMap = new Map();
const badgeSubs = new Set<() => void>();

/** Card badge per title id: "NEW EPISODE" / "2 NEW EPISODES" for shows with fresh episodes, "OUT NOW" for reminded films that just came out. */
export function calendarBadges(fresh: Alert[]): Map<string, string> {
  const counts = new Map<string, { n: number; kind: Alert["kind"] }>();
  for (const a of fresh) {
    const c = counts.get(a.item.id) ?? { n: 0, kind: a.kind };
    c.n++;
    counts.set(a.item.id, c);
  }
  const out = new Map<string, string>();
  for (const [id, c] of counts) out.set(id, c.kind === "release" ? "OUT NOW" : c.n > 1 ? `${c.n} NEW EPISODES` : "NEW EPISODE");
  return out;
}

export function setCalendarBadges(next: Map<string, string>) {
  const same = next.size === badgeMap.size && [...next].every(([k, v]) => badgeMap.get(k) === v);
  if (same) return;
  badgeMap = next;
  for (const f of badgeSubs) f();
}

export function subscribeCalendarBadges(f: () => void) { badgeSubs.add(f); return () => { badgeSubs.delete(f); }; }
export function getCalendarBadge(id: string) { return badgeMap.get(id) ?? null; }
