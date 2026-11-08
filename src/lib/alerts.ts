import { api } from "./api";
import { alertSub, buildCalendar, dayStart, followedIds, localDay } from "./calendar";
import { showNotification } from "./notify";
import { actions, getActiveData } from "./store";

/**
 * One pass of new-episode and release notifications for the active profile (v1.1.7, spec 15.4).
 * Loaded on demand from App so the calendar logic stays out of the entry chunk.
 */
export async function runEpisodeAlerts(signal: AbortSignal) {
  const data = getActiveData();
  if (!data) return;
  const ids = followedIds(data);
  if (!ids.length) return;
  try {
    const res = await api.calendar(ids, signal);
    const { fresh } = buildCalendar(res.entries, data);
    const minDay = dayStart(localDay(Date.now() - 2 * 86_400_000));
    const sent = new Set(data.alerted);
    const due = fresh.filter((a) => !sent.has(a.key) && dayStart(a.airDate) >= minDay);
    if (due.length > 3) {
      showNotification({ tag: "panda-new", title: `${due.length} new episodes and releases`, body: [...new Set(due.map((a) => a.item.title))].slice(0, 4).join(", "), path: "/calendar" });
    } else {
      for (const a of due) showNotification({ tag: a.key, title: a.kind === "episode" ? `New episode of ${a.item.title}` : `${a.item.title} is out now`, body: alertSub(a), path: a.href });
    }
    if (fresh.length) actions.markAlerted(fresh.map((a) => a.key));
  } catch { /* offline: next tick */ }
}
