import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('responsive layout breakpoints', () => {
  const appCss = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
  const mobileCss = readFileSync(new URL('../components/mobile/mobile-shell.css', import.meta.url), 'utf8');
  const featuredCss = readFileSync(new URL('../pages/mobile-home.css', import.meta.url), 'utf8');

  it('keeps phone layouts contained and reserves space for the in-app bottom navigation', () => {
    expect(mobileCss).toContain('@media (max-width: 767px)');
    expect(mobileCss).toContain('overflow-x: clip');
    expect(mobileCss).toContain('.kinoma-search-grid');
    expect(mobileCss).toContain('.kinoma-library-grid');
  });

  it('uses a less dense poster grid on tablets and compact desktops', () => {
    expect(appCss).toContain('@media (min-width: 768px) and (max-width: 1023px)');
    expect(appCss).toContain('@media (min-width: 1024px) and (max-width: 1279px)');
    expect(appCss).toContain('grid-template-columns: repeat(3, minmax(0, 1fr)) !important');
    expect(appCss).toContain('grid-template-columns: repeat(4, minmax(0, 1fr)) !important');
  });

  it('has compact-phone and wider featured-card sizing rules', () => {
    expect(featuredCss).toContain('@media (max-width: 380px)');
    expect(featuredCss).toContain('@media (min-width: 520px) and (max-width: 767px)');
    expect(featuredCss).toContain('min-width: 0');
  });
});
