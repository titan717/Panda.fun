import { describe, expect, it } from 'vitest';
import { buildVidyUrl } from './vidy';

describe('Vidy playback URLs', () => {
  it('builds movie URLs with autoplay enabled', () => {
    expect(buildVidyUrl(550, 'movie')).toBe(
      'https://www.vidy.st/movie/550?autoplay=true'
    );
  });

  it('builds TV URLs with native episode controls enabled', () => {
    expect(buildVidyUrl(1399, 'tv', 2, 7)).toBe(
      'https://www.vidy.st/tv/1399/2/7?autoplay=true&nextEpisode=true&episodeSelector=true&autoplayNextEpisode=true'
    );
  });
});
