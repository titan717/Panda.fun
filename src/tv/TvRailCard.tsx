import React from 'react';
import { useDpadFocus } from './useDpadFocus';
import { MediaPoster } from '../components/ui/MediaPoster';
import { buildDetailsHref } from '../lib/mediaRoute';
import type { AnimeItem } from '../types';

export function TvRailCard({ item, railTitle, index, offsetLeft }: {
  item: AnimeItem; railTitle: string; index: number; offsetLeft: number;
}) {
  const ref = useDpadFocus(`rail-${railTitle}-${item.id}`);
  const title = typeof item.title === 'string' ? item.title : item.title.english || 'Untitled';
  const type = item.contentType === 'movie' ? 'movie' : 'series';
  return (
    <button
      ref={ref as any}
      className="tv-rail__card"
      style={{ position: 'absolute', left: offsetLeft }}
      onClick={() => window.location.assign(buildDetailsHref({ title, id: item.id }, type))}
      aria-label={`Open ${title}`}
    >
      <MediaPoster src={item.image} alt={title} layoutId={`poster-${item.id}`} size="tv" priority={index < 3} />
      <span className="tv-rail__label">{title}</span>
    </button>
  );
}
