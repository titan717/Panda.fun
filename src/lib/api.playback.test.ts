import { afterEach, describe, expect, it, vi } from 'vitest';

const originalWindow = (globalThis as any).window;
const originalFetch = globalThis.fetch;

describe('MovieApi playback routing', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    (globalThis as any).window = originalWindow;
    vi.resetModules();
  });

  it('gets the Vidy source and resume position from MovieAPI', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain('/api/v1/movie/550/play?progress=142');
      return new Response(JSON.stringify({
        success: true,
        data: {
          mediaType: 'movie',
          mode: 'embed',
          source: {
            id: 'vidy-movie-550',
            provider: 'vidy',
            type: 'embed',
            url: 'https://www.vidy.st/movie/550?autoplay=true&progress=142',
            title: 'Vidy',
            quality: 'auto',
            language: 'en',
            subtitles: [],
            expiresAt: null,
            requiresClientPlayback: true
          },
          tmdbId: 550
        }
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });

    (globalThis as any).window = {
      location: { origin: 'http://localhost' },
      setTimeout,
      clearTimeout,
      dispatchEvent: () => true,
    };
    globalThis.fetch = fetchMock as typeof fetch;

    const { api } = await import('./api');
    const result = await api.getWatchLink('tmdb_movie_550', 1, 1, undefined, 142);

    expect(result.source.provider).toBe('vidy');
    expect(result.url).toBe('https://www.vidy.st/movie/550?autoplay=true&progress=142');
  });
});
