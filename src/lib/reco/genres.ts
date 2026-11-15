/**
 * Canonical genres for the recommendation engine. TMDB names movie and TV genres differently ("Sci-Fi & Fantasy",
 * "Action & Adventure", "War & Politics"); the engine compares titles on one vocabulary.
 */
const SPLIT: Record<string, string[]> = {
  "action & adventure": ["Action", "Adventure"],
  "sci-fi & fantasy": ["Science Fiction", "Fantasy"],
  "war & politics": ["War"],
  "sci-fi": ["Science Fiction"],
  "scifi": ["Science Fiction"],
  "science fiction": ["Science Fiction"],
  "kids": ["Family"],
  "anime": ["Animation"]
};

export function canonicalGenres(list: readonly string[] | null | undefined): string[] {
  const out = new Set<string>();
  for (const g of list ?? []) {
    if (typeof g !== "string" || !g.trim()) continue;
    const k = g.trim().toLowerCase();
    for (const x of SPLIT[k] ?? [g.trim()]) out.add(x);
  }
  return [...out];
}
