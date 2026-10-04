import React, { useState } from 'react';
import { Link } from 'wouter';
import { Play, X } from 'lucide-react';
import { motion } from 'motion/react';
import { AnimeItem, DEFAULT_POSTER } from '../../../types';
import { slugifyTitle } from '../../../lib/slug';

export interface ModernCardProps {
  key?: React.Key;
  item: AnimeItem;
  badgeText?: string;
  subText?: string;
  progress?: number; // 0-100 percentage for Continue Watching
  currentEpisode?: number;
  layout?: 'standard' | 'wide';
  href?: string;
  onRemove?: () => void;
}

export function ModernCard({ 
  item, 
  badgeText, 
  subText, 
  progress,
  currentEpisode,
  href,
  onRemove
}: ModernCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  const title = typeof item.title === 'string'
    ? item.title
    : item.title?.english || item.title?.romaji || 'Unknown Anime';

  const defaultBadge = badgeText || (item.status === 'RELEASING' ? 'New Season' : undefined);

  return (
    <Link 
      href={href || `/details/${slugifyTitle(typeof item.title === 'string' ? item.title : (item.title?.english || item.title?.romaji || 'Untitled'))}?type=${item.type === 'movie' ? 'movie' : 'series'}`}
      className="group cursor-pointer flex flex-col w-full select-none outline-none kinoma-focus rounded-2xl"
    >
      <motion.div
        whileHover={{ y: -5 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex flex-col w-full"
      >
        {/* Poster Container with Rounded 2xl */}
        <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-[#0e1017] border border-white/5 group-hover:border-purple-500/40 group-hover:shadow-[0_12px_32px_rgba(0,0,0,0.6)] transition-all duration-300">
          
          {/* Skeleton placeholder */}
          {!imageLoaded && (
            <div className="absolute inset-0 bg-[#12141c] animate-pulse" />
          )}

          <img
            src={item.image || DEFAULT_POSTER}
            alt={title}
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={() => setImageLoaded(true)}
            className={`w-full h-full object-cover object-center transition-all duration-500 group-hover:scale-105 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Progress Bar for in-progress items */}
          {typeof progress === 'number' && progress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/60 z-10 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-600 to-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" 
                style={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
              />
            </div>
          )}

          {onRemove && (
            <button
              type="button"
              onClick={(event) => { event.preventDefault(); event.stopPropagation(); onRemove(); }}
              title="Remove from Continue Watching"
              aria-label="Remove from Continue Watching"
              className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-black/70 hover:bg-black/90 border border-white/15 text-gray-300 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 hover:scale-110 shadow-md cursor-pointer kinoma-focus"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {defaultBadge && (
            <div className="absolute top-2 left-2 z-10">
              <span className="px-2.5 py-0.5 bg-black/65 backdrop-blur-md text-white border border-white/10 rounded-full text-[10px] font-bold">
                {defaultBadge}
              </span>
            </div>
          )}

          {/* Smooth Play Overlay on Hover */
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white text-black flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.6)] transform scale-80 group-hover:scale-100 transition-transform duration-300">
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </div>
          </div>
        </div>

        {/* Title Displayed BELOW the Card */}
        <div className="mt-2 sm:mt-2.5 px-0.5 flex flex-col">
          <h3 className="text-xs sm:text-sm font-semibold text-white group-hover:text-purple-300 transition-colors duration-200 line-clamp-2 leading-snug">
            {title}
          </h3>

          {subText && (
            <p className="text-[11px] text-gray-400 font-medium truncate mt-0.5">
              {subText}
            </p>
          )}
        </div>

      </motion.div>
    </Link>
  );
}
