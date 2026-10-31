import { describe, expect, it } from 'vitest';
import { readSearchRouteState } from './searchRouteState';

describe('search route state', () => {
  it('reads a keyword and supported media filter from a Wouter location', () => {
    expect(readSearchRouteState('/search?keyword=one%20piece&type=series')).toEqual({
      keyword: 'one piece',
      type: 'series',
    });
  });

  it('clears missing and unsupported query values when the route changes', () => {
    expect(readSearchRouteState('/search?keyword=%20%20&type=anime')).toEqual({
      keyword: '',
      type: 'all',
    });
    expect(readSearchRouteState('/search')).toEqual({ keyword: '', type: 'all' });
  });
});
