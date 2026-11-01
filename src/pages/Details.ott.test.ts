import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./Details.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./details-ott.css', import.meta.url), 'utf8');

describe('Details OTT UI contract', () => {
  it('preserves the existing route and playback helpers', () => {
    expect(source).toContain("from '../lib/mediaRoute'");
    expect(source).toContain('buildDetailsHref');
    expect(source).toContain('buildWatchHref');
    expect(source).toContain('resolveMediaIdFromSlug');
  });

  it('uses the real favourite and watchlist library APIs', () => {
    expect(source).toContain('libraryManager.toggleFavorite(');
    expect(source).toContain('libraryManager.toggleWatchlist(');
    expect(source).toContain('libraryManager.isFavorite(id)');
    expect(source).not.toContain('toggleFavourite(');
  });

  it('renders loading, error, and empty-episode states', () => {
    expect(source).toContain('aria-busy="true"');
    expect(source).toContain('role="alert"');
    expect(source).toContain('No episodes yet');
  });

  it('delays trailer autoplay and respects the motion preference', () => {
    expect(source).toContain('setTrailerActive(true), 1200');
    expect(source).toContain("motionPreference !== 'full'");
    expect(source).toContain('aria-pressed={trailerMuted}');
  });

  it('uses tabs, a season sheet, and a compact sticky bar', () => {
    expect(source).toContain('role="tablist"');
    expect(source).toContain('aria-selected={activeTab === tab.id}');
    expect(source).toContain('role="dialog"');
    expect(source).toContain('panda-details__compact');
  });

  it('renders episode progress with the shared ProgressRing primitive', () => {
    expect(source).toContain('historyUtil.getAnimeEpisodesProgress');
    expect(source).toContain('<ProgressRing value={progress}');
  });

  it('uses motion primitives and accessible safe-area layout', () => {
    expect(source).toContain("from '../motion'");
    expect(source).toContain('<Stagger');
    expect(source).toContain('<Pressable');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('env(safe-area-inset-bottom)');
  });
});
