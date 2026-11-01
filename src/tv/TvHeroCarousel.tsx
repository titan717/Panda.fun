import React, { useEffect, useRef, useState } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { Play, Info } from 'lucide-react';
import { useDpadFocus } from './useDpadFocus';
import { useMotionPreference } from '../motion';
import { buildDetailsHref, buildWatchHref } from '../lib/mediaRoute';
import type { AnimeItem } from '../types';

export function TvHeroCarousel({ items }: { items: AnimeItem[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const preference = useMotionPreference();
  const reduced = preference !== 'full';
  const playRef = useDpadFocus('hero-play');
  const infoRef = useDpadFocus('hero-info');
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (paused || reduced || items.length < 2) return;
    timer.current = window.setInterval(() => setIndex(i => (i + 1) % items.length), 7000);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [paused, reduced, items.length]);

  if (!items.length) return null;
  const item = items[index];
  const title = typeof item.title === 'string' ? item.title : item.title.english || 'Untitled';
  const type = item.contentType === 'movie' ? 'movie' : 'series';

  return (
    <section
      className="tv-hero"
      aria-label="Featured titles"
      onKeyDown={e => {
        if (e.key === 'ArrowLeft') setIndex(i => (i - 1 + items.length) % items.length);
        if (e.key === 'ArrowRight') setIndex(i => (i + 1) % items.length);
      }}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <AnimatePresence mode="wait">
        <m.div
          key={item.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.01 : 0.5 }}
          className="tv-hero__slide"
        >
          <img src={item.banner || item.cover || item.image} alt="" className="tv-hero__backdrop" />
          <div className="tv-hero__scrim" />
          <div className="tv-hero__content">
            <h1 className="tv-hero__title">{title}</h1>
            <p className="tv-hero__meta">{item.genres?.slice(0, 3).join(' • ')}</p>
            <div className="tv-hero__actions">
              <button
                ref={playRef as any}
                className="tv-hero__button tv-hero__button--play"
                onClick={() => window.location.assign(buildWatchHref(item.id, type, 1, 1, 0))}
              >
                <Play size={20} fill="currentColor" /> Play
              </button>
              <button
                ref={infoRef as any}
                className="tv-hero__button tv-hero__button--info"
                onClick={() => window.location.assign(buildDetailsHref({ title, id: item.id }, type))}
              >
                <Info size={20} /> More Info
              </button>
            </div>
          </div>
        </m.div>
      </AnimatePresence>
      <div className="tv-hero__dots" aria-hidden="true">
        {items.map((_, i) => <span key={i} className={`tv-hero__dot${i === index ? ' is-active' : ''}`} />)}
      </div>
    </section>
  );
}
