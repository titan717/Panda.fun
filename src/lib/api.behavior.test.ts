import { describe, expect, it, vi } from 'vitest';

describe('MovieApi cross-provider series behavior', () => {
  it('resolves TVMaze series to TMDB before loading recommendations', async () => {
    const previousWindow = (globalThis as any).window;
    const previousFetch = globalThis.fetch;

    (globalThis as any).window = {
      location: { origin: 'http://localhost' },
      setTimeout,
      clearTimeout,
      dispatchEvent: () => true,
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/tv/44776')) {
        return new Response(JSON.stringify({
          id: 'kinoma_tvmaze_44776',
          type: 'tv',
          title: 'Lanterns',
          overview: 'A test synopsis.',
          ids: { tvmaze: 44776, tmdb: 95350 },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }

      if (url.includes('/api/v1/recommendations/95350?type=tv')) {
        return new Response(JSON.stringify({
          results: [{
            id: 123,
            name: 'Related Series',
            poster_path: '/related.jpg',
            backdrop_path: '/related-bg.jpg',
            first_air_date: '2026-01-01',
            vote_average: 8.1,
            overview: 'A related title.',
          }],
          total_results: 1,
          total_pages: 1,
          page: 1,
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }

      throw new Error('Unexpected request: ' + url);
    });

    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const { api } = await import('./api');
      const result = await api.getRecommendations('kinoma_tvmaze_44776');

      expect(result.results).toHaveLength(1);
      expect(result.results[0].title).toBe('Related Series');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1][0]).toContain('/api/v1/recommendations/95350?type=tv');
    } finally {
      globalThis.fetch = previousFetch;
      (globalThis as any).window = previousWindow;
    }
  });
});
