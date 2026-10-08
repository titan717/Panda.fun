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
  starts: number;
  completions: number;
  watchSeconds: number;
  uniqueUsers: number;
  uniqueSessions: number;
  completionRate: number;
  avgWatchSecondsPerSession: number;
};

export type AdminMetricKey = 'pageViews' | 'watchStarts' | 'searches' | 'completions' | 'watchSeconds';

export type DailyMetricRow = {
  key: string;
  label: string;
  pageViews: number;
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

export function getAdminMetrics(events: AdminEvent[]): AdminMetrics {
  const pageViews = events.filter((event) => event.type === 'page_view').length;
  const searches = events.filter((event) => event.type === 'search').length;
  const starts = events.filter((event) => event.type === 'watch_start' || event.type === 'episode_start').length;
  const completions = events.filter((event) => event.type === 'watch_complete').length;
  const watchSeconds = events
    .filter((event) => event.type === 'watch_progress')
    .reduce((sum, event) => sum + Math.max(0, Number(event.durationSeconds) || 0), 0);
  const uniqueUsers = new Set(events.map((event) => event.uid).filter(Boolean)).size;
  const uniqueSessions = new Set(events.map((event) => event.sessionId).filter(Boolean)).size;

  return {
    pageViews,
    searches,
    starts,
    completions,
    watchSeconds,
    uniqueUsers,
    uniqueSessions,
    completionRate: starts ? (completions / starts) * 100 : 0,
    avgWatchSecondsPerSession: uniqueSessions ? watchSeconds / uniqueSessions : 0,
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
    .sort((a, b) => (b.opens * 1000 + b.watchSeconds) - (a.opens * 1000 + a.watchSeconds))
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
      watchStarts: 0,
      searches: 0,
      completions: 0,
      watchSeconds: 0,
    };
  });

  const byDay = new Map(output.map((row) => [row.key, row]));
  for (const event of events) {
    if (!event.clientTimestamp) continue;
    const key = new Date(event.clientTimestamp).toISOString().slice(0, 10);
    const row = byDay.get(key);
    if (!row) continue;
    if (event.type === 'page_view') row.pageViews += 1;
    if (event.type === 'search') row.searches += 1;
    if (event.type === 'watch_start' || event.type === 'episode_start') row.watchStarts += 1;
    if (event.type === 'watch_complete') row.completions += 1;
    if (event.type === 'watch_progress') row.watchSeconds += Math.max(0, Number(event.durationSeconds) || 0);
  }

  return output;
}
