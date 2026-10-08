export type VidyMediaType = 'movie' | 'tv';

export const VIDY_BASE_URL = 'https://www.vidy.st';

export function buildVidyUrl(
  tmdbId: number,
  type: VidyMediaType,
  season = 1,
  episode = 1,
  progress = 0
) {
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    throw new Error('A valid TMDB ID is required for Vidy playback.');
  }

  const path = type === 'movie'
    ? `movie/${tmdbId}`
    : `tv/${tmdbId}/${Math.max(1, Number(season) || 1)}/${Math.max(1, Number(episode) || 1)}`;

  const params = new URLSearchParams();
  params.set('autoplay', 'true');

  const start = Math.floor(Number(progress) || 0);
  if (start > 0) params.set('progress', String(start));

  if (type === 'tv') {
    params.set('nextEpisode', 'true');
    params.set('episodeSelector', 'true');
    params.set('autoplayNextEpisode', 'true');
  }

  return `${VIDY_BASE_URL}/${path}?${params.toString()}`;
}
