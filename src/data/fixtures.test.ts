import { describe, expect, it } from 'vitest';
import { editorialTitles, editorialCollections, getEditorialTitle } from './fixtures';

describe('Panda.fun editorial fixtures', () => {
  it('provides at least 24 unique original showcase titles', () => {
    expect(editorialTitles.length).toBeGreaterThanOrEqual(24);
    expect(new Set(editorialTitles.map(item => item.id)).size).toBe(editorialTitles.length);
    expect(new Set(editorialTitles.map(item => item.title)).size).toBe(editorialTitles.length);
  });

  it('keeps the Night Shift showcase title discoverable by its stable id', () => {
    expect(getEditorialTitle('night-shift')?.title).toBe('Night Shift');
  });

  it('groups showcase titles into non-empty editorial collections', () => {
    expect(editorialCollections.length).toBeGreaterThanOrEqual(4);
    expect(editorialCollections.every(collection => collection.title && collection.items.length > 0)).toBe(true);
  });

  it('keeps fixture episode data local and deterministic', () => {
    const series = editorialTitles.find(item => item.kind === 'series');
    expect(series?.seasons[0]?.episodes.length).toBeGreaterThan(0);
    expect(series?.seasons[0]?.episodes[0]?.id).toBeTruthy();
  });
});
