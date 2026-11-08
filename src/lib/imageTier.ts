/**
 * Artwork size by screen (D-54). The API returns w342 posters and w780 backdrops, which look soft on 4K TVs
 * where cards are drawn at twice the CSS size. When the screen has at least 2560 physical pixels across,
 * TMDB URLs move up one size step. Phones and 1080p TVs keep the light sizes.
 */
const STEPS: Record<string, string> = { w185: "w342", w342: "w500", w500: "w780", w780: "w1280", w300: "w780" };
let big: boolean | null = null;

export function isBigScreen() {
  if (big === null) big = typeof window !== "undefined" && window.innerWidth * (window.devicePixelRatio || 1) >= 2560;
  return big;
}

export function sizedImage<T extends string | null | undefined>(url: T): T {
  if (!url || !isBigScreen() || !url.includes("image.tmdb.org/t/p/")) return url;
  return url.replace(/\/t\/p\/(w\d+)\//, (m, size: string) => (STEPS[size] ? `/t/p/${STEPS[size]}/` : m)) as T;
}

/** Test hook. */
export function setBigScreenForTest(v: boolean | null) { big = v; }
