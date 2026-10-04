import React, { useEffect, useState } from 'react';
import { KinomaLogo } from '../components/ui/KinomaLogo';

const INTRO_KEY = 'mypanda_intro_seen';

export function PandaIntro({ onComplete }: { onComplete: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduceMotion ? 700 : 2300;

    const exitTimer = window.setTimeout(() => setLeaving(true), Math.max(0, duration - 420));
    const completeTimer = window.setTimeout(() => {
      try { sessionStorage.setItem(INTRO_KEY, '1'); } catch {}
      onComplete();
    }, duration);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className={`panda-intro ${leaving ? 'is-leaving' : ''}`} role="presentation" aria-label="mypanda.fun">
      <div className="panda-intro__content">
        <div className="panda-intro__mascot">
          <KinomaLogo size="xl" variant="mark" className="panda-intro__mark" />
        </div>
        <div className="panda-intro__wordmark" aria-label="mypanda.fun">
          mypanda<span>.fun</span>
        </div>
      </div>
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
