import React from 'react';
import { Link } from 'wouter';
import { motion } from 'motion/react';
import { AnimeItem, DEFAULT_POSTER } from '../../types';

interface SidebarCardProps {
  item: AnimeItem;
  rank: number;
}

export function SidebarCard({ item, rank }: SidebarCardProps) {
  const title = typeof item.title === 'string' 
    ? item.title 
    : item.title?.english || item.title?.romaji || 'Unknown Title';

  return (
    <Link href={`/details/${item.id}`}>
      <motion.div 
        whileHover={{ x: 4 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="group flex items-center gap-3.5 py-3 border-b border-[#1c1c22] cursor-pointer hover:bg-[#16161d] px-2.5 -mx-2 rounded-xl transition-colors duration-200"
      >
        <div className={`w-7 text-center text-xl font-black ${
          rank === 1 ? 'text-[#e8d0c0] drop-shadow-[0_0_8px_rgba(192,132,252,0.6)]' :
          rank === 2 ? 'text-[#b84d41]' :
          rank === 3 ? 'text-[#b84d41]' :
          'text-gray-600'
        }`}>
          {rank}
        </div>
        
        <div className="w-12 h-16 shrink-0 rounded-lg overflow-hidden relative bg-[#181820] border border-white/5 group-hover:border-[#9c27b0]/40 transition-colors">
          <img 
            src={item.image || DEFAULT_POSTER} 
            alt={title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </div>
        
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <h4 className="text-sm font-semibold text-gray-200 line-clamp-2 group-hover:text-[#e8d0c0] transition-colors leading-snug">
            {title}
          </h4>
          
          <div className="flex items-center gap-2 text-[10px] font-medium text-gray-400">
            <span className="px-1.5 py-0.5 bg-gray-200 text-black rounded text-[10px] font-bold">
              CC {item.totalEpisodes || 12}
            </span>
            {item.totalEpisodes && (
              <span className="px-1.5 py-0.5 bg-yellow-400 text-black rounded text-[10px] font-bold">
                HD
              </span>
            )}
            <span className="w-1 h-1 rounded-full bg-gray-600"></span>
            <span className="text-gray-400 font-semibold">{item.type || 'TV'}</span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
