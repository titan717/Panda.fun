import React from 'react';
import { Play, Star } from 'lucide-react';
import { AnimeImage } from './AnimeImage';

export interface CardProps {
  id?: string;
  title: string;
  image?: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: 'default' | 'accent' | 'success';
  rating?: number | string;
  progress?: number; // 0 - 100 percentage
  aspectRatio?: 'poster' | 'landscape';
  isFocused?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Card({
  title,
  image,
  subtitle,
  badge,
  badgeVariant = 'default',
  rating,
  progress,
  aspectRatio = 'poster',
  isFocused = false,
  onClick,
  className = '',
}: CardProps) {
  const badgeColors = {
    default: 'bg-black/70 text-gray-200 border-white/15',
    accent: 'bg-purple-950/80 text-[var(--kinoma-accent-soft)] border-[var(--kinoma-accent)]/30',
    success: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30',
  };

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`
        group relative flex flex-col w-full select-none cursor-pointer outline-none
        transition-all duration-200 ease-out
        kinoma-focus
        ${isFocused ? 'is-focused' : ''}
        ${className}
      `}
    >
      {/* Artwork Container */}
      <div className="relative w-full rounded-2xl overflow-hidden bg-[#12141c] border border-white/5 group-hover:border-white/20 transition-all duration-300 shadow-sm group-hover:shadow-[0_12px_28px_rgba(0,0,0,0.65)]">
        <AnimeImage
          src={image}
          alt={title}
          aspectRatio={aspectRatio}
          imageClassName="group-hover:scale-105 transition-transform duration-500"
        />

        {/* Top-Right Badge */}
        {badge && (
          <div className="absolute top-2.5 right-2.5 z-10">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide backdrop-blur-md border shadow-sm ${badgeColors[badgeVariant]}`}
            >
              {badge}
            </span>
          </div>
        )}

        {/* Rating Badge (top-left if available) */}
        {rating !== undefined && rating !== null && (
          <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold text-amber-400">
            <Star className="w-3 h-3 fill-amber-400" />
            <span>{typeof rating === 'number' ? rating.toFixed(1) : rating}</span>
          </div>
        )}

        {/* Continue Watching Progress Bar */}
        {typeof progress === 'number' && progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/60 z-10">
            <div
              className="h-full bg-gradient-to-r from-[var(--kinoma-accent)] to-fuchsia-500"
              style={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
            />
          </div>
        )}

        {/* Subtle Play Overlay on Hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-200">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
        </div>
      </div>

      {/* Typography & Metadata Below Card */}
      <div className="mt-2.5 px-0.5 flex flex-col">
        <h3 className="text-xs sm:text-sm font-semibold text-white group-hover:text-[var(--kinoma-accent-soft)] transition-colors duration-150 line-clamp-1 leading-snug">
          {title}
        </h3>
        {subtitle && (
          <p className="text-[11px] sm:text-xs text-gray-400 truncate mt-0.5 font-medium">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
