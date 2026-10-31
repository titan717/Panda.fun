import React, { useState } from 'react';
import { Link } from 'wouter';
import { Play, X } from 'lucide-react';
import { AnimeItem, DEFAULT_POSTER } from '../../../types';
import { buildDetailsHref } from '../../../lib/mediaRoute';
import { optimizeImageUrl } from '../../../lib/mediaImages';

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

  const detailHref = href || buildDetailsHref(title, item.type === 'movie' ? 'movie' : 'series', item.id);
  const cardImage = optimizeImageUrl(item.image, 'w342') || item.image || DEFAULT_POSTER;
  const defaultBadge = badgeText || (item.status === 'RELEASING' ? 'New Season' : undefined);

  return (
    <div className="group relative flex w-full min-w-0 flex-col select-none rounded-2xl">
      <Link
        href={detailHref}
        className="block rounded-2xl outline-none"
        aria-label={`Open ${title}`}
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-white/5 bg-[#0e1017] transition-[transform,border-color,box-shadow] duration-300 group-hover:-translate-y-1 group-hover:border-white/20 group-hover:shadow-[0_12px_32px_rgba(0,0,0,0.6)]">
          <span className="kinoma-focus absolute inset-0 z-0 block rounded-2xl">
            {!imageLoaded && (
              <div className="absolute inset-0 animate-pulse bg-[#12141c]" aria-hidden="true" />
            )}
            <img
              src={cardImage}
              alt=""
              srcSet={cardImage.includes("/w342/") ? (cardImage + " 342w, " + (optimizeImageUrl(cardImage, 'w500') || cardImage) + " 500w") : undefined}
              sizes="(max-width: 540px) 44vw, (max-width: 900px) 30vw, (max-width: 1200px) 20vw, 18vw"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onLoad={() => setImageLoaded(true)}
              className={`h-full w-full object-cover object-center transition-opacity duration-300 group-hover:scale-105 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-[0_4px_20px_rgba(0,0,0,0.6)] sm:h-12 sm:w-12">
                <Play className="ml-0.5 h-5 w-5 fill-current" />
              </span>
            </div>
          </span>
          {defaultBadge && (
            <div className="pointer-events-none absolute left-2 top-2 z-10">
              <span className="rounded-full border border-white/10 bg-black/65 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-md">
                {defaultBadge}
              </span>
            </div>
          )}
        </div>
        <span className="kinoma-focus mt-2 block rounded sm:mt-2.5">
          <h3 className="line-clamp-2 text-xs font-semibold leading-snug text-white transition-colors duration-200 group-hover:text-white sm:text-sm">
            {title}
          </h3>
          {subText && (
            <p className="mt-0.5 truncate text-[11px] font-medium text-gray-400">
              {subText}
            </p>
          )}
        </span>
      </Link>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          title={`Remove ${title} from Library`}
          aria-label={`Remove ${title} from Library`}
          className="kinoma-focus absolute right-2 top-2 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/80 text-gray-100 opacity-0 shadow-md transition-all hover:scale-105 hover:bg-black focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>;
}
