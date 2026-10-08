import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Play, Plus, Star, Film, Volume2, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AnimeItem, DEFAULT_BANNER } from '../../types';
import { buildDetailsHref } from '../../lib/mediaRoute';

interface HeroProps {
  item?: AnimeItem;
  items?: AnimeItem[];
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/<[^>]*>/g, '').trim() : '';
}

// Simple deterministic pseudo-random for particles
const generateParticles = (count: number) => {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    duration: Math.random() * 20 + 10,
    delay: Math.random() * 5
  }));
};

export function Hero({ item, items }: HeroProps) {
  const [shuffledItems, setShuffledItems] = useState<AnimeItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [particles] = useState(() => generateParticles(20));

  useEffect(() => {
    const list = items && items.length > 0 ? items : (item ? [item] : []);
    const shuffled = [...list].sort(() => Math.random() - 0.5);
    setShuffledItems(shuffled);
    setCurrentIndex(0);
  }, [items, item]);

  const heroList = shuffledItems;

  useEffect(() => {
    if (heroList.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % heroList.length);
    }, 8800);
    return () => clearInterval(interval);
  }, [heroList.length]);

  if (heroList.length === 0) return null;

  const currentItem = heroList[currentIndex] || heroList[0];
  const title = typeof currentItem.title === 'string' 
    ? currentItem.title 
    : currentItem.title?.english || currentItem.title?.romaji || 'Unknown Title';

  return (
    <div className="relative w-full h-[65vh] sm:h-[75vh] min-h-[500px] lg:h-[85vh] bg-[#0e0f11] overflow-hidden flex items-end group">
      
      {/* Background & Overlays */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={currentItem.id || currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="absolute inset-0 z-0"
        >
          {/* Parallax Image */}
          <motion.img 
            initial={{ scale: 1 }}
            animate={{ scale: 1.08 }}
            transition={{ duration: 15, ease: "linear" }}
            src={currentItem.cover || currentItem.image || DEFAULT_BANNER}
            alt={title}
            className="w-full h-full object-cover object-top opacity-80"
          />
        </motion.div>
      </AnimatePresence>

      {/* Cinematic Gradients */}
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-[#0e0f11] via-[#0e0f11]/70 to-transparent w-[95%] md:w-[75%]" />
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#0e0f11] via-transparent to-transparent opacity-90" />
      <div className="absolute inset-x-0 bottom-0 z-0 h-40 bg-gradient-to-t from-[#0e0f11] to-transparent" />

      {/* Subtle Animated Particles (Dust/Embers) - Hardware accelerated */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden mix-blend-screen opacity-30 gpu-layer">
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ y: `${p.y}vh`, x: `${p.x}vw`, opacity: 0 }}
            animate={{ 
              y: [`${p.y}vh`, `${p.y - 18}vh`], 
              x: [`${p.x}vw`, `${p.x + (p.id % 2 === 0 ? 8 : -8)}vw`],
              opacity: [0, 0.7, 0] 
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
              ease: "linear"
            }}
            className="absolute rounded-full bg-white will-change-transform"
            style={{ width: p.size, height: p.size, filter: 'blur(1px)' }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 w-full px-4 sm:px-6 md:px-8 lg:px-10 2xl:px-16 pb-12 sm:pb-20 lg:pb-28">
        <AnimatePresence mode="wait">
          <motion.div 
            key={`content-${currentItem.id || currentIndex}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-[700px] flex flex-col gap-4 sm:gap-5"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-white leading-[1.1] drop-shadow-2xl">
              {title}
            </h1>
            
            {/* Metadata Row */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs sm:text-sm font-semibold drop-shadow-md">
              {currentItem.rating && (
                <span className="flex items-center gap-1.5 text-yellow-400">
                  <Star className="w-4 h-4 fill-current" /> {(Number(currentItem.rating) / 10).toFixed(1) || '8.7'}
                </span>
              )}
              {currentItem.totalEpisodes && (
                <span className="flex items-center gap-1.5 text-gray-200">
                  <Film className="w-4 h-4 text-gray-400" /> {currentItem.totalEpisodes} Episodes
                </span>
              )}
              <span className="flex items-center gap-1.5 text-gray-200">
                <Globe className="w-4 h-4 text-gray-400" /> Japanese
              </span>
              <span className="flex items-center gap-1.5 text-gray-200">
                <Volume2 className="w-4 h-4 text-gray-400" /> English Dub
              </span>
            </div>
            
            <p
              className="text-sm sm:text-base text-gray-300 line-clamp-2 sm:line-clamp-3 leading-relaxed max-w-xl drop-shadow-lg"
            >
              {cleanText(currentItem.description) || 'No synopsis available for this title.'}
            </p>
            
            {/* Buttons */}
            <div className="mt-2 flex items-center gap-3 sm:gap-4">
              <Link href={buildDetailsHref(title, currentItem.type === 'movie' ? 'movie' : 'series', currentItem.id)}>
                <motion.button 
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-black px-6 sm:px-8 py-3 rounded-xl text-sm sm:text-base font-black transition-all shadow-[0_4px_20px_rgba(255,255,255,0.25)]"
                >
                  <Play className="w-5 h-5 fill-current" />
                  Watch Now
                </motion.button>
              </Link>
              <motion.button 
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/20 px-6 sm:px-8 py-3 rounded-xl text-sm sm:text-base font-bold transition-all shadow-xl"
              >
                <Plus className="w-5 h-5" strokeWidth={3} />
                Add to List
              </motion.button>
            </div>
          </motion.div>
        </AnimatePresence>
        
        {/* Modern Pill Slide Indicators */}
        {heroList.length > 1 && (
          <div className="absolute bottom-6 right-6 sm:right-10 flex items-center gap-2 z-20">
            {heroList.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === currentIndex 
                    ? 'w-7 bg-gradient-to-r from-[#9c27b0] to-[#ba68c8] shadow-[0_0_12px_rgba(156,39,176,0.8)]' 
                    : 'w-2 bg-white/30 hover:bg-white/60'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
