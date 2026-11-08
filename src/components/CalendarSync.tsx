import { useEffect } from "react";
import { calendarBadges, uniqueItems, useCalendar } from "../lib/calendar";
import { setCalendarShare } from "../lib/badges";

/** Lazy: loads the calendar for the active profile and shares badges and rows (lib/badges). */
export default function CalendarSync() {
  const { fresh, upcoming } = useCalendar();
  useEffect(() => { setCalendarShare({ badges: calendarBadges(fresh), fresh: uniqueItems(fresh), upcoming: uniqueItems(upcoming) }); }, [fresh, upcoming]);
  return null;
}
