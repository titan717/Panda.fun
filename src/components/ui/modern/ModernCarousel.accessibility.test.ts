import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Modern carousel accessibility', () => {
  const source = readFileSync(new URL('./ModernCarousel.tsx', import.meta.url), 'utf8');

  it('keeps carousel navigation and section actions at accessible target sizes', () => {
    expect(source).toContain('w-11 h-11');
    expect(source).toContain('min-h-11');
    expect(source).toContain('aria-label="Scroll left"');
    expect(source).toContain('aria-label="Scroll right"');
  });

  it('respects reduced-motion preferences for programmatic scrolling', () => {
    expect(source).toContain('prefers-reduced-motion');
    expect(source).toContain("behavior: prefersReducedMotion ? 'auto' : 'smooth'");
  });
});
