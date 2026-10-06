import { describe, expect, it } from 'vitest';
import { buildDetailsHref } from './mediaRoute';

describe('title-based detail routes', () => {
  it('builds a movie details route from its title', () => {
    expect(buildDetailsHref('Breaking Bad', 'movie')).toBe('/details/Breaking%20Bad?type=movie');
  });

  it('builds a TV details route from its title', () => {
    expect(buildDetailsHref('Breaking Bad', 'series')).toBe('/details/Breaking%20Bad?type=series');
  });

  it('preserves punctuation through URL encoding', () => {
    expect(buildDetailsHref("Marvel's Daredevil", 'series')).toBe("/details/Marvel's%20Daredevil?type=series");
  });

  it('rejects an empty title', () => {
    expect(() => buildDetailsHref('   ', 'movie')).toThrow('A title is required to build a details route.');
  });
});
