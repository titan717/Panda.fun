import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Play, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { historyUtil, HistoryItem, formatPlaybackTimestamp } from '../../lib/history';
import { DEFAULT_POSTER } from '../../types';

function watchUrl(item: HistoryItem) {
  const mediaId = item.animeId || item.slug;
  if (mediaId.startsWith('tmdb_movie_')) {
    return '/watch/' + encodeURIComponent(mediaId) + '?type=movie' +
      (item.playbackTimestamp > 0 ? '&t=' + Math.floor(item.playbackTimestamp) : '');
  }
  const season = Math.max(1, Number(item.seasonNumber) || 1);
  const episode = Math.max(1, Number(item.episodeNumber) || 1);
  return '/watch/' + encodeURIComponent(mediaId + '$season$' + season + '$episode$' + episode) +
    '?type=series' + (item.playbackTimestamp > 0 ? '&t=' + Math.floor(item.playbackTimestamp) : '');
}

export function ContinueWatching() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const load = () => setHistory(historyUtil.getHistory());
    load();
    window.addEventListener('kinoma_progress_update', load);
    return () => window.removeEventListener('kinoma_progress_update', load);
  }, []);

  const handleRemove = (event: React.MouseEvent, slug: string) => {
    event.preventDefault();
    event.stopPropagation();
    historyUtil.removeHistory(slug);
    setHistory(historyUtil.getHistory());
  };

  if (!history.length) return null;

  return (
    <section className="w-full" aria-label="Continue Watching">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-black text-white tracking-tight">Continue Watching</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
        <AnimatePresence mode="popLayout">
          {history.map(item => {
            const current = Math.max(0, item.playbackTimestamp ?? item.progress ?? 0);
            const duration = item.duration > 0 ? item.duration : 1440;
            const percent = Math.min(100, Math.max(0, (current / duration) * 100));
            const season = Math.max(1, Number(item.seasonNumber) || 1);
            const time = formatPlaybackTimestamp(current);
            return (
              <motion.div key={item.slug || item.animeId} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                <Link href={watchUrl(item)} className="block relative overflow-hidden rounded-xl border border-white/10 bg-black/30 group">
                  <div className="relative aspect-video overflow-hidden bg-black">
                    <img src={item.image || DEFAULT_POSTER} alt={item.title} className="w-full h-full object-cover opacity-75 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300" loading="lazy" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="w-11 h-11 rounded-full bg-white/90 text-black flex items-center justify-center"><Play className="w-5 h-5 fill-current" /></span>
                    </div>
                    <button type="button" onClick={e => handleRemove(e, item.slug)} className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Remove from continue watching">
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-[10px] font-bold text-white">
                      S{season} E{item.episodeNumber} · {time}
                    </div>
                  </div>
                  <div className="h-1 bg-white/10"><div className="h-full bg-white/80" style={{ width: percent + '%' }} /></div>
                  <div className="p-3">
                    <h3 className="text-sm font-semibold text-white line-clamp-1">{item.title}</h3>
                    <div className="mt-1 flex items-center justify-between text-xs text-white/55">
                      <span>{time} / {formatPlaybackTimestamp(duration)}</span>
                      <span>{Math.round(percent)}%</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}
