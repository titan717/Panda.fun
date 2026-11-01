import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Mobile cinematic billboard accessibility', () => {
  const source = readFileSync(new URL('./MobileHome.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('./mobile-home.css', import.meta.url), 'utf8');
  const controls = readFileSync(new URL('./mobile-featured-controls.css', import.meta.url), 'utf8');

  it('keeps existing playback, details and My List actions without the old eyebrow or text action', () => {
    expect(source).toContain('buildWatchHref(featured.id');
    expect(source).toContain('buildDetailsHref(featured');
    expect(source).toContain('libraryManager.toggleWatchlist');
    expect(source).toContain('aria-pressed={isInList}');
    expect(source).not.toContain('YOUR NEXT WATCH');
    expect(source).not.toContain('View details');
  });

  it('uses accessible segmented controls instead of dot and chevron navigation', () => {
    expect(source).toContain('panda-mobile-featured__segment');
    expect(source).toContain('aria-current={index === activeIndex ? \'true\' : undefined}');
    expect(source).toContain('Show featured title ');
    expect(source).not.toContain('Previous featured title');
    expect(source).not.toContain('Next featured title');
    expect(controls).toContain('panda-billboard-segment-fill');
  });

  it('auto-advances after six seconds and pauses for touch, hidden tabs and reduced motion', () => {
    expect(source).toContain('}, 6000)');
    expect(source).toContain('document.addEventListener(\'visibilitychange\'');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(source).toContain('setTouchPaused(true)');
    expect(source).toContain('documentHidden || touchPaused');
    expect(styles).toContain('is-paused');
  });

  it('loads the full discovery catalogue lazily with skeletons and hides empty rails', () => {
    for (const shelf of ['Coming Soon', 'Because you watched', 'Action', 'Comedy', 'Drama', 'Sci-Fi & Fantasy', 'Horror', 'Animation & Family', 'Documentary', 'Anime']) {
      expect(source).toContain(shelf);
    }
    expect(source).toContain('aria-busy="true"');
    expect(source).toContain('panda-mobile-home__rail-skeleton');
    expect(source).toContain('IntersectionObserver');
    expect(source).toContain('uniqueItems');
    expect(source).toContain('titleKey');
    expect(source).toContain("'/search?genre=' + encodeURIComponent(genre)");
  });

  it('retains swipe navigation and cinematic slide animation', () => {
    expect(source).toContain('Math.abs(distance) >= 48');
    expect(source).toContain('onTouchStart');
    expect(source).toContain('onTouchEnd');
    expect(styles).toContain('panda-mobile-featured__spotlight-track');
    expect(styles).toContain('panda-featured-swipe-in');
  });

  it('respects reduced motion for Ken Burns and slide animation', () => {
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('panda-billboard-kenburns');
    expect(styles).toContain('animation: none');
  });
});
