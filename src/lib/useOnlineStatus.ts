import { useEffect, useState } from 'react';

/** Tracks navigator.onLine. Defaults to online when the API is unavailable (SSR, old WebViews). */
export function readOnlineStatus(nav: Pick<Navigator, 'onLine'> | undefined = typeof navigator === 'undefined' ? undefined : navigator): boolean {
  if (!nav || typeof nav.onLine !== 'boolean') return true;
  return nav.onLine;
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => readOnlineStatus());
  useEffect(() => {
    const update = () => setOnline(readOnlineStatus());
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}
