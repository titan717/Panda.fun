import { VIDY_BASE_URL } from './vidy';

export const VIDY_ORIGIN = new URL(VIDY_BASE_URL).origin;

export type VidyPlaybackEventName = 'play' | 'pause' | 'timeupdate' | 'ended';

export interface VidyPlaybackEvent {
  event: VidyPlaybackEventName;
  currentTime: number;
  duration: number;
}

function nonNegativeFinite(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

/**
 * Accepts only playback messages emitted by the currently mounted Vidy iframe.
 * Vidy sends JSON strings through window.postMessage to the parent page.
 */
export function parseVidyPlaybackMessage(
  event: MessageEvent<unknown>,
  expectedSource: Window | null,
  expectedOrigin = VIDY_ORIGIN
): VidyPlaybackEvent | null {
  if (!expectedSource || event.source !== expectedSource || event.origin !== expectedOrigin) {
    return null;
  }

  if (typeof event.data !== 'string') return null;

  let payload: unknown;
  try {
    payload = JSON.parse(event.data);
  } catch {
    return null;
  }

  if (!payload || typeof payload !== 'object') return null;

  const candidate = payload as { event?: unknown; currentTime?: unknown; duration?: unknown };
  if (
    candidate.event !== 'play' &&
    candidate.event !== 'pause' &&
    candidate.event !== 'timeupdate' &&
    candidate.event !== 'ended'
  ) {
    return null;
  }

  return {
    event: candidate.event,
    currentTime: nonNegativeFinite(candidate.currentTime),
    duration: nonNegativeFinite(candidate.duration),
  };
}
