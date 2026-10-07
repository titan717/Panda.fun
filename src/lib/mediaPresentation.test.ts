import { beforeEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => data
  } as Response;
}

describe('media presentation and episode ordering', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.stubGlobal('window', {
      location: { origin: 'https://kinoma.onrender.com' },
      setTimeout,
      clearTimeout,
      dispatchEvent: vi.fn()
    });
  });

  it('uses a card-sized TMDB image variant for search results', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/v1/tmdb/search/movie')) {
        return jsonResponse({
          results: [{
            id: 550,
            title: 'Fight Club',
            original_title: 'Fight Club',
            release_date: '1999-10-15',
            vote_average: 8.4,
            poster_path: '/fight-club.jpg',
            backdrop_path: null,
            overview: 'A movie.'
          }]
        });
      }
      return jsonResponse({ results: [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('./api');
    api.clearCache();
    const result = await api.search('Fight Club');

    expect(result.results[0].image).toBe('https://image.tmdb.org/t/p/w342/fight-club.jpg');
  });

  it('uses TMDB season data and presents episodes in numeric order for canonical TMDB TV IDs', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/v1/tmdb/tv/100088')) {
        if (url.includes('/season/1')) {
          return jsonResponse({
            id: 1,
            season_number: 1,
            name: 'Season 1',
            episode_count: 2,
            episodes: [
              { id: 2, number: 2, name: 'Episode Two', overview: 'Second', still_path: '/two.jpg', runtime: 55, vote_average: 7.8 },
              { id: 1, number: 1, name: 'Episode One', overview: 'First', still_path: '/one.jpg', runtime: 58, vote_average: 8.1 }
            ]
          });
        }
        return jsonResponse({
          id: 100088,
          name: 'The Last of Us',
          first_air_date: '2023-01-15',
          number_of_seasons: 2,
          ids: { tmdb: 100088, tvmaze: 47199 }
        });
      }
      if (url.includes('/api/v1/tv/47199/season/1')) {
        return jsonResponse({
          seasons: [],
          episodes: [{ id: 999, number: 99, title: 'Wrong provider episode' }]
        });
      }
      throw new Error('Unexpected URL: ' + url);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('./api');
    api.clearCache();
    const result = await api.getSeasonEpisodes('tmdb_tv_100088', 1);

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/v1/tmdb/tv/100088/season/1'))).toBe(true);
    expect(result.episodes.map(episode => episode.number)).toEqual([1, 2]);
    expect(result.episodes[0].synopsis).toBe('First');
  });
});
