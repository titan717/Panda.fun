import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  initialUpdateState,
  parseNativeStatus,
  updateReducer,
  type UpdateSource,
} from './appUpdateState';
import { applyPWAUpdate, checkForPWAUpdate, type PWACheckResult } from './usePWAUpdate';
import type { AppUpdateEvent } from './appUpdateState';

declare const __APP_VERSION__: string | undefined;

type NativeBridge = {
  getAppVersion?: () => string;
  checkForUpdates?: () => void;
  checkForUpdatesManual?: () => void;
  downloadUpdate?: () => void;
};

const NATIVE_RESPONSE_TIMEOUT_MS = 15000;

function getNativeBridge(): NativeBridge | null {
  if (typeof window === 'undefined') return null;
  const bridge = (window as unknown as { KinomaNative?: NativeBridge }).KinomaNative;
  return bridge && typeof bridge.checkForUpdates === 'function' ? bridge : null;
}

function readVersion(bridge: NativeBridge | null): string | null {
  try {
    if (bridge?.getAppVersion) return bridge.getAppVersion() || null;
  } catch {
    /* fall through to the web version */
  }
  return typeof __APP_VERSION__ === 'string' && __APP_VERSION__ ? __APP_VERSION__ : null;
}

export const UPDATE_MESSAGES = {
  offline: "You're offline. Connect to the internet, then check for updates again.",
  nativeTimeout: 'The app did not respond. Please try again.',
  downloadTimeout: "The download didn't start. Please try again.",
  nativeFailed: "Couldn't reach the app's updater. Please try again.",
  legacyCheck: 'Check started. If an update is available, a prompt will appear.',
  legacyDownload: 'Update handed to the app. Follow the prompt to install it.',
  browserManaged: 'Updates are managed by your browser here. Reload the page any time to get the latest version.',
  webFailed: "Couldn't check for updates. Check your connection and try again.",
  applyFailed: "Couldn't apply the update. Reload the page to try again.",
} as const;

type Dispatch = (event: AppUpdateEvent) => void;
interface UpdateFlowEnv {
  bridge: NativeBridge | null;
  online: boolean;
  dispatch: Dispatch;
  startNativeTimer: (message: string) => void;
  clearTimer: () => void;
}

function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/** Manual "Check for updates" flow. Pure enough to unit test with a fake bridge. */
export async function runUpdateCheck(env: UpdateFlowEnv & { checkWeb: () => Promise<PWACheckResult> }) {
  const { bridge, online, dispatch } = env;
  if (!online) {
    dispatch({ type: 'error', at: Date.now(), message: UPDATE_MESSAGES.offline });
    return;
  }
  dispatch({ type: 'check-started' });

  if (bridge) {
    try {
      if (typeof bridge.checkForUpdatesManual === 'function') {
        env.startNativeTimer(UPDATE_MESSAGES.nativeTimeout);
        bridge.checkForUpdatesManual();
      } else {
        // Older APKs only expose a silent check that shows its own dialog if an update exists.
        bridge.checkForUpdates?.();
        dispatch({ type: 'handed-off', message: UPDATE_MESSAGES.legacyCheck });
      }
    } catch {
      env.clearTimer();
      dispatch({ type: 'error', at: Date.now(), message: UPDATE_MESSAGES.nativeFailed });
    }
    return;
  }

  let result: PWACheckResult = 'error';
  try {
    result = await env.checkWeb();
  } catch {
    result = 'error';
  }
  if (result === 'available') dispatch({ type: 'available', at: Date.now() });
  else if (result === 'up-to-date') dispatch({ type: 'up-to-date', at: Date.now() });
  // Not an error: dev builds, private windows and some browsers have no service worker.
  else if (result === 'unsupported') dispatch({ type: 'handed-off', message: UPDATE_MESSAGES.browserManaged });
  else dispatch({ type: 'error', at: Date.now(), message: UPDATE_MESSAGES.webFailed });
}

/** "Download update" / "Reload to update" flow. */
export async function runUpdateApply(env: UpdateFlowEnv & { applyWeb: () => Promise<void> }) {
  const { bridge, online, dispatch } = env;
  if (!online) {
    dispatch({ type: 'error', at: Date.now(), message: UPDATE_MESSAGES.offline });
    return;
  }
  dispatch({ type: 'applying' });
  if (bridge) {
    try {
      if (typeof bridge.downloadUpdate === 'function') {
        // MainActivity emits "downloading" (clears the timer) or "error".
        env.startNativeTimer(UPDATE_MESSAGES.downloadTimeout);
        bridge.downloadUpdate();
      } else {
        bridge.checkForUpdates?.();
        dispatch({ type: 'handed-off', message: UPDATE_MESSAGES.legacyDownload });
      }
    } catch {
      env.clearTimer();
      dispatch({ type: 'error', at: Date.now(), message: UPDATE_MESSAGES.nativeFailed });
    }
    return;
  }
  try {
    await env.applyWeb();
  } catch {
    dispatch({ type: 'error', at: Date.now(), message: UPDATE_MESSAGES.applyFailed });
  }
}

export function useAppUpdates() {
  const bridge = getNativeBridge();
  const source: UpdateSource = bridge ? 'android' : 'web';
  const [state, dispatch] = useReducer(updateReducer, source, initialUpdateState);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    dispatch({ type: 'version', value: readVersion(getNativeBridge()) });

    const onNative = (event: Event) => {
      const parsed = parseNativeStatus((event as CustomEvent).detail, Date.now());
      if (!parsed) return;
      clearTimer();
      dispatch(parsed);
    };
    const onPwaReady = () => dispatch({ type: 'available', at: Date.now() });

    window.addEventListener('panda_native_update_status', onNative);
    window.addEventListener('panda_pwa_update_ready', onPwaReady);
    return () => {
      clearTimer();
      window.removeEventListener('panda_native_update_status', onNative);
      window.removeEventListener('panda_pwa_update_ready', onPwaReady);
    };
  }, []);

  const startNativeTimer = (message: string) => {
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      dispatch({ type: 'error', at: Date.now(), message });
    }, NATIVE_RESPONSE_TIMEOUT_MS);
  };

  const check = useCallback(async () => {
    await runUpdateCheck({ bridge: getNativeBridge(), online: isOnline(), checkWeb: checkForPWAUpdate, dispatch, startNativeTimer, clearTimer });
  }, []);

  const apply = useCallback(async () => {
    await runUpdateApply({ bridge: getNativeBridge(), online: isOnline(), applyWeb: applyPWAUpdate, dispatch, startNativeTimer, clearTimer });
  }, []);

  return { state, check, apply };
}
