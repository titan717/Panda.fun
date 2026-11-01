import { useEffect, useState } from 'react';
import { getCurrentDeviceMode } from '../lib/deviceCapabilities';
import { MotionPreference, resolveMotionPreference } from './tokens';

function readMotionPreference(): MotionPreference {
  if (typeof window === 'undefined') return 'full';
  let prefersReducedMotion = false;
  try {
    prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    // Older WebViews may not expose matchMedia.
  }
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const hardware = navigator as Navigator & { deviceMemory?: number };
  const lowEndDevice = getCurrentDeviceMode() !== 'tv' && (
    (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4) ||
    (typeof hardware.deviceMemory === 'number' && hardware.deviceMemory <= 4)
  );
  return resolveMotionPreference({
    prefersReducedMotion,
    saveData: connection?.saveData === true,
    lowEndDevice,
  });
}

export function useMotionPreference(): MotionPreference {
  const [preference, setPreference] = useState<MotionPreference>(readMotionPreference);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => setPreference(readMotionPreference());
    media?.addEventListener?.('change', update);
    window.addEventListener('pageshow', update);
    window.addEventListener('resize', update, { passive: true });
    const connection = (navigator as Navigator & { connection?: EventTarget }).connection;
    connection?.addEventListener?.('change', update);
    return () => {
      media?.removeEventListener?.('change', update);
      window.removeEventListener('pageshow', update);
      window.removeEventListener('resize', update);
      connection?.removeEventListener?.('change', update);
    };
  }, []);

  return preference;
}
