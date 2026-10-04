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
