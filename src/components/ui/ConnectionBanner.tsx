import { useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../lib/useOnlineStatus';

/**
 * Global connection notice. Shows a persistent banner while offline and a
 * short "back online" confirmation once the connection returns.
 */
export function ConnectionBanner() {
  const online = useOnlineStatus();
  const wasOffline = useRef(!online);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setShowRestored(false);
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    setShowRestored(true);
    const timer = window.setTimeout(() => setShowRestored(false), 3200);
    return () => window.clearTimeout(timer);
  }, [online]);

  if (online && !showRestored) return <div className="panda-connection-banner-region" role="status" aria-live="polite" />;

  return (
    <div className="panda-connection-banner-region" role="status" aria-live="polite">
      <div className={`panda-connection-banner ${online ? 'is-online' : 'is-offline'}`}>
        {online ? <Wifi size={16} aria-hidden="true" /> : <WifiOff size={16} aria-hidden="true" />}
        <p>
          <strong>{online ? 'Back online' : "You're offline"}</strong>
          <span>{online ? 'Browsing and playback are available again.' : 'Your library and settings still work. Browsing and playback need a connection.'}</span>
        </p>
      </div>
    </div>
  );
}
