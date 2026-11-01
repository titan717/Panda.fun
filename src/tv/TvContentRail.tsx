import React, { useEffect, useRef, useState } from 'react';
import { useDpadFocus } from './useDpadFocus';
import { TvRailCard } from './TvRailCard';
import type { AnimeItem } from '../types';

const POSTER_WIDTH = 240;
const BUFFER = 4;

export function TvContentRail({ title, items }: { title: string; items: AnimeItem[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const start = Math.max(0, Math.floor(scrollLeft / POSTER_WIDTH) - BUFFER);
  const end = Math.min(items.length, Math.ceil((scrollLeft + viewportWidth) / POSTER_WIDTH) + BUFFER);
  const visible = items.slice(start, end);

  if (!items.length) {
    return (
      <section className="tv-rail" aria-label={title}>
        <h2 className="tv-rail__title">{title}</h2>
        <div className="tv-rail__empty"><p>Nothing here yet.</p></div>
      </section>
    );
  }

  return (
    <section className="tv-rail" aria-label={title}>
      <h2 className="tv-rail__title">{title}</h2>
      <div
        ref={railRef}
        className="tv-rail__track"
        onScroll={e => setScrollLeft(e.currentTarget.scrollLeft)}
      >
        {visible.map((item, i) => (
          <TvRailCard
            key={item.id}
            item={item}
            railTitle={title}
            index={start + i}
            offsetLeft={(start + i) * POSTER_WIDTH}
          />
        ))}
      </div>
    </section>
  );
}
