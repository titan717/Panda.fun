import { describe, expect, it } from 'vitest';
import { pickCanonicalMediaId } from './api';

describe('canonical media identity selection', () => {
  it('prefers the exact TMDB TV match over a same-title TVMaze result', () => {
    expect(pickCanonicalMediaId(
      [{ id: 'tmdb_tv_100088', type: 'tv', title: 'The Last of Us' }],
      [{ id: 'kinoma_tvmaze_44776', title: 'The Last of Us' }],
      'the-last-of-us',
      'series'
    )).toBe('tmdb_tv_100088');
  });
});
