import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Global search suggestions accessibility', () => {
  const source = readFileSync(new URL('./SearchBar.tsx', import.meta.url), 'utf8');

  it('exposes a labelled combobox and keyboard selection', () => {
    expect(source).toContain('role="combobox"');
    expect(source).toContain('aria-autocomplete="list"');
    expect(source).toContain('ArrowDown');
    expect(source).toContain('ArrowUp');
    expect(source).toContain('activeIndex >= 0');
    expect(source).toContain('role="option"');
  });

  it('uses keyboard-operable buttons for suggestion and all-results actions', () => {
    expect(source).toContain('type="button"');
    expect(source).toContain('aria-label={`Open ${itemTitle} details`}');
    expect(source).toContain('View all results for');
  });
});
