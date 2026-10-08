import { describe, expect, it } from 'vitest';
import {
  formatAdminDuration,
  getAdminMetrics,
  getRecentDays,
  getTopContent,
  getMetricLabel,
  getMetricValue, getDelta,
  type AdminEvent,
} from './adminMetrics';

describe('admin metrics', () => {
  const events: AdminEvent[] = [
    { id: '1', type: 'page_view', uid: 'u1', sessionId: 's1', clientTimestamp: Date.now() },
    { id: '2', type: 'page_view', uid: 'u1', sessionId: 's1', clientTimestamp: Date.now() },
    { id: '3', type: 'search', uid: 'u1', sessionId: 's1', clientTimestamp: Date.now() },
    { id: '4', type: 'watch_start', uid: 'u1', sessionId: 's1', clientTimestamp: Date.now() },
    { id: '5', type: 'episode_start', uid: 'u2', sessionId: 's2', clientTimestamp: Date.now() },
    { id: '6', type: 'watch_complete', uid: 'u1', sessionId: 's1', clientTimestamp: Date.now() },
    { id: '7', type: 'watch_progress', uid: 'u1', sessionId: 's1', durationSeconds: 90, clientTimestamp: Date.now() },
    { id: '8', type: 'watch_progress', uid: 'u2', sessionId: 's2', durationSeconds: 30, clientTimestamp: Date.now() },
  ];

  it('aggregates core dashboard metrics and completion rate', () => {
    expect(getAdminMetrics(events)).toMatchObject({
      pageViews: 2,
      searches: 1,
      contentSelections: 0,
      starts: 2,
      completions: 1,
      watchSeconds: 120,
      uniqueUsers: 2,
      uniqueSessions: 2,
      completionRate: 50,
      avgWatchSecondsPerSession: 60,
      selectionToStartRate: 0,
      searchToSelectionRate: 0,
      viewsPerSession: 1,
    });
  });

  it('builds a chart-ready daily series for every selected day', () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const timestamp = now.getTime();
    const daily = getRecentDays([
      { id: '1', type: 'page_view', uid: 'u1', sessionId: 's1', clientTimestamp: timestamp },
      { id: '2', type: 'search', uid: 'u1', sessionId: 's1', clientTimestamp: timestamp },
      { id: '3', type: 'watch_start', uid: 'u1', sessionId: 's1', clientTimestamp: timestamp },
      { id: '4', type: 'watch_progress', uid: 'u1', sessionId: 's1', durationSeconds: 90, clientTimestamp: timestamp },
      { id: '5', type: 'watch_complete', uid: 'u1', sessionId: 's1', clientTimestamp: timestamp },
    ], 3);

    expect(daily).toHaveLength(3);
    expect(daily.at(-1)).toMatchObject({
      pageViews: 1,
      uniqueUsers: 1,
      uniqueSessions: 1,
      contentSelections: 0,
      searches: 1,
      watchStarts: 1,
      completions: 1,
      watchSeconds: 90,
    });
    expect(getMetricLabel('watchSeconds')).toBe('Watch time');
    expect(getMetricValue(daily.at(-1)!, 'watchSeconds')).toBe(90);
  });

  it('ranks content using opens first and watch time as a tie breaker', () => {
    const rankingEvents: AdminEvent[] = [
      { id: '1', type: 'watch_start', animeId: 'a', animeTitle: 'Alpha', durationSeconds: 0 },
      { id: '2', type: 'watch_progress', animeId: 'a', animeTitle: 'Alpha', durationSeconds: 10 },
      { id: '3', type: 'watch_start', animeId: 'b', animeTitle: 'Beta', durationSeconds: 0 },
      { id: '4', type: 'watch_start', animeId: 'b', animeTitle: 'Beta', durationSeconds: 0 },
    ];

    expect(getTopContent(rankingEvents, 2).map((row) => row.title)).toEqual(['Beta', 'Alpha']);
  });

  it('formats durations without losing zero values', () => {
    expect(formatAdminDuration(0)).toBe('0s');
    expect(formatAdminDuration(61)).toBe('1m 1s');
    expect(formatAdminDuration(3660)).toBe('1h 1m');
  });

  it('builds a stable day series', () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const timestamp = now.getTime();

    const rows = getRecentDays([{ id: '1', type: 'page_view', clientTimestamp: timestamp }], 3);
    expect(rows).toHaveLength(3);
    expect(rows.at(-1)?.pageViews).toBe(1);
  });
});


describe('metric deltas', () => {
  it('returns percentage change and null when there is no baseline', () => {
    expect(getDelta(120, 100)).toBe(20);
    expect(getDelta(10, 0)).toBeNull();
  });
});
