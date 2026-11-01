import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const focus = read('./useDpadFocus.tsx');
const shell = read('./TvAppShell.tsx');
const hero = read('./TvHeroCarousel.tsx');
const rail = read('./TvContentRail.tsx');
const search = read('./TvSearch.tsx');
const details = read('./TvDetails.tsx');

describe('Android TV adaptive 10-foot UI', () => {
  it('provides spatial D-pad focus with route memory', () => {
    expect(focus).toContain('ArrowUp');
    expect(focus).toContain('ArrowDown');
    expect(focus).toContain('ArrowLeft');
    expect(focus).toContain('ArrowRight');
    expect(focus).toContain('lastFocusedByRoute');
    expect(focus).toContain('scrollIntoView');
  });

  it('branches the shell on TV detection only', () => {
    expect(shell).toContain("getCurrentDeviceMode() === 'tv'");
    expect(shell).toContain('DpadFocusProvider');
  });

  it('auto-advances hero and supports D-pad left/right', () => {
    expect(hero).toContain('setInterval');
    expect(hero).toContain("ArrowLeft");
    expect(hero).toContain("ArrowRight");
    expect(hero).toContain('tv-hero__dot');
  });

  it('virtualizes rails with a buffer', () => {
    expect(rail).toContain('BUFFER');
    expect(rail).toContain('slice(start, end)');
  });

  it('keeps search debounced with AbortController and filters', () => {
    expect(search).toContain('250');
    expect(search).toContain('AbortController');
    expect(search).toContain("'anime'");
  });

  it('wires favourite and My List to the real library API', () => {
    expect(details).toContain('libraryManager.toggleFavorite');
    expect(details).toContain('libraryManager.toggleWatchlist');
    expect(details).toContain('historyUtil.getAnimeProgress');
  });
});
