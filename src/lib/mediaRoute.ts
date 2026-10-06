import { slugifyTitle } from './slug';

export type MediaRouteType = 'movie' | 'series';

/**
 * Builds the Details URL from the displayed title while optionally carrying
 * the exact MovieApi media ID selected from search/discovery.
 *
 * The title remains the human-readable public route. When mediaId is present,
 * Details can skip title-based resolution entirely and use the selected
 * movie/TV identity without ambiguity.
 */
export function buildDetailsHref(title: string, type: MediaRouteType, mediaId?: string): string {
  const rawTitle = String(title || '').trim();
  if (!rawTitle) throw new Error('A title is required to build a details route.');
  const slug = slugifyTitle(rawTitle);
  const params = new URLSearchParams({ type });
  const normalizedMediaId = String(mediaId || '').trim();
  if (normalizedMediaId) params.set('mediaId', normalizedMediaId);
  return '/details/' + encodeURIComponent(slug) + '?' + params.toString();
}

/**
 * Builds the canonical Watch URL consumed by the Watch page parser.
 * Series keep season/episode in the path so navigation works consistently
 * from every entry point on the site.
 */
export function buildWatchHref(
  id: string,
  type: MediaRouteType,
  season = 1,
  episode = 1,
  playbackTimestamp = 0
): string {
  const mediaId = String(id || '').trim();
  if (!mediaId) throw new Error('A media ID is required to build a watch route.');

  const safeSeason = Math.max(1, Number(season) || 1);
  const safeEpisode = Math.max(1, Number(episode) || 1);
  const watchId = type === 'movie'
    ? mediaId
    : mediaId + '$season$' + safeSeason + '$episode$' + safeEpisode;

  const params = new URLSearchParams({ type });
  const timestamp = Math.floor(Number(playbackTimestamp) || 0);
  if (timestamp > 0) params.set('t', String(timestamp));

  return '/watch/' + encodeURIComponent(watchId) + '?' + params.toString();
}
