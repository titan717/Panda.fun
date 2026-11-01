import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const api = readFileSync(new URL('./api.ts', import.meta.url), 'utf8');
const mobileHome = readFileSync(new URL('../pages/MobileHome.tsx', import.meta.url), 'utf8');

describe('homepage discovery API contracts', () => {
  it('uses the documented upcoming movie and TV endpoints', () => {
    expect(api).toContain("'/api/v1/upcoming/movies'");
    expect(api).toContain("'/api/v1/upcoming/tv'");
  });

  it('exposes a typed genre wrapper for both movies and TV', () => {
    expect(api).toContain("async getGenreMedia(genre: string, type: 'movie' | 'tv', limit = 12)");
    expect(api).toContain("'/api/v1/genres/' + encodeURIComponent(genre)");
  });

  it('builds an Anime rail from both verified animation genre media types and Japanese original language', () => {
    expect(api).toContain("'/api/v1/genres/' + encodeURIComponent(genre)");
    expect(api).toContain("{ type: 'movie', page: 1 }");
    expect(api).toContain("{ type: 'tv', page: 1 }");
    expect(api).toContain("item.language?.toLowerCase() === 'ja'");
    expect(mobileHome).toContain("api.getGenreAnime('animation', 24)");
  });

  it('uses the documented recommendation endpoint and preserves media type', () => {
    expect(api).toContain('`/api/v1/recommendations/${tmdbId}`');
    expect(api).toContain('{ type: media.type }');
  });

  it('lazy-loads genre shelves near the viewport and hides empty results', () => {
    expect(mobileHome).toContain('new IntersectionObserver');
    expect(mobileHome).toContain('rootMargin: \'480px 0px\'');
    expect(mobileHome).toContain('if (!items.length && !loading) return null;');
  });
});
