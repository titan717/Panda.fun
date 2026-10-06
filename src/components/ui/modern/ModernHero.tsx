import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'wouter';
import { Play, Info, Star, Plus, Check, Calendar, Film } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AnimeItem, DEFAULT_BANNER } from '../../../types';
import { libraryManager } from '../../../lib/library';
import { historyUtil, HistoryItem } from '../../../lib/history';
import { buildDetailsHref, buildWatchHref } from '../../../lib/mediaRoute';

interface ModernHeroProps {
  items: AnimeItem[];
}

export function ModernHero({ items }: ModernHeroProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [inWatchlist, setInWatchlist] = useState(false);

  // Load history to detect if user has active progress in the current hero item
  useEffect(() => {
    const loadHistory = () => setHistory(historyUtil.getHistory());
    loadHistory();
    window.addEventListener('kinoma_progress_update', loadHistory);
    return () => window.removeEventListener('kinoma_progress_update', loadHistory);
  }, []);

  const visibleItems = items.slice(0, 5);

  // Auto-rotate hero every 4.2 seconds if not hovered/paused.
  // Keep the derived list above the effect so the dependency is always initialized.
  useEffect(() => {
    if (visibleItems.length <= 1 || isPaused) return;
    const interval = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % visibleItems.length);
    }, 4200);
    return () => window.clearInterval(interval);
  }, [visibleItems.length, isPaused]);
  const currentItem = visibleItems[currentIndex] || visibleItems[0];

  // Watchlist status tracking for currentItem
  useEffect(() => {
    if (currentItem?.id) {
      setInWatchlist(libraryManager.isInWatchlist(currentItem.id));
    }
  }, [currentItem?.id]);

  const handleToggleWatchlist = () => {
    if (!currentItem) return;
    const title = typeof currentItem.title === 'string'
      ? currentItem.title
      : currentItem.title?.english || currentItem.title?.romaji || 'Anime';
    const newState = libraryManager.toggleWatchlist({
      id: currentItem.id,
      title,
      image: currentItem.image || currentItem.cover
    });
    setInWatchlist(newState);
  };

  if (!items || items.length === 0) {
    return (
      <div className="w-full h-[54vh] sm:h-[68vh] md:h-[76vh] lg:h-[82vh] min-h-[460px] max-h-[860px] bg-[#0c0d12] animate-pulse" />
    );
  }

  const title = typeof currentItem.title === 'string'
    ? currentItem.title
    : currentItem.title?.english || currentItem.title?.romaji || 'Featured Anime';

  const cleanDescription = (currentItem.description || '')
    .replace(/<[^>]*>?/gm, '')
    .trim() || 'An unforgettable anime journey featuring extraordinary worlds, heartfelt bonds, and legendary encounters.';

  // Check if user has active history for this anime
  const activeHistory = history.find(h => h.animeId === currentItem.id || h.slug === currentItem.id);
  const hasHistory = Boolean(activeHistory && (activeHistory.playbackTimestamp ?? activeHistory.progress ?? 0) > 0);

  const heroType = currentItem.contentType === 'movie' || currentItem.type === 'movie' ? 'movie' : 'series';
  const heroSeason = Math.max(1, Number(activeHistory?.seasonNumber) || 1);
  const heroEpisode = Math.max(1, Number(activeHistory?.episodeNumber) || 1);
  const watchUrl = buildWatchHref(
    currentItem.id,
    heroType,
    heroSeason,
    heroEpisode,
    hasHistory && activeHistory
      ? activeHistory.playbackTimestamp ?? activeHistory.progress ?? 0
      : 0
  );
  const primaryLabel = hasHistory && activeHistory
    ? 'Continue Watching' + (heroType === 'series' ? ' (S' + heroSeason + ' E' + heroEpisode + ')' : '')
    : 'Watch Now';

  // Format rating percentage (0-100 or 0-10)
  const numRating = currentItem.rating ? Number(currentItem.rating) : NaN;
  const ratingDisplay = !isNaN(numRating) && numRating > 0
    ? (numRating > 10 ? `${(numRating / 10).toFixed(1)}` : `${numRating.toFixed(1)}`)
    : null;

  return (
    <div 
      className="relative w-full h-[52vh] sm:h-[66vh] md:h-[76vh] lg:h-[84vh] min-h-[460px] max-h-[880px] overflow-hidden bg-[#08090d] flex items-end select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      
      {/* Background Cinematic Backdrop Artwork with Breakpoint-Optimized Focal Cropping */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={currentItem.id || currentIndex}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 z-0"
        >
          <img
            src={currentItem.banner || currentItem.cover || currentItem.image || DEFAULT_BANNER}
            alt={title}
            className="w-full h-full object-cover object-center opacity-75 brightness-[0.72] saturate-[0.72] scale-[1.04]"
            loading="eager"
            referrerPolicy="no-referrer"
          />
        </motion.div>
      </AnimatePresence>

      {/* Responsive Cinematic Gradient Masks */}
      {/* 1. Mobile vertical scrim: Dark gradient on bottom half protecting text */}
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#0e1017] via-[#0e1017]/85 md:via-[#0e1017]/40 to-transparent" />
      
      {/* 2. Desktop horizontal scrim: Left-to-right fade for wide desktop text clarity */}
      <div className="hidden md:block absolute inset-0 z-0 bg-gradient-to-r from-[#0e1017] via-[#0e1017]/75 to-transparent w-[68%]" />
      
      {/* 3. Top subtle scrim: Protects navigation */}
      <div className="absolute inset-x-0 top-0 z-0 h-36 bg-gradient-to-b from-[#08090d]/90 to-transparent" />

      {/* Soft cinematic veil keeps artwork rich without the old neon-heavy look. */}
      <div className="absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_72%_38%,transparent_0%,rgba(8,9,13,.12)_42%,rgba(8,9,13,.72)_100%)]" />

      {/* Hero Content Area */}
      <div className="relative z-10 w-full max-w-[1680px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 pb-8 sm:pb-12 lg:pb-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={`modern-hero-content-${currentItem.id || currentIndex}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-2xl flex flex-col gap-2.5 sm:gap-3.5"
          >
            <div className="hidden lg:block absolute right-8 xl:right-12 bottom-10 w-[150px] xl:w-[180px] aspect-[2/3] rounded-[22px] overflow-hidden border border-white/15 shadow-[0_24px_70px_rgba(0,0,0,.55)] rotate-[2deg]">
              <img
                src={currentItem.image || currentItem.cover || DEFAULT_BANNER}
                alt=""
                className="h-full w-full object-cover"
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
            </div>

            {/* Title */}
            <h1 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.12] tracking-tight drop-shadow-xl font-['Outfit']">
              {title}
            </h1>

            {/* Synopsis Description */}
            <p className="text-xs sm:text-sm md:text-base text-gray-200 line-clamp-2 sm:line-clamp-3 leading-relaxed drop-shadow max-w-xl font-normal opacity-90">
              {cleanDescription}
            </p>

            {/* Action Buttons: Primary Watch/Resume, My List, More Info */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-2">
              
              {/* Primary CTA (Continue Watching or Watch Now) */}
              <Link href={watchUrl}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-5 sm:px-7 py-2.5 sm:py-3 rounded-full text-xs sm:text-sm font-semibold shadow-sm transition-all cursor-pointer kinoma-focus"
                >
                  <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                  <span>{primaryLabel}</span>
                </motion.button>
              </Link>

              {/* Secondary CTA (Add to My List / In My List) */}
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleToggleWatchlist}
                className={`flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2.5 sm:py-3 rounded-full text-xs sm:text-sm font-semibold backdrop-blur-md border transition-all cursor-pointer kinoma-focus ${
                  inWatchlist
                    ? 'bg-purple-600/30 border-purple-500/60 text-purple-200 hover:bg-purple-600/40'
                    : 'bg-white/10 hover:bg-white/15 border-white/20 text-white'
                }`}
                title={inWatchlist ? 'Remove from My List' : 'Add to My List'}
              >
                {inWatchlist ? (
                  <>
                    <Check className="w-4 h-4 text-purple-300" />
                    <span>In My List</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>My List</span>
                  </>
                )}
              </motion.button>

              {/* Tertiary CTA: More Info */}
              <Link href={buildDetailsHref(title, currentItem.type === 'movie' ? 'movie' : 'series', currentItem.id)}>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/15 border border-white/20 text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-full text-xs sm:text-sm font-semibold backdrop-blur-md transition-all cursor-pointer kinoma-focus"
                >
                  <Info className="w-4 h-4 text-gray-300" />
                  <span>More Info</span>
                </motion.button>
              </Link>

            </div>

          </motion.div>
        </AnimatePresence>

        {/* Hero Carousel Navigation Dots */}
        {items.length > 1 && (
          <div className="flex items-center gap-1.5 mt-5">
            {visibleItems.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1 rounded-full transition-all duration-300 cursor-pointer kinoma-focus ${
                  currentIndex === idx ? 'w-7 bg-white/80' : 'w-2 bg-white/25 hover:bg-white/50'
                }`}
                aria-label={`Slide ${idx + 1}`}
              />
            ))}
          </div>
        )}

      </div>

    </div>
  );
}
