import React, { useState } from 'react';
import { Link } from 'wouter';
import { Play, X } from 'lucide-react';
import { AnimeItem, DEFAULT_POSTER } from '../../../types';
import { slugifyTitle } from '../../../lib/slug';

export interface ModernCardProps {
  key?: React.Key;
  item: AnimeItem;
  badgeText?: string;
  subText?: string;
  currentEpisode?: number;
  layout?: 'standard' | 'wide';
  href?: string;
  onRemove?: () => void;
}

export function ModernCard({
  item,
  badgeText,
  subText,
  href,
  onRemove
}: ModernCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  const title = typeof item.title === 'string'
    ? item.title
    : item.title?.english || item.title?.romaji || 'Unknown Anime';

  const detailHref = href || `/details/${slugifyTitle(title)}?type=${item.type === 'movie' ? 'movie' : 'series'}`;
  const defaultBadge = badgeText || (item.status === 'RELEASING' ? 'New Season' : undefined);

  return (
    <div
      role="link"
      tabIndex={0}
      className="group relative flex w-full flex-col select-none rounded-2xl outline-none"
      aria-label={`Open ${title}`}
      onClick={() => { window.location.href = detailHref; }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          window.location.href = detailHref;
        }
      }}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-white/5 bg-[#0e1017] transition-[transform,border-color,box-shadow] duration-300 group-hover:-translate-y-1 group-hover:border-purple-500/40 group-hover:shadow-[0_12px_32px_rgba(0,0,0,0.6)]">
        <span className="kinoma-focus absolute inset-0 z-0 block rounded-2xl">
          {!imageLoaded && (
            <div className="absolute inset-0 animate-pulse bg-[#12141c]" aria-hidden="true" />
          )}

          <img
            src={item.image || DEFAULT_POSTER}
            alt={title}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setImageLoaded(true)}
            className={`h-full w-full object-cover object-center transition-opacity duration-300 group-hover:scale-105 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          />

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-[0_4px_20px_rgba(0,0,0,0.6)] sm:h-12 sm:w-12">
              <Play className="ml-0.5 h-5 w-5 fill-current" />
            </span>
          </div>
        </span>

        {onRemove && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRemove();
            }}
            title="Remove from Continue Watching"
            aria-label="Remove from Continue Watching"
            className="kinoma-focus absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/70 text-gray-300 opacity-0 shadow-md transition-all hover:scale-110 hover:bg-black/90 hover:text-white group-hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {defaultBadge && (
          <div className="pointer-events-none absolute left-2 top-2 z-10">
            <span className="rounded-full border border-white/10 bg-black/65 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-md">
              {defaultBadge}
            </span>
          </div>
        )}
      </div>

      <span className="kinoma-focus mt-2 block rounded sm:mt-2.5">
        <h3 className="line-clamp-2 text-xs font-semibold leading-snug text-white transition-colors duration-200 group-hover:text-purple-300 sm:text-sm">
          {title}
        </h3>
        {subText && (
          <p className="mt-0.5 truncate text-[11px] font-medium text-gray-400">
            {subText}
          </p>
        )}
      </span>
    </div>
  );
}
