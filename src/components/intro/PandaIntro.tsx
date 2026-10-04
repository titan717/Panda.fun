import React, { useEffect, useRef, useState } from 'react';
import { KinomaLogo } from '../ui/KinomaLogo';

const INTRO_KEY = 'mypanda_intro_seen';

async function playPandaIntroAudio() {
  if (typeof window === 'undefined') return false;

  const AudioContextCtor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) return false;

  const context = new AudioContextCtor();
  try {
    await context.resume();

    if (context.state !== 'running') {
      await context.close();
      return false;
    }

    const now = context.currentTime;
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.075, now + 0.16);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 2.15);
    master.connect(context.destination);

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1500, now);
    filter.Q.setValueAtTime(0.7, now);
    filter.connect(master);

    const notes = [
      { frequency: 196, start: 0.05, duration: 0.95 },
      { frequency: 246.94, start: 0.20, duration: 1.10 },
      { frequency: 293.66, start: 0.43, duration: 1.25 },
      { frequency: 392, start: 0.72, duration: 1.15 },
    ];

    notes.forEach(({ frequency, start, duration }) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, now + start);
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.18, now + start + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
      oscillator.connect(gain);
      gain.connect(filter);
      oscillator.start(now + start);
      oscillator.stop(now + start + duration + 0.04);
    });

    window.setTimeout(() => void context.close(), 2400);
    return true;
  } catch {
    try { await context.close(); } catch {}
    return false;
  }
}

export function PandaIntro({ onComplete }: { onComplete: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduceMotion ? 700 : 2300;

    void playPandaIntroAudio().then(played => {
      if (!played) setSoundBlocked(true);
    });

    const exitTimer = window.setTimeout(() => setLeaving(true), Math.max(0, duration - 420));
    const completeTimer = window.setTimeout(() => {
      if (completedRef.current) return;
      completedRef.current = true;
      try { sessionStorage.setItem(INTRO_KEY, '1'); } catch {}
      onComplete();
    }, duration);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(completeTimer);
    };
  }, [onComplete]);

  const enableSound = async () => {
    const played = await playPandaIntroAudio();
    if (played) setSoundBlocked(false);
  };

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

      {soundBlocked && (
        <button
          type="button"
          className="panda-intro__sound"
          onClick={() => void enableSound()}
          aria-label="Enable intro sound"
        >
          <span aria-hidden="true">🔊</span>
          Enable sound
        </button>
      )}
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
