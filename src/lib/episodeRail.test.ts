import { describe, expect, it } from 'vitest';
import { calculateEpisodeRailStep, sortEpisodesForDisplay } from './episodeRail';

describe('episode rail helpers', () => {
  it('orders episodes numerically, removes duplicates, and ignores invalid numbers', () => {
    const episodes = [
      { id: 'e3', number: 3 },
      { id: 'e1b', number: 1 },
      { id: 'bad', number: 0 },
      { id: 'e2', number: 2 },
      { id: 'e1', number: 1 },
    ];

    expect(sortEpisodesForDisplay(episodes, 'asc').map(item => item.id)).toEqual(['e1b', 'e2', 'e3']);
    expect(sortEpisodesForDisplay(episodes, 'desc').map(item => item.id)).toEqual(['e3', 'e2', 'e1b']);
  });

  it('advances the rail by three and a half episode cards', () => {
    expect(calculateEpisodeRailStep(360, 16)).toBe(1316);
    expect(calculateEpisodeRailStep(300, 14)).toBe(1099);
  });
});
