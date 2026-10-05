export type MediaRouteType = 'movie' | 'series';

const CANONICAL_MEDIA_ID = /^kinoma_(?:tmdb_(?:movie|tv)|tvmaze)_\d+$/;

/**
 * Returns true when an ID is one of MovieApi's canonical media identifiers.
 * Legacy title slugs intentionally return false.
 */
export function isCanonicalMediaId(value: string): boolean {
  return CANONICAL_MEDIA_ID.test(value.trim());
}

/**
 * Builds the canonical details URL without deriving identity from the title.
 */
export function buildDetailsHref(id: string, type: MediaRouteType): string {
  const mediaId = id.trim();
  if (!mediaId) throw new Error('A media ID is required to build a details route.');
  return '/details/' + encodeURIComponent(mediaId) + '?type=' + type;
}
