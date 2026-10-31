const TECHNICAL_ERROR = /failed to fetch|networkerror|load failed|unexpected token|is not valid json|aborterror|err_|cors|typeerror/i;

export const OFFLINE_MESSAGE = "You're offline. Check your connection and try again.";

/**
 * Turns a thrown error into copy that is safe to show users: offline gets a
 * clear reconnect message and low-level fetch/parser errors get the fallback.
 */
export function friendlyNetworkError(error: unknown, fallback: string, online: boolean = typeof navigator === 'undefined' || navigator.onLine !== false): string {
  if (!online) return OFFLINE_MESSAGE;
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (!message.trim() || TECHNICAL_ERROR.test(message)) return fallback;
  return message;
}
