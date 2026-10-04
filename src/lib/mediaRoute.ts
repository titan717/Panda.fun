export type MediaRouteType = 'movie' | 'series';

const CANONICAL_MEDIA_ID = /^kinoma_(?:tmdb_(?:movie|tv)|tvmaze)_\d+$/;

export function isCanonicalMediaId(value: string): boolean {
  return CANONICAL_MEDIA_ID.test(value);
}

export function resolveRouteMediaId(routeId: string): string | null {
  const decoded = decodeURIComponent(routeId);
  return isCanonicalMediaId(decoded) ? decoded : null;
}

export function buildDetailsHref(id: string, type: MediaRouteType): string {
  return '/details/' + encodeURIComponent(id) + '?type=' + type;
}
