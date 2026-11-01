export function getRouteDepth(path: string): number {
  if (path.startsWith('/watch/')) return 2;
  if (path.startsWith('/details/')) return 1;
  return 0;
}

export function getRouteTransitionDirection(previousPath: string, nextPath: string): -1 | 0 | 1 {
  const delta = getRouteDepth(nextPath) - getRouteDepth(previousPath);
  return delta === 0 ? 0 : delta > 0 ? 1 : -1;
}
