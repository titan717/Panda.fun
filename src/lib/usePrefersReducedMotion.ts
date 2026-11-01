import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export function readPrefersReducedMotion(win: Pick<Window, 'matchMedia'> | undefined = typeof window === 'undefined' ? undefined : window): boolean {
  try {
    return Boolean(win?.matchMedia?.(QUERY).matches);
  } catch {
    return false;
  }
}

/** Live `prefers-reduced-motion` preference, used to avoid auto-playing motion (trailers, carousels). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => readPrefersReducedMotion());
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia(QUERY);
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
  return reduced;
}
