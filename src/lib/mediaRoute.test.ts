import { describe, expect, it } from 'vitest';
import { buildDetailsHref } from './mediaRoute';

describe('media-identity detail routes', () => {
  it('builds a movie details route from its canonical media ID', () => {
    expect(buildDetailsHref('tmdb_movie_123', 'movie')).toBe('/details/tmdb_movie_123?type=movie');
  });

  it('builds a TV details route from its canonical media ID', () => {
    expect(buildDetailsHref('kinoma_tmdb_tv_456', 'series')).toBe('/details/kinoma_tmdb_tv_456?type=series');
  });

  it('keeps duplicate titles on distinct routes because the ID is preserved', () => {
    expect(buildDetailsHref('tmdb_movie_123', 'movie')).not.toBe(buildDetailsHref('tmdb_movie_456', 'movie'));
  });

  it('rejects an empty media ID', () => {
    expect(() => buildDetailsHref('   ', 'movie')).toThrow('A media ID is required to build a details route.');
  });
});
