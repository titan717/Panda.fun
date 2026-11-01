import React, { useState } from 'react';
import { Link } from 'wouter';
import { AnimeItem, DEFAULT_POSTER } from '../../types';
import { Play } from 'lucide-react';
import { motion } from 'motion/react';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } }
};

function AnimeCard({ item }: { item: AnimeItem }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const itemTitle = typeof item.title === 'string' 
    ? item.title 
    : item.title?.english || item.title?.romaji || 'Unknown Title';

  return (
    <Link href={`/details/${item.id}`}>
      <motion.div 
        whileHover={{ y: -5 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="group cursor-pointer flex flex-col gap-2 h-full transform-gpu"
      >
        <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-[#16161c] border border-white/5 group-hover:border-[#9c27b0]/50 group-hover:shadow-[0_10px_28px_rgba(156,39,176,0.22)] transition-all duration-300">
          {/* Shimmer skeleton placeholder */}
          {!imageLoaded && (
            <div className="absolute inset-0 bg-[#16161c] animate-pulse" />
          )}

          <img 
            src={item.image || DEFAULT_POSTER} 
            alt={itemTitle}
            onLoad={() => setImageLoaded(true)}
            className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            loading="lazy"
          />
          
          {/* Badges */}
          <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
             <span className="px-1.5 py-0.5 bg-yellow-400 text-black rounded text-[10px] font-black shadow-sm tracking-wider">
               HD
             </span>
          </div>
          
          <div className="absolute bottom-2 left-2 flex items-center gap-1 z-10">
            <span className="px-1.5 py-0.5 bg-white/90 backdrop-blur-md text-black rounded text-[10px] font-bold shadow-sm">
              CC {item.totalEpisodes || '?'}
            </span>
          </div>

          {/* Smooth Play overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-[#b84d41]/90 backdrop-blur-md flex items-center justify-center shadow-[0_0_20px_rgba(123,31,162,0.8)] transform scale-75 group-hover:scale-100 transition-transform duration-300">
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            </div>
          </div>
        </div>
        
        <h3 className="text-sm font-semibold text-gray-200 line-clamp-2 group-hover:text-[#e8d0c0] transition-colors duration-200 leading-snug">
          {itemTitle}
        </h3>
      </motion.div>
    </Link>
  );
}

export function AnimeGrid({ title, items }: { title: string, items: AnimeItem[] }) {
  return (
    <div className="w-full">
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-black text-white tracking-tight">{title}</h2>
        </div>
      )}
      
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] 2xl:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 sm:gap-5"
      >
        {items.map((item, idx) => (
          <motion.div key={`${title}-${item.id}-${idx}`} variants={itemVariants}>
            <AnimeCard item={item} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
