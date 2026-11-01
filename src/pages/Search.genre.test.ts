import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('genre-prefilled Search collections', () => {
  const search = readFileSync(new URL('./Search.tsx', import.meta.url), 'utf8');

  it('reads the genre query and fetches the matching movie and TV shelves', () => {
    expect(search).toContain("params.get('genre')");
    expect(search).toContain('getGenreSearchResults(genreFilter)');
    expect(search).toContain("api.getGenreMedia(movieGenre, 'movie', 24)");
    expect(search).toContain("api.getGenreMedia(tvGenre, 'tv', 24)");
    expect(search).toContain("if (genre.toLowerCase() === 'anime') return api.getGenreAnime('animation', 24)");
  });

  it('filters by genre aliases and preserves the selected genre in a keyword search', () => {
    expect(search).toContain("wanted === 'sci-fi & fantasy'");
    expect(search).toContain("wanted === 'animation & family'");
    expect(search).toContain("wanted === 'action'");
    expect(search).toContain("(genreFilter ? '&genre=' + encodeURIComponent(genreFilter) : '')");
  });

  it('shows the selected genre as the collection heading', () => {
    expect(search).toContain("genreFilter ? 'Genre collection' : 'Discover'");
    expect(search).toContain("genreFilter ? genreFilter : filter === 'movie'");
  });
});
