export type MediaRouteType = 'movie' | 'series';

/**
 * Builds the canonical Details URL from the MovieAPI/TMDB media identity.
 * Keeping the media ID in the route prevents duplicate-title collisions and
 * lets the Details page load the exact metadata/trailer record selected by the user.
 */
export function buildDetailsHref(mediaId: string, type: MediaRouteType): string {
  const id = mediaId.trim();
  if (!id) throw new Error('A media ID is required to build a details route.');
  return '/details/' + encodeURIComponent(id) + '?type=' + type;
}
