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

  const query = new URLSearchParams({
    autoplay: 'true',
    ...(type === 'tv'
      ? {
          nextEpisode: 'true',
          episodeSelector: 'true',
          autoplayNextEpisode: 'true',
        }
      : {}),
  });

  return `https://www.vidy.st/${path}?${query.toString()}`;
}
