import { describe, expect, it } from 'vitest';
import { ABOUT_ITEMS, ITEMS } from './Layout';

describe('Panda sidebar navigation contract', () => {
  it('keeps the primary navigation in the intended order', () => {
    expect(ITEMS.map(item => item.href)).toEqual(['/home', '/search', '/library', '/settings']);
    expect(ITEMS.map(item => item.label)).toEqual(['Home', 'Search', 'My List', 'Settings']);
  });

  it('keeps the About destinations available to the sidebar', () => {
    expect(ABOUT_ITEMS.map(item => item.href)).toEqual([
      '/about',
      '/docs',
      '/terms',
      '/privacy',
      '/contact',
    ]);
  });
});

  it('keeps Search and Profile in the mobile header and Settings in the bottom navigation', async () => {
    const source = await import('node:fs').then(({ readFileSync }) => readFileSync(new URL('./Layout.tsx', import.meta.url), 'utf8'));
    expect(source).toContain("{ href: '/settings', label: 'Settings', Icon: Settings }");
    const mobileHeader = source.slice(source.indexOf('panda-mobile-header'), source.indexOf('</header>'));
    expect(mobileHeader).toContain('aria-label="Search"');
    expect(mobileHeader).toContain('aria-label="Profile"');
    expect(mobileHeader).not.toContain('aria-label="Settings"');
  });
