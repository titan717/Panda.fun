import { slugifyTitle } from './slug';

export type MediaRouteType = 'movie' | 'series';

export type DetailsRouteSearch = {
  type: MediaRouteType | null;
  mediaId: string | null;
};

export function parseDetailsRouteSearch(search: string): DetailsRouteSearch {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const rawType = params.get('type');
  const type = rawType === 'movie' || rawType === 'series' ? rawType : null;
  return {
    type,
    mediaId: params.get('mediaId') || null,
  };
}

/**
 * Builds the Details URL from the displayed title while optionally carrying
 * the exact MovieApi media ID selected from search/discovery.
 *
 * The title remains the human-readable public route. When mediaId is present,
 * Details can skip title-based resolution entirely and use the selected
 * movie/TV identity without ambiguity.
 */
type DetailsRouteMedia = {
  title: string;
  id?: string | null;
};

export function buildDetailsHref(
  titleOrMedia: string | DetailsRouteMedia,
  type: MediaRouteType,
  mediaId?: string
): string {
  const media = typeof titleOrMedia === 'string' ? null : titleOrMedia;
  const rawTitle = String(media ? media.title : titleOrMedia || '').trim();
  if (!rawTitle) throw new Error('A title is required to build a details route.');
  const slug = slugifyTitle(rawTitle);
  const params = new URLSearchParams({ type });
  const normalizedMediaId = String(media ? media.id || '' : mediaId || '').trim();
  if (normalizedMediaId) {
    const tmdb = normalizedMediaId.match(/^(?:kinoma_)?tmdb_(movie|tv)_\d+$/);
    const isTvmaze = /^kinoma_tvmaze_\d+$/.test(normalizedMediaId);
    const mediaType = tmdb ? (tmdb[1] === 'movie' ? 'movie' : 'series') : isTvmaze ? 'series' : null;
    if (!mediaType || mediaType === type) params.set('mediaId', normalizedMediaId);
  }
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
