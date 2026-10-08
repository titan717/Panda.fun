import { describe, expect, it } from 'vitest';
import { normalizeProfile } from './profileStore';

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

  it('strips legacy profile PIN data while normalizing', () => {
    const legacy = normalizeProfile({
      id: 'legacy',
      name: 'Legacy',
      avatar: 'panda',
      movieGenres: [],
      seriesGenres: [],
      ...( { pinHash: 'legacy-lock' } as Record<string, unknown> ),
    } as Parameters<typeof normalizeProfile>[0]);

    expect('pinHash' in legacy).toBe(false);
  });
});
