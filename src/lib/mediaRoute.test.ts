import { describe, expect, it } from 'vitest';
import { buildDetailsHref } from './mediaRoute';

describe('title-based detail routes', () => {
  it('builds a movie details route from its title slug', () => {
    expect(buildDetailsHref('Breaking Bad', 'movie')).toBe('/details/breaking-bad?type=movie');
  });

  it('builds a TV details route from its title slug', () => {
    expect(buildDetailsHref('Breaking Bad', 'series')).toBe('/details/breaking-bad?type=series');
  });

  it('preserves an explicit media ID for collision-safe details navigation', () => {
    expect(buildDetailsHref('The Last of Us', 'series', 'tmdb_tv_100088')).toBe(
      '/details/the-last-of-us?type=series&mediaId=tmdb_tv_100088'
    );
    expect(buildDetailsHref('The Last of Us', 'movie', 'tmdb_movie_100088')).toBe(
      '/details/the-last-of-us?type=movie&mediaId=tmdb_movie_100088'
    );
  });

  it('normalizes punctuation and spacing into a stable title slug', () => {
    expect(buildDetailsHref("Marvel's Daredevil: Born Again", 'series')).toBe('/details/marvel-s-daredevil-born-again?type=series');
  });

  it('rejects an empty title', () => {
    expect(() => buildDetailsHref('   ', 'movie')).toThrow('A title is required to build a details route.');
  });

  it('builds the exact watch route format used by the Watch parser', async () => {
    const mediaRoute = await import('./mediaRoute');
    expect(typeof mediaRoute.buildWatchHref).toBe('function');
    expect(mediaRoute.buildWatchHref('tmdb_tv_95350', 'series', 1, 2)).toBe(
      '/watch/tmdb_tv_95350%24season%241%24episode%242?type=series'
    );
  });

  it('preserves movie watch routes without an episode suffix', async () => {
    const mediaRoute = await import('./mediaRoute');
    expect(typeof mediaRoute.buildWatchHref).toBe('function');
    expect(mediaRoute.buildWatchHref('tmdb_movie_550', 'movie')).toBe(
      '/watch/tmdb_movie_550?type=movie'
    );
  });
});
