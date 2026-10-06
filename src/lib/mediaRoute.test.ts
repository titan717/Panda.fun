import { describe, expect, it } from 'vitest';
import { buildDetailsHref } from './mediaRoute';

describe('title-based detail routes', () => {
  it('builds a movie details route from its title slug', () => {
    expect(buildDetailsHref('Breaking Bad', 'movie')).toBe('/details/breaking-bad?type=movie');
  });

  it('builds a TV details route from its title slug', () => {
    expect(buildDetailsHref('Breaking Bad', 'series')).toBe('/details/breaking-bad?type=series');
  });

  it('normalizes punctuation and spacing into a stable title slug', () => {
    expect(buildDetailsHref("Marvel's Daredevil: Born Again", 'series')).toBe('/details/marvel-s-daredevil-born-again?type=series');
  });

  it('rejects an empty title', () => {
    expect(() => buildDetailsHref('   ', 'movie')).toThrow('A title is required to build a details route.');
  });
});
