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
  progress?: number;
  href?: string;
  onRemove?: () => void;
}

export function ModernCard({
  item,
  badgeText,
  subText,
  layout = 'standard',
  progress,
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
  const isWide = layout === 'wide';
  const safeProgress = typeof progress === 'number' && Number.isFinite(progress)
    ? Math.min(1, Math.max(0, progress))
    : null;

  return (
    <div className={`group relative flex w-full min-w-0 flex-col select-none rounded-2xl ${isWide ? 'modern-card--wide' : ''}`}>
      <Link
        href={detailHref}
        className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#e8d0c0] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        aria-label={`Open ${title}`}
      >
        <div className={`modern-card__poster relative w-full overflow-hidden rounded-2xl border border-white/5 bg-[#0e1017] transition-[transform,border-color,box-shadow] duration-300 group-hover:border-white/20 group-hover:shadow-[0_12px_32px_rgba(0,0,0,0.6)] ${isWide ? 'aspect-video' : 'aspect-[2/3]'}`}>
          <span className="kinoma-focus absolute inset-0 z-0 block rounded-2xl">
            {!imageLoaded && (
              <div className="modern-card__skeleton absolute inset-0" aria-hidden="true" />
            )}
            <img
              src={cardImage}
              alt=""
              srcSet={cardImage.includes("/w342/") ? (cardImage + " 342w, " + (optimizeImageUrl(cardImage, 'w500') || cardImage) + " 500w") : undefined}
              sizes={isWide ? "(max-width: 540px) 72vw, 360px" : "(max-width: 540px) 44vw, (max-width: 900px) 30vw, (max-width: 1200px) 20vw, 18vw"}
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
              <span className="rounded-full border border-white/10 bg-black/75 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-md">
                {defaultBadge}
              </span>
            </div>
          )}
          {safeProgress !== null && (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[3px] bg-white/25"
              role="progressbar"
              aria-label={`${title} progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(safeProgress * 100)}
            >
              <span className="block h-full bg-[#b84d41]" style={{ width: `${safeProgress * 100}%` }} />
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
          className="kinoma-focus absolute right-2 top-2 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/85 text-gray-100 opacity-100 shadow-md transition-colors hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8d0c0] focus-visible:outline-offset-2 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
