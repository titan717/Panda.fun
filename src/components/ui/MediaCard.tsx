import React, { useState } from 'react';
import { m } from 'motion/react';
import { Film } from 'lucide-react';
import { useMotionPreference } from '../motion';
import './media-card.css';

export function MediaCard({
  src, alt, layoutId, size = 'md', priority = false, progress = 0,
}: { src?: string; alt: string; layoutId?: string; size?: 'sm'|'md'|'lg'|'tv'; priority?: boolean; progress?: number }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const preference = useMotionPreference();
  const reduced = preference !== 'full';
  return (
    <m.div
      layoutId={layoutId}
      className={`media-card media-card--${size}${loaded ? ' is-loaded' : ''}${failed ? ' is-fallback' : ''}`}
      transition={reduced ? { duration: 0.01 } : { type: 'spring', stiffness: 420, damping: 34 }}
    >
      {!failed && src && (
        <img src={src} alt={alt} loading={priority ? 'eager' : 'lazy'} decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
      )}
      {(!src || failed) && <div className="media-card__fallback" aria-hidden="true"><Film size={28} /></div>}
      {!loaded && !failed && <div className="media-card__skeleton" aria-hidden="true" />}
      {progress > 0 && (
        <div className="media-card__progress" aria-label={`${Math.round(progress)}% watched`}>
          <span style={{ transform: `scaleX(${Math.min(progress, 100) / 100})` }} />
        </div>
      )}
    </m.div>
  );
}
