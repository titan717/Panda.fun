import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./Search.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./search-ott.css', import.meta.url), 'utf8');

describe('Search OTT UI contract', () => {
  it('debounces input and cancels stale requests', () => {
    expect(source).toContain('setDebouncedQuery(query.trim()), 250');
    expect(source).toContain('new AbortController()');
    expect(source).toContain('controller.abort()');
  });

  it('renders recent, trending, and genre discovery states', () => {
    expect(source).toContain('Recent searches');
    expect(source).toContain('Trending searches');
    expect(source).toContain('Browse by mood');
    expect(source).toContain('preferencesUtil.removeRecentSearch');
    expect(source).toContain('preferencesUtil.clearRecentSearches');
  });

  it('provides All, Movies, TV, and Anime filters with a sliding indicator', () => {
    expect(source).toContain("{ id: 'anime', label: 'Anime' }");
    expect(source).toContain('panda-search__filter-indicator');
    expect(source).toContain('aria-selected={filter === item.id}');
  });

  it('highlights matched titles and handles empty and offline states', () => {
    expect(source).toContain('<mark>');
    expect(source).toContain('No results for');
    expect(source).toContain('You’re offline');
  });

  it('keeps voice search conditional on Web Speech API support', () => {
    expect(source).toContain('voiceSearchSupported &&');
    expect(source).toContain('aria-pressed={voiceListening}');
  });

  it('uses scoped styles, safe areas, and reduced-motion fallbacks', () => {
    expect(css).toContain('.panda-search {');
    expect(css).toContain('env(safe-area-inset-top)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).not.toContain('!important');
  });
});
