import { describe, expect, it } from 'vitest';
import { getRouteDepth, getRouteTransitionDirection } from './routeTransitions';

describe('route transition behavior', () => {
  it('classifies home, details and watch paths without regex parsing', () => {
    expect(getRouteDepth('/home')).toBe(0);
    expect(getRouteDepth('/details/tmdb_movie_123')).toBe(1);
    expect(getRouteDepth('/watch/tmdb_movie_123')).toBe(2);
    expect(getRouteDepth('/watch/123?autoplay=1')).toBe(2);
  });

  it('pushes deeper and pops toward shallower routes', () => {
    expect(getRouteTransitionDirection('/home', '/details/123')).toBe(1);
    expect(getRouteTransitionDirection('/details/123', '/watch/123')).toBe(1);
    expect(getRouteTransitionDirection('/watch/123', '/details/123')).toBe(-1);
    expect(getRouteTransitionDirection('/details/123', '/home')).toBe(-1);
  });

  it('uses a neutral transition between routes at the same depth', () => {
    expect(getRouteTransitionDirection('/home', '/search')).toBe(0);
    expect(getRouteTransitionDirection('/details/123', '/details/456')).toBe(0);
  });
});
