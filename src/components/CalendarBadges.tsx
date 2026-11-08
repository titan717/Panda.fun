import { useEffect, useState, useSyncExternalStore } from "react";
import { calendarBadges, getCalendarBadge, setCalendarBadges, subscribeCalendarBadges, useCalendar } from "../lib/calendar";

/** Keeps the card badge map in step with the calendar. Mounted once, a few seconds after start so it never competes with the first screen. */
export function CalendarBadgeSync() {
  const [on, setOn] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setOn(true), 2500); return () => window.clearTimeout(t); }, []);
  return on ? <Sync /> : null;
}

function Sync() {
  const { fresh } = useCalendar();
  useEffect(() => { setCalendarBadges(calendarBadges(fresh)); }, [fresh]);
  return null;
}

/** Calendar badge for one title, or null. */
export function useCalendarBadge(id: string) {
  return useSyncExternalStore(subscribeCalendarBadges, () => getCalendarBadge(id), () => null);
}
