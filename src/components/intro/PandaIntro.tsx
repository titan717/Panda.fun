import React, { useEffect, useRef, useState } from 'react';

const INTRO_KEY = 'mypanda_intro_seen';

export function PandaIntro({ onComplete }: { onComplete: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const completedRef = useRef(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const finishTimerRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);

  onCompleteRef.current = onComplete;

  const finish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setLeaving(true);
    finishTimerRef.current = window.setTimeout(() => {
      try { sessionStorage.setItem(INTRO_KEY, '1'); } catch {}
      onCompleteRef.current();
    }, 420);
  };

  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type === 'panda-intro-end') finishRef.current();
    };
    window.addEventListener('message', handleMessage);
    const fallbackTimer = window.setTimeout(() => finishRef.current(), 10000);
    return () => {
      window.removeEventListener('message', handleMessage);
      window.clearTimeout(fallbackTimer);
      if (finishTimerRef.current !== null) window.clearTimeout(finishTimerRef.current);
    };
  }, []);

  return (
    <div className={`panda-intro ${leaving ? 'is-leaving' : ''}`} role="presentation">
      <iframe
        ref={frameRef}
        className="panda-intro__asset-frame"
        src="/intro/panda-intro.html"
        title="Panda.fun launch animation"
        aria-hidden="true"
        tabIndex={-1}
        onError={() => finishRef.current()}
        allow="autoplay"
      />
    </div>
  );
}

export function shouldShowPandaIntro() {
  try {
    return sessionStorage.getItem(INTRO_KEY) !== '1';
  } catch {
    return true;
  }
}
