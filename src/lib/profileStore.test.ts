import { describe, expect, it } from 'vitest';
import { isValidProfilePin, normalizeProfile } from './profileStore';

describe('profile store', () => {
  it('normalizes profile fields and limits genres', () => {
    const profile = normalizeProfile({
      id: 'p1',
      name: '   Panda fan   ',
      avatar: 'fox',
      movieGenres: ['Drama', 'Action', 'Comedy', 'Horror'],
      seriesGenres: ['Comedy', 'Drama', 'Crime', 'Mystery'],
    });

    expect(profile.name).toBe('Panda fan');
    expect(profile.movieGenres).toEqual(['Drama', 'Action', 'Comedy']);
    expect(profile.seriesGenres).toEqual(['Comedy', 'Drama', 'Crime']);
  });

  it('accepts only four-digit profile PINs', () => {
    expect(isValidProfilePin('1234')).toBe(true);
    expect(isValidProfilePin('0000')).toBe(true);
    expect(isValidProfilePin('123')).toBe(false);
    expect(isValidProfilePin('12345')).toBe(false);
    expect(isValidProfilePin('12a4')).toBe(false);
  });
});
