import { describe, expect, it } from 'vitest';
import { buildDetailsHref } from './mediaRoute';

describe('title-based media routes', () => {
  it('builds the details route from the supplied title', () => {
    expect(buildDetailsHref('Breaking Bad', 'series')).toBe('/details/Breaking%20Bad?type=series');
  });

  it('preserves punctuation and unicode through URL encoding', () => {
    expect(buildDetailsHref('Spider-Man: No Way Home', 'movie')).toBe('/details/Spider-Man%3A%20No%20Way%20Home?type=movie');
  });

  it('rejects an empty title', () => {
    expect(() => buildDetailsHref('   ', 'movie')).toThrow('A media title is required to build a details route.');
  });
});
