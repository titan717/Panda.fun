import { Suspense, lazy, useEffect, useState } from "react";

const CalendarSync = lazy(() => import("./CalendarSync"));

/** Starts the calendar sync a few seconds after launch so it never competes with the first screen. */
export function CalendarBadgeSync() {
  const [on, setOn] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setOn(true), 2500); return () => window.clearTimeout(t); }, []);
  return on ? <Suspense fallback={null}><CalendarSync /></Suspense> : null;
}
