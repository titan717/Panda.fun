import React, { useState } from 'react';
import { m } from 'motion/react';
import { Film } from 'lucide-react';
import { useMotionPreference } from '../motion';
import './media-poster.css';

export function MediaPoster({
  src, alt, layoutId, size = 'md', priority = false,
}: { src?: string; alt: string; layoutId?: string; size?: 'sm'|'md'|'lg'|'tv'; priority?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const preference = useMotionPreference();
  const reduced = preference !== 'full';
  return (
    <m.div
      layoutId={layoutId}
      className={`media-poster media-poster--${size}${loaded ? ' is-loaded' : ''}${failed ? ' is-fallback' : ''}`}
      transition={reduced ? { duration: 0.01 } : { type: 'spring', stiffness: 420, damping: 34 }}
    >
      {!failed && src && (
        <img src={src} alt={alt} loading={priority ? 'eager' : 'lazy'} decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
      )}
      {(!src || failed) && <div className="media-poster__fallback" aria-hidden="true"><Film size={28} /></div>}
      {!loaded && !failed && <div className="media-poster__skeleton" aria-hidden="true" />}
    </m.div>
  );
}
