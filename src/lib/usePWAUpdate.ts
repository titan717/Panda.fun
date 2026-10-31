import { useEffect } from 'react';
import { registerSW } from 'virtual:pwa-register';

let updateReady: (() => Promise<void>) | null = null;
let swRegistration: ServiceWorkerRegistration | null = null;

export function usePWAUpdate() {
  useEffect(() => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        updateReady = async () => {
          try {
            await updateSW(true);
          } finally {
            updateReady = null;
          }
        };
        window.dispatchEvent(new CustomEvent('panda_pwa_update_ready'));
      },
      onOfflineReady() {
        window.dispatchEvent(new CustomEvent('panda_pwa_offline_ready'));
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        swRegistration = registration;
        const refresh = () => registration.update().catch(() => undefined);
        window.setInterval(refresh, 60 * 60 * 1000);
      },
    });

    return () => {
      updateReady = null;
    };
  }, []);
}

export async function applyPWAUpdate() {
  if (updateReady) {
    await updateReady();
    return;
  }
  // The new worker already took over (auto-update); a reload loads the fresh assets.
  window.location.reload();
}

export type PWACheckResult = 'unsupported' | 'up-to-date' | 'available' | 'error';

export async function checkForPWAUpdate(): Promise<PWACheckResult> {
  const registration = swRegistration;
  if (!registration) return 'unsupported';
  try {
    if (updateReady || registration.waiting) return 'available';
    await registration.update();
    if (registration.waiting) return 'available';
    const installing = registration.installing;
    if (!installing) return 'up-to-date';
    return await new Promise<PWACheckResult>(resolve => {
      const timer = window.setTimeout(() => resolve('error'), 15000);
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' || installing.state === 'activated') {
          window.clearTimeout(timer);
          resolve('available');
        } else if (installing.state === 'redundant') {
          window.clearTimeout(timer);
          resolve('error');
        }
      });
    });
  } catch {
    return 'error';
  }
}
