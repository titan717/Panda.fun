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

  it('renders loading, error, and empty-episode states', () => {
    expect(source).toContain('aria-busy="true"');
    expect(source).toContain('role="alert"');
    expect(source).toContain('No episodes yet');
  });

  it('delay trailer activation and exposes a labelled mute control', () => {
    expect(source).toContain('setTrailerActive(true), 1200');
    expect(source).toContain('aria-pressed={trailerMuted}');
    expect(source).toContain('Unmute trailer');
  });

  it('uses tabs, a season sheet, and a compact sticky bar', () => {
    expect(source).toContain('role="tablist"');
    expect(source).toContain('aria-selected={activeTab === tab.id}');
    expect(source).toContain('role="dialog"');
    expect(source).toContain('panda-details__compact');
  });

  it('renders episode progress from existing history data', () => {
    expect(source).toContain('historyUtil.getAnimeEpisodesProgress');
    expect(source).toContain('panda-details__progress');
  });

  it('keeps accessible icon actions and reduced-motion fallbacks', () => {
    expect(source).toContain('aria-label="Share this title"');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('env(safe-area-inset-bottom)');
  });
});
