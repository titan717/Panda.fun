import { useEffect, useState } from 'react';
import { getCurrentDeviceMode } from '../lib/deviceCapabilities';

export function useIsTv() {
  const [isTv, setIsTv] = useState(() => getCurrentDeviceMode() === 'tv');
  useEffect(() => {
    const sync = () => setIsTv(getCurrentDeviceMode() === 'tv');
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);
  return isTv;
}
