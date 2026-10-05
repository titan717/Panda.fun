import { describe, expect, it } from 'vitest';
import { buildDetailsHref, isCanonicalMediaId } from './mediaRoute';

describe('canonical media routes', () => {
  it('preserves the supplied canonical movie ID', () => {
    const href = buildDetailsHref('kinoma_tmdb_movie_123', 'movie');
    expect(href).toContain('kinoma_tmdb_movie_123');
    expect(href).toContain('type=movie');
  });

  it('keeps duplicate titles distinct because routes use IDs', () => {
    const first = buildDetailsHref('kinoma_tmdb_movie_123', 'movie');
    const second = buildDetailsHref('kinoma_tmdb_movie_456', 'movie');
    expect(first).not.toBe(second);
  });

  it('recognizes canonical MovieApi IDs', () => {
    expect(isCanonicalMediaId('kinoma_tmdb_movie_123')).toBe(true);
    expect(isCanonicalMediaId('kinoma_tmdb_tv_456')).toBe(true);
    expect(isCanonicalMediaId('kinoma_tvmaze_789')).toBe(true);
  });

  it('does not treat a legacy title slug as a canonical ID', () => {
    expect(isCanonicalMediaId('breaking-bad')).toBe(false);
  });
});
