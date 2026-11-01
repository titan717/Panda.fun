import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Zap, Flame } from 'lucide-react';

interface AnimeLoaderProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function AnimeLoader({ text = 'Summoning Anime...', size = 'md' }: AnimeLoaderProps) {
  const dimension = size === 'sm' ? 'w-12 h-12' : size === 'lg' ? 'w-24 h-24' : 'w-16 h-16';
  const iconSize = size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-10 h-10' : 'w-7 h-7';

  return (
    <div className="flex flex-col items-center justify-center p-8 gap-4">
      {/* Cartoonish Anime Energy Orb */}
      <div className={`relative ${dimension} flex items-center justify-center`}>
        {/* Outer Pulsing Aura Ring */}
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.4, 0.8, 0.4],
            rotate: [0, 180, 360]
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute inset-0 rounded-full bg-gradient-to-tr from-[var(--kinoma-accent)] via-fuchsia-500 to-pink-500 blur-md"
        />

        {/* Inner Spinning Rune / Ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute inset-1 rounded-full border-2 border-dashed border-[var(--kinoma-accent-soft)]/60"
        />

        {/* Core Glowing Orb */}
        <motion.div
          animate={{
            y: [-4, 4, -4],
            scale: [0.95, 1.05, 0.95]
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="relative w-3/4 h-3/4 rounded-full bg-gradient-to-br from-[var(--kinoma-accent-soft)] via-fuchsia-600 to-indigo-700 shadow-[0_0_25px_rgba(168,85,247,0.8)] flex items-center justify-center border-2 border-white/40"
        >
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className={`${iconSize} text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]`} />
          </motion.div>
        </motion.div>

        {/* Orbiting Sparkles */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 pointer-events-none"
        >
          <span className="absolute -top-1 left-1/2 text-xs text-pink-300 animate-pulse">✨</span>
          <span className="absolute -bottom-1 right-1/4 text-xs text-[var(--kinoma-accent-soft)] animate-pulse">⚡</span>
        </motion.div>
      </div>

      {/* Cartoonish Loading Text */}
      {text && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2"
        >
          <span className="text-xs sm:text-sm font-black tracking-wider bg-gradient-to-r from-[var(--kinoma-accent-soft)] via-fuchsia-300 to-pink-300 bg-clip-text text-transparent uppercase">
            {text}
          </span>
          <motion.span
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="text-[var(--kinoma-accent-soft)] font-bold"
          >
            ...
          </motion.span>
        </motion.div>
      )}
    </div>
  );
}
