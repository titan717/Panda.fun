export type EpisodeRailResizeObserver = {
  observe(target: Element): void;
  disconnect(): void;
};

export type EpisodeRailResizeObserverConstructor = new (
  callback: ResizeObserverCallback
) => EpisodeRailResizeObserver;

export function createEpisodeRailObserver(
  Observer: EpisodeRailResizeObserverConstructor | undefined,
  rail: Element | null,
  callback: ResizeObserverCallback
) {
  if (!Observer || !rail) return () => {};

  let observer: EpisodeRailResizeObserver | null = null;
  try {
    observer = new Observer(callback);
    observer.observe(rail);
  } catch {
    observer?.disconnect();
    return () => {};
  }

  return () => observer?.disconnect();
}
