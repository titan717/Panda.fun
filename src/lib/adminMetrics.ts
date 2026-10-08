export type AdminEvent = {
  id: string;
  type: string;
  uid?: string;
  userEmail?: string | null;
  path?: string;
  animeId?: string;
  animeTitle?: string;
  episodeId?: string;
  episodeNumber?: string;
  durationSeconds?: number;
  sessionId?: string;
  clientTimestamp?: number;
};

export type AdminMetrics = {
  pageViews: number;
  searches: number;
  contentSelections: number;
  starts: number;
  completions: number;
  watchSeconds: number;
  uniqueUsers: number;
  uniqueSessions: number;
  completionRate: number;
  selectionToStartRate: number;
  searchToSelectionRate: number;
  avgWatchSecondsPerSession: number;
  viewsPerSession: number;
  liveSessions: number;
  liveUsers: number;
};

export type AdminMetricKey =
  | 'pageViews'
  | 'uniqueUsers'
  | 'uniqueSessions'
  | 'contentSelections'
  | 'watchStarts'
  | 'searches'
  | 'completions'
  | 'watchSeconds';

export type DailyMetricRow = {
  key: string;
  label: string;
  pageViews: number;
  uniqueUsers: number;
  uniqueSessions: number;
  contentSelections: number;
  watchStarts: number;
  searches: number;
  completions: number;
  watchSeconds: number;
};

export type TopContentRow = {
  key: string;
  title: string;
  opens: number;
  watchSeconds: number;
};

export const ADMIN_METRICS: Array<{ key: AdminMetricKey; label: string; shortLabel: string }> = [
  { key: 'pageViews', label: 'Page views', shortLabel: 'Views' },
  { key: 'uniqueUsers', label: 'Unique users', shortLabel: 'Users' },
  { key: 'uniqueSessions', label: 'Sessions', shortLabel: 'Sessions' },
  { key: 'contentSelections', label: 'Content opens', shortLabel: 'Opens' },
  { key: 'watchStarts', label: 'Watch starts', shortLabel: 'Starts' },
  { key: 'searches', label: 'Searches', shortLabel: 'Search' },
  { key: 'completions', label: 'Completions', shortLabel: 'Complete' },
  { key: 'watchSeconds', label: 'Watch time', shortLabel: 'Watch time' },
];

export function getMetricLabel(key: AdminMetricKey): string {
  return ADMIN_METRICS.find((metric) => metric.key === key)?.label || key;
}

export function getMetricValue(row: DailyMetricRow, key: AdminMetricKey): number {
  return Math.max(0, Number(row[key]) || 0);
}

export function formatAdminDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  if (hours) return minutes ? hours + 'h ' + minutes + 'm' : hours + 'h';
  if (minutes) return remaining ? minutes + 'm ' + remaining + 's' : minutes + 'm';
  return remaining + 's';
}

function ratio(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0;
}

export function getAdminMetrics(events: AdminEvent[]): AdminMetrics {
  const pageViews = events.filter((event) => event.type === 'page_view').length;
  const searches = events.filter((event) => event.type === 'search').length;
  const contentSelections = events.filter((event) => event.type === 'content_select').length;
  const starts = events.filter((event) => event.type === 'watch_start' || event.type === 'episode_start').length;
  const completions = events.filter((event) => event.type === 'watch_complete').length;
  const watchSeconds = events
    .filter((event) => event.type === 'watch_progress')
    .reduce((sum, event) => sum + Math.max(0, Number(event.durationSeconds) || 0), 0);
  const uniqueUsers = new Set(events.map((event) => event.uid).filter(Boolean)).size;
  const uniqueSessions = new Set(events.map((event) => event.sessionId).filter(Boolean)).size;
  const liveCutoff = Date.now() - 15 * 60 * 1000;
  const liveEvents = events.filter((event) => Number(event.clientTimestamp || 0) >= liveCutoff);
  const liveSessions = new Set(liveEvents.map((event) => event.sessionId).filter(Boolean)).size;
  const liveUsers = new Set(liveEvents.map((event) => event.uid).filter(Boolean)).size;

  return {
    pageViews,
    searches,
    contentSelections,
    starts,
    completions,
    watchSeconds,
    uniqueUsers,
    uniqueSessions,
    completionRate: ratio(completions, starts),
    selectionToStartRate: ratio(starts, contentSelections),
    searchToSelectionRate: ratio(contentSelections, searches),
    avgWatchSecondsPerSession: uniqueSessions ? watchSeconds / uniqueSessions : 0,
    viewsPerSession: uniqueSessions ? pageViews / uniqueSessions : 0,
    liveSessions,
    liveUsers,
  };
}

export function getTopContent(events: AdminEvent[], limit = 10): TopContentRow[] {
  const rows = new Map<string, TopContentRow>();

  for (const event of events) {
    const key = event.animeId || event.animeTitle;
    if (!key) continue;

    const row = rows.get(key) || {
      key,
      title: event.animeTitle || key,
      opens: 0,
      watchSeconds: 0,
    };

    if (event.type === 'anime_open' || event.type === 'episode_start' || event.type === 'watch_start' || event.type === 'content_select') {
      row.opens += 1;
    }
    if (event.type === 'watch_progress') {
      row.watchSeconds += Math.max(0, Number(event.durationSeconds) || 0);
    }
    rows.set(key, row);
  }

  return [...rows.values()]
    .sort((a, b) => (b.watchSeconds - a.watchSeconds) || (b.opens - a.opens))
    .slice(0, Math.max(1, limit));
}

export function getRecentDays(events: AdminEvent[], days: number): DailyMetricRow[] {
  const count = Math.max(1, Math.floor(days));
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const output = Array.from({ length: count }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (count - index - 1));
    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      pageViews: 0,
      uniqueUsers: 0,
      uniqueSessions: 0,
      contentSelections: 0,
      watchStarts: 0,
      searches: 0,
      completions: 0,
      watchSeconds: 0,
    };
  });

  const byDay = new Map(output.map((row) => [row.key, row]));
  const usersByDay = new Map<string, Set<string>>();
  const sessionsByDay = new Map<string, Set<string>>();

  for (const event of events) {
    if (!event.clientTimestamp) continue;
    const key = new Date(event.clientTimestamp).toISOString().slice(0, 10);
    const row = byDay.get(key);
    if (!row) continue;

    if (event.type === 'page_view') row.pageViews += 1;
    if (event.type === 'content_select') row.contentSelections += 1;
    if (event.type === 'search') row.searches += 1;
    if (event.type === 'watch_start' || event.type === 'episode_start') row.watchStarts += 1;
    if (event.type === 'watch_complete') row.completions += 1;
    if (event.type === 'watch_progress') row.watchSeconds += Math.max(0, Number(event.durationSeconds) || 0);

    if (event.uid) {
      const set = usersByDay.get(key) || new Set<string>();
      set.add(event.uid);
      usersByDay.set(key, set);
    }
    if (event.sessionId) {
      const set = sessionsByDay.get(key) || new Set<string>();
      set.add(event.sessionId);
      sessionsByDay.set(key, set);
    }
  }

  return output.map((row) => ({
    ...row,
    uniqueUsers: usersByDay.get(row.key)?.size || 0,
    uniqueSessions: sessionsByDay.get(row.key)?.size || 0,
  }));
}

export function getDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
