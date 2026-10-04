import { describe, expect, it } from 'vitest';
import { buildDetailsHref, isCanonicalMediaId, resolveRouteMediaId } from './mediaRoute';

describe('media route identity', () => {
  it('builds canonical details URLs from MovieApi IDs', () => {
    expect(buildDetailsHref('kinoma_tmdb_movie_123', 'movie'))
      .toBe('/details/kinoma_tmdb_movie_123?type=movie');
  });

  it('keeps same-title results distinct by ID', () => {
    const first = buildDetailsHref('kinoma_tmdb_movie_123', 'movie');
    const second = buildDetailsHref('kinoma_tmdb_movie_456', 'movie');

    expect(first).not.toBe(second);
    expect(first).toContain('kinoma_tmdb_movie_123');
    expect(second).toContain('kinoma_tmdb_movie_456');
  });

  it('recognizes canonical MovieApi movie and TV IDs', () => {
    expect(isCanonicalMediaId('kinoma_tmdb_movie_123')).toBe(true);
    expect(isCanonicalMediaId('kinoma_tmdb_tv_456')).toBe(true);
    expect(isCanonicalMediaId('kinoma_tvmaze_789')).toBe(true);
  });

  it('does not treat a title slug as a canonical media ID', () => {
    expect(isCanonicalMediaId('breaking-bad')).toBe(false);
  });

  it('resolves a canonical route ID without a title lookup', () => {
    expect(resolveRouteMediaId('kinoma_tmdb_movie_123')).toBe('kinoma_tmdb_movie_123');
    expect(resolveRouteMediaId('kinoma_tmdb_tv_456')).toBe('kinoma_tmdb_tv_456');
    expect(resolveRouteMediaId('breaking-bad')).toBeNull();
  });
});
