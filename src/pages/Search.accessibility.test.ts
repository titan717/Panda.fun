import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Search route and filter accessibility', () => {
  const source = readFileSync(new URL('./Search.tsx', import.meta.url), 'utf8');

  it('syncs the search term and media filter when the route query changes in place', () => {
    expect(source).toContain('readSearchRouteState(location)');
    expect(source).toContain('setQuery(routeState.keyword)');
    expect(source).toContain('setSubmittedQuery(routeState.keyword)');
    expect(source).toContain('setFilter(routeState.type)');
  });

  it('uses a labelled filter group with pressed-state buttons, not an incomplete tab widget', () => {
    expect(source).toContain('role="group" aria-label="Filter search results"');
    expect(source).toContain('aria-pressed={filter ===');
    expect(source).not.toContain('role="tablist"');
  });
});
