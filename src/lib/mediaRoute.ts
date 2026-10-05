export type MediaRouteType = 'movie' | 'series';

/**
 * Builds the canonical details URL from the title identity used by Panda.fun.
 */
export function buildDetailsHref(title: string, type: MediaRouteType): string {
  const mediaTitle = title.trim();
  if (!mediaTitle) throw new Error('A media title is required to build a details route.');
  return '/details/' + encodeURIComponent(mediaTitle) + '?type=' + type;
}
