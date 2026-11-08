import { lazy, type ComponentType } from "react";

type Props<C> = C extends ComponentType<infer P> ? P : never;

/** Lazy-load a named export, keeping its props. Repeated calls share the module promise, so prefetching warms the same chunk. */
export function lazyNamed<M, K extends keyof M>(load: () => Promise<M>, key: K) {
  return lazy(async () => ({ default: (await load())[key] as unknown as ComponentType<Props<M[K]>> }));
}

/** Run once the main thread is idle (falls back to a timeout on WebViews without requestIdleCallback). */
export function whenIdle(fn: () => void, timeout = 2500) {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout });
  else setTimeout(fn, 1200);
}
