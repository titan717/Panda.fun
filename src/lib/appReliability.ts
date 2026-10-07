export function isRecoverableChunkLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [^ ]+ failed/i.test(message);
}

export function shouldResetErrorBoundary(
  previousRoute: string | undefined,
  nextRoute: string | undefined,
  hasError: boolean
) {
  return hasError && previousRoute !== nextRoute;
}
