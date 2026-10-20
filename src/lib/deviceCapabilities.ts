export type DeviceMode = 'tv' | 'mobile' | 'tablet' | 'desktop';

export interface DeviceCapabilitySignals {
  /** Explicit native TV result. When true, it takes precedence over viewport/input signals. */
  nativeTv?: boolean | null;
  viewportWidth?: number;
  hasTouch?: boolean;
  coarsePointer?: boolean;
  maxTouchPoints?: number;
}

const TABLET_MIN_WIDTH = 768;

/**
 * Selects presentation mode without relying on viewport width as a TV detector.
 * Missing/invalid viewport measurements use the safe desktop fallback unless native TV is known.
 */
export function getDeviceMode(signals: DeviceCapabilitySignals): DeviceMode {
  if (signals.nativeTv === true) return 'tv';

  const width = signals.viewportWidth;
  if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) return 'desktop';

  const touchFirst = signals.hasTouch === true
    || signals.coarsePointer === true
    || (typeof signals.maxTouchPoints === 'number' && signals.maxTouchPoints > 0);

  if (!touchFirst) return 'desktop';
  return width < TABLET_MIN_WIDTH ? 'mobile' : 'tablet';
}

type NativeWindow = Window & {
  isKinomaAndroidTV?: boolean;
  KinomaNative?: { isTV?: () => boolean };
};

/** Read current runtime capabilities. Safe to call in browsers and unit tests. */
export function getCurrentDeviceMode(): DeviceMode {
  if (typeof window === 'undefined') return 'desktop';

  const runtime = window as NativeWindow;
  let nativeTv: boolean | undefined;
  try {
    if (typeof runtime.KinomaNative?.isTV === 'function') {
      nativeTv = runtime.KinomaNative.isTV() === true;
    } else if (typeof runtime.isKinomaAndroidTV === 'boolean') {
      nativeTv = runtime.isKinomaAndroidTV;
    }
  } catch {
    nativeTv = runtime.isKinomaAndroidTV === true;
  }

  let coarsePointer = false;
  try {
    coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  } catch {
    // Older WebViews may not implement matchMedia; touch points remain available.
  }

  return getDeviceMode({
    nativeTv,
    viewportWidth: window.innerWidth,
    hasTouch: 'ontouchstart' in window,
    coarsePointer,
    maxTouchPoints: typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
  });
}
