import { describe, expect, it } from 'vitest';
import { friendlyNetworkError, OFFLINE_MESSAGE } from './networkMessage';

describe('friendlyNetworkError', () => {
  it('prefers a reconnect message while offline', () => {
    expect(friendlyNetworkError(new Error('MovieApi returned 500'), 'Fallback', false)).toBe(OFFLINE_MESSAGE);
  });
  it('hides low-level fetch and JSON parser errors', () => {
    expect(friendlyNetworkError(new TypeError('Failed to fetch'), 'Search is unavailable.', true)).toBe('Search is unavailable.');
    expect(friendlyNetworkError(new Error('Unexpected token < in JSON'), 'Fallback', true)).toBe('Fallback');
  });
  it('keeps meaningful service messages', () => {
    expect(friendlyNetworkError(new Error('No playable source for this episode.'), 'Fallback', true)).toBe('No playable source for this episode.');
    expect(friendlyNetworkError(undefined, 'Fallback', true)).toBe('Fallback');
  });
});
