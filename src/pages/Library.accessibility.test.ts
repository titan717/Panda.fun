import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Panda Library presentation contract', () => {
  const source = readFileSync(new URL('./Library.tsx', import.meta.url), 'utf8');

  it('does not render numeric collection totals or episode counters', () => {
    expect(source).not.toContain('savedMoments');
    expect(source).not.toContain('counts[');
    expect(source).not.toContain('panda-saved-moments__count');
    expect(source).not.toContain('S${season} E${episode}');
  });

  it('keeps the four existing collections and their accessible controls', () => {
    for (const tab of ['continue', 'watchlist', 'favorites', 'completed']) {
      expect(source).toContain("'" + tab + "'");
    }
    expect(source).toContain('aria-pressed={active === id}');
    expect(source).toContain('aria-label="Search this collection"');
    expect(source).toContain('Continue watching');
  });

  it('preserves existing playback and library data integrations', () => {
    expect(source).toContain('historyUtil.getHistory()');
    expect(source).toContain('libraryManager.getWatchlist()');
    expect(source).toContain('libraryManager.getFavorites()');
    expect(source).toContain('libraryManager.getCompleted()');
    expect(source).toContain('buildWatchHref(mediaId, type, season, episode, item.playbackTimestamp)');
    expect(source).toContain('libraryManager.removeItem');
  });
});
