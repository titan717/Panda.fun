import { slugifyTitle } from './slug';

export type MediaRouteType = 'movie' | 'series';

/**
 * Builds the Details URL from the displayed title.
 * MovieAPI/TMDB IDs stay internal to the data/playback layer; the public
 * route remains a human-readable title slug.
 */
export function buildDetailsHref(title: string, type: MediaRouteType): string {
  const rawTitle = String(title || '').trim();
  if (!rawTitle) throw new Error('A title is required to build a details route.');
  const slug = slugifyTitle(rawTitle);
  return '/details/' + encodeURIComponent(slug) + '?type=' + type;
}
