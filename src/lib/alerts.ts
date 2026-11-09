import { api } from "./api";
import { alertSub, buildCalendar, dayStart, followedIds, localDay } from "./calendar";
import { showNotification } from "./notify";
import { actions, getActiveData, getState } from "./store";
import { compareVersions, fetchLatestRelease, installedVersion } from "./updates";

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

/** Background check for a new app release, shown once per release as a system notification. */
export async function runReleaseNotice(signal: AbortSignal) {
  try {
    const r = await fetchLatestRelease(signal);
    if (compareVersions(r.version, installedVersion()) > 0 && getState().prefs.notifiedTag !== r.tag) {
      showNotification({ tag: `update-${r.tag}`, title: "Panda.fun update available", body: `Version ${r.version} is ready to install.`, path: "/settings/updates" });
      actions.setPrefs({ notifiedTag: r.tag });
    }
  } catch { /* offline or rate-limited: try again next launch */ }
}
