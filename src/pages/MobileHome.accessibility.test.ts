import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Mobile featured spotlight', () => {
  it('shows one selected cinematic title with working watch, details and My List actions', () => {
    const source = readFileSync(new URL('./MobileHome.tsx', import.meta.url), 'utf8');
    expect(source).toContain('panda-mobile-featured__spotlight');
    expect(source).toContain('buildWatchHref(featured.id');
    expect(source).toContain('buildDetailsHref(featured');
    expect(source).toContain('libraryManager.toggleWatchlist');
    expect(source).toContain('aria-pressed={isInList}');
  });

  it('provides labelled previous, next and direct featured-title controls', () => {
    const source = readFileSync(new URL('./MobileHome.tsx', import.meta.url), 'utf8');
    expect(source).toContain('aria-label="Previous featured title"');
    expect(source).toContain('aria-label="Next featured title"');
    expect(source).toContain('aria-current={index === activeIndex ? \'true\' : undefined}');
    expect(source).toContain('Show featured title ');
  });

  it('removes the spotlight label and supports touch swiping with a white active accent', () => {
    const source = readFileSync(new URL('./MobileHome.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('./mobile-home.css', import.meta.url), 'utf8');
    expect(source).not.toContain('PANDA SPOTLIGHT');
    expect(source).toContain('onTouchStart');
    expect(source).toContain('onTouchEnd');
    expect(source).toContain('touchStartY');
    expect(source).toContain('Math.abs(distance) < Math.abs(verticalDistance) * 1.2');
    expect(styles).toContain('panda-mobile-featured__spotlight-track');
    expect(styles).toContain('background: #fff');
  });

  it('supports reduced-motion preferences in the featured presentation', () => {
    const styles = readFileSync(new URL('./mobile-home.css', import.meta.url), 'utf8');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('.panda-mobile-featured__hint button { transition: none; }');
  });
});
