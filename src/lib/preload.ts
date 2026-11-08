import { sizedImage } from "./imageTier";
/** Image warm-up (§8): fetch images the user is about to reach so they are decoded before focus lands on them. */
const seen = new Set<string>();
const MAX = 400;

export function preloadImages(urls: Array<string | null | undefined>, limit = 24) {
  let n = 0;
  for (const raw of urls) {
    const url = sizedImage(raw);
    if (!url || seen.has(url)) continue;
    if (n >= limit) break;
    n++;
    if (seen.size > MAX) seen.clear();
    seen.add(url);
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  }
  return n;
}

export function preloadedCount() { return seen.size; }
export function resetPreload() { seen.clear(); }
