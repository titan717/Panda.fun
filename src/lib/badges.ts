import { useSyncExternalStore } from "react";
import type { PandaItem } from "./types";

/**
 * Calendar results shared with cards and New & Hot (v1.1.7). Kept tiny and free of the calendar logic so it can live
 * in the entry chunk; `components/CalendarSync` (lazy) fills it from GET /panda/calendar.
 */
interface CalendarShare { badges: ReadonlyMap<string, string>; fresh: PandaItem[]; upcoming: PandaItem[] }
let share: CalendarShare = { badges: new Map(), fresh: [], upcoming: [] };
const subs = new Set<() => void>();

const sameIds = (a: PandaItem[], b: PandaItem[]) => a.length === b.length && a.every((x, i) => x.id === b[i]!.id);

export function setCalendarShare(next: CalendarShare) {
  const same = next.badges.size === share.badges.size && [...next.badges].every(([k, v]) => share.badges.get(k) === v)
    && sameIds(next.fresh, share.fresh) && sameIds(next.upcoming, share.upcoming);
  if (same) return;
  share = next;
  for (const f of subs) f();
}
export function setCalendarBadges(badges: Map<string, string>) { setCalendarShare({ ...share, badges }); }
export function getCalendarBadge(id: string) { return share.badges.get(id) ?? null; }
function subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }

/** Calendar badge for one title ("NEW EPISODE", "2 NEW EPISODES", "OUT NOW"), or null. */
export function useCalendarBadge(id: string) {
  return useSyncExternalStore(subscribe, () => getCalendarBadge(id), () => null);
}
/** Followed titles with fresh episodes / upcoming dates, one card per title. */
export function useCalendarItems() {
  return useSyncExternalStore(subscribe, () => share, () => share);
}
