import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  initialUpdateState,
  parseNativeStatus,
  updateReducer,
  type UpdateSource,
} from './appUpdateState';
import { applyPWAUpdate, checkForPWAUpdate } from './usePWAUpdate';

declare const __APP_VERSION__: string | undefined;

type NativeBridge = {
  getAppVersion?: () => string;
  checkForUpdates?: () => void;
  checkForUpdatesManual?: () => void;
  downloadUpdate?: () => void;
  cancelUpdateDownload?: () => void;
  installUpdate?: () => void;
  openInstallPermissionSettings?: () => void;
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
    const onProgress = (event: Event) => {
      const detail = (event as CustomEvent).detail as Record<string, unknown> | undefined;
      if (!detail || typeof detail !== 'object') return;
      dispatch({
        type: 'download-progress',
        percent: typeof detail.percent === 'number' ? detail.percent : 0,
        downloadedBytes: typeof detail.downloadedBytes === 'number' ? detail.downloadedBytes : 0,
        totalBytes: typeof detail.totalBytes === 'number' ? detail.totalBytes : 0,
      });
    };
    const onPwaReady = () => dispatch({ type: 'available', at: Date.now() });

    window.addEventListener('panda_native_update_status', onNative);
    window.addEventListener('kinoma_update_progress', onProgress);
    window.addEventListener('panda_pwa_update_ready', onPwaReady);
    return () => {
      clearTimer();
      window.removeEventListener('panda_native_update_status', onNative);
      window.removeEventListener('kinoma_update_progress', onProgress);
      window.removeEventListener('panda_pwa_update_ready', onPwaReady);
    };
  }, []);

  const check = useCallback(async () => {
    dispatch({ type: 'check-started' });
    const native = getNativeBridge();

    if (native) {
      if (typeof native.checkForUpdatesManual === 'function') {
        clearTimer();
        timerRef.current = window.setTimeout(() => {
          dispatch({ type: 'error', at: Date.now(), message: 'The app did not respond. Please try again.' });
        }, NATIVE_RESPONSE_TIMEOUT_MS);
        native.checkForUpdatesManual();
      } else {
        // Older APKs only expose a silent check that shows its own dialog if an update exists.
        native.checkForUpdates?.();
        dispatch({ type: 'handed-off', message: 'Check started. If an update is available, a prompt will appear.' });
      }
      return;
    }

    const result = await checkForPWAUpdate();
    if (result === 'available') dispatch({ type: 'available', at: Date.now() });
    else if (result === 'up-to-date') dispatch({ type: 'up-to-date', at: Date.now() });
    else if (result === 'unsupported') {
      dispatch({ type: 'error', at: Date.now(), message: 'Updates are managed by your browser on this device. Reload the page to get the latest version.' });
    } else dispatch({ type: 'error', at: Date.now(), message: "Couldn't check for updates. Check your connection and try again." });
  }, []);

  const apply = useCallback(async () => {
    const native = getNativeBridge();
    if (native) {
      dispatch({ type: 'applying' });
      if (typeof native.downloadUpdate === 'function') native.downloadUpdate();
      else native.checkForUpdates?.();
      return;
    }
    dispatch({ type: 'applying' });
    await applyPWAUpdate();
  }, []);

  const cancel = useCallback(() => {
    getNativeBridge()?.cancelUpdateDownload?.();
    dispatch({ type: 'later' });
  }, []);

  const install = useCallback(() => {
    getNativeBridge()?.installUpdate?.();
  }, []);

  const openInstallPermissionSettings = useCallback(() => {
    getNativeBridge()?.openInstallPermissionSettings?.();
  }, []);

  const later = useCallback(() => dispatch({ type: 'later' }), []);

  return { state, check, apply, cancel, install, openInstallPermissionSettings, later };
}
