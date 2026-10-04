import React, { useEffect, useState } from 'react';
import { historyUtil, HistoryItem, formatPlaybackTimestamp } from '../../../lib/history';
import { ModernCarousel, ModernCarouselSlot } from './ModernCarousel';
import { ModernCard } from './ModernCard';

export function ModernContinueWatching() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const loadHistory = () => setHistory(historyUtil.getHistory());

  useEffect(() => {
    loadHistory();
    const handleUpdate = () => loadHistory();
    window.addEventListener('kinoma_progress_update', handleUpdate);
    return () => window.removeEventListener('kinoma_progress_update', handleUpdate);
  }, []);

  if (history.length === 0) return null;

  const handleRemove = (item: HistoryItem) => {
    historyUtil.removeFromHistory(item.animeId || item.slug);
    loadHistory();
  };

  return (
    <ModernCarousel title="Continue Watching" subtitle="Resume right where you left off">
      {history.map((item) => {
        const curTime = item.playbackTimestamp ?? item.progress ?? 0;
        const mediaId = item.animeId || item.slug;
        const isMovie = item.episodeNumber === '1' && item.seasonNumber === 1 && item.episodeId === mediaId;
        const watchPath = isMovie ? mediaId : `${mediaId}$season${Math.max(1, item.seasonNumber || 1)}$episode${Math.max(1, Number(item.episodeNumber) || 1)}`;
        const watchUrl = `/watch/${encodeURIComponent(watchPath)}?type=${isMovie ? 'movie' : 'series'}&t=${Math.floor(curTime)}`;
        const title = item.title || 'Untitled';
        const subtitle = isMovie ? `Resume · ${formatPlaybackTimestamp(curTime)}` : `S${item.seasonNumber || 1} E${item.episodeNumber || 1} · Resume`;

        return (
          <ModernCarouselSlot key={'cw-' + (item.animeId || item.slug) + '-' + item.episodeNumber}>
            <ModernCard
              item={{ id: mediaId, title, image: item.image, type: isMovie ? 'movie' : 'series' }}
              href={watchUrl}
              subText={subtitle}
              onRemove={() => handleRemove(item)}
            />
          </ModernCarouselSlot>
        );
      })}
    </ModernCarousel>
  );
}
