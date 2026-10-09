import { describe, expect, it } from 'vitest';
import { ABOUT_ITEMS, ITEMS } from './Layout';

describe('Panda responsive navigation contract', () => {
  it('keeps the mobile primary navigation in the intended order', () => {
    expect(ITEMS.map(item => item.href)).toEqual(['/home', '/search', '/library', '/settings']);
    expect(ITEMS.map(item => item.label)).toEqual(['Home', 'Search', 'My List', 'Settings']);
  });

  it('keeps discover, support, and legal destinations available in site navigation', () => {
    expect(ABOUT_ITEMS.map(item => item.href)).toEqual([
      '/about',
      '/docs',
      '/terms',
      '/privacy-policy',
      '/contact',
    ]);
  });
});
