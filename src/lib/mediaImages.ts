export type MediaImageSize = 'w342' | 'w500' | 'w780' | 'w1280';

export function optimizeImageUrl(url: string | null | undefined, size: MediaImageSize = 'w342') {
  if (!url) return url ?? null;
  if (!url.includes('/t/p/')) return url;
  return url.replace(/\/t\/p\/(?:original|w\d+)\//, `/t/p/${size}/`);
}
