import { useCallback } from "react";
import { useLocation } from "wouter";

/**
 * In-app navigation depth so Back behaves like a native app: it pops in-app history when there is some,
 * otherwise falls back to the screen's logical parent (deep links) and finally Home.
 */
let depth = 0;

export function useNav() {
  const [location, navigate] = useLocation();
  const go = useCallback((to: string, opts?: { replace?: boolean }) => {
    if (!opts?.replace) depth++;
    navigate(to, opts);
  }, [navigate]);
  const back = useCallback((fallback = "/") => {
    if (depth > 0) window.history.back();
    else navigate(fallback, { replace: true });
  }, [navigate]);
  return { location, go, back };
}

/** Browser back/forward buttons also change depth. */
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => { if (depth > 0) depth--; });
}

export const BUILD_TARGET: string = __BUILD_TARGET__;
