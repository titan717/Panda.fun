export type VidyMediaType = 'movie' | 'tv';

export function buildVidyUrl(
  tmdbId: number,
  type: VidyMediaType,
  season = 1,
  episode = 1
) {
  const path = type === 'movie'
    ? `movie/${tmdbId}`
    : `tv/${tmdbId}/${season}/${episode}`;
  return `https://embedwave.cc/embed/${path}`;
}
