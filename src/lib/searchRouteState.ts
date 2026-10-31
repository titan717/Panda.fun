export type SearchMediaFilter = 'all' | 'movie' | 'series';

export interface SearchRouteState {
  keyword: string;
  type: SearchMediaFilter;
}

/** Read the query state from Wouter's pathname + search location string. */
export function readSearchRouteState(location: string): SearchRouteState {
  const query = location.includes('?') ? location.slice(location.indexOf('?') + 1) : '';
  const params = new URLSearchParams(query);
  const requestedType = params.get('type');
  return {
    keyword: params.get('keyword')?.trim() || '',
    type: requestedType === 'movie' || requestedType === 'series' ? requestedType : 'all',
  };
}
