/* Surface hook for the Trailer Autoplay Manager: reads the profile's trailer preferences (docs/TRAILERS.md). */
import { useLiteMotion } from "./hooks";
import { usePrefs } from "./store";
import { useTrailerAutoplay, useTrailerPolicy, type TrailerAutoplay } from "./trailerAutoplay";

export type TrailerSurface = "tv-hero" | "tv-row" | "tv-details" | "m-hero" | "m-details";

/**
 * Background trailer for one surface. `key` is the active title's id (null = nothing active, e.g. focus left
 * the hero, the card scrolled away); `enabled` carries surface conditions (no overlay open, Details zone).
 * Respects Settings › Autoplay trailers, Trailers in rows (row surfaces), Trailer delay, Reduce motion,
 * Stream quality "Data Saver", browser data saver / slow connections, low-memory devices and page visibility.
 */
export function useSurfaceTrailer(surface: TrailerSurface, key: string | null, enabled = true): TrailerAutoplay {
  const prefs = usePrefs();
  const lite = useLiteMotion();
  useTrailerPolicy({ reduceMotion: prefs.reduceMotion, qualityDataSaver: prefs.quality === "480", lite });
  const allowed = enabled && prefs.trailerAutoplay && (surface !== "tv-row" || prefs.rowTrailers);
  return useTrailerAutoplay(surface, allowed ? key : null, prefs.trailerDelay);
}
