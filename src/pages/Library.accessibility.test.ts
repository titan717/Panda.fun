import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Panda Library profile hub contract', () => {
  const source = readFileSync(new URL('./Library.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

  it('renders the compact My Library header with an accessible inline search toggle', () => {
    expect(source).toContain('My Library');
    expect(source).toContain('aria-label={searchOpen ? \'Close library search\' : \'Search library\'}');
    expect(source).toContain('aria-expanded={searchOpen}');
    expect(source).toContain('Search your library');
    expect(source).not.toContain('A little nudge from Panda');
    expect(source).not.toContain('kinoma-library-head__art-orbit');
  });

  it('provides the resume hero from the most recent history item with saved playback timestamp', () => {
    expect(source).toContain('lastWatchedTime');
    expect(source).toContain('panda-library__resume');
    expect(source).toContain('latestHistory.playbackTimestamp');
    expect(source).toContain('S{Math.max(1, Number(latestHistory.seasonNumber) || 1)} E');
    expect(source).toContain('panda-library__resume-progress');
  });

  it('keeps all four existing collections and accessible active filter state', () => {
    for (const tab of ['continue', 'watchlist', 'favorites', 'completed']) expect(source).toContain("'" + tab + "'");
    expect(source).toContain('aria-pressed={active === id}');
    expect(source).toContain('panda-library__shelf-track');
    expect(source).toContain('panda-library__selected-grid');
    expect(styles).toContain('scroll-snap-type: x proximity');
  });

  it('preserves history, library, removal and playback URL integrations', () => {
    expect(source).toContain('historyUtil.getHistory()');
    expect(source).toContain('libraryManager.getWatchlist()');
    expect(source).toContain('libraryManager.getFavorites()');
    expect(source).toContain('libraryManager.getCompleted()');
    expect(source).toContain('buildWatchHref(mediaId, type, season, episode, item.playbackTimestamp)');
    expect(source).toContain('libraryManager.removeItem');
    expect(source).toContain('historyUtil.removeHistory(slug)');
  });

  it('uses fixed aspect ratios and mobile safe-area styling for the resume and card shelves', () => {
    expect(styles).toContain('aspect-ratio: 16 / 9');
    expect(styles).toContain('env(safe-area-inset-bottom');
    expect(styles).toContain('panda-library__shelf-card');
  });
});
