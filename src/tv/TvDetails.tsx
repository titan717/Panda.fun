import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { libraryManager } from '../lib/library';
import { historyUtil } from '../lib/history';
import { buildWatchHref } from '../lib/mediaRoute';
import { useDpadFocus } from './useDpadFocus';
import { MediaPoster } from '../components/ui/MediaPoster';
import { Play, Heart, Plus, Check, Share2 } from 'lucide-react';
import type { AnimeDetails } from '../types';

export function TvDetails({ id }: { id: string }) {
  const [data, setData] = useState<AnimeDetails | null>(null);
  const [inList, setInList] = useState(() => libraryManager.isInWatchlist(id));
  const [isFav, setIsFav] = useState(() => libraryManager.isFavorite(id));
  const playRef = useDpadFocus('tv-details-play');
  const favRef = useDpadFocus('tv-details-fav');
  const listRef = useDpadFocus('tv-details-list');

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    api.getDetails(id, controller.signal)
      .then(d => active && setData(d))
      .catch(() => {});
    return () => { active = false; controller.abort(); };
  }, [id]);

  if (!data) return <div className="tv-details__loading" role="status">Loading…</div>;
  const title = typeof data.title === 'string' ? data.title : data.title.english || 'Untitled';
  const resume = historyUtil.getAnimeProgress(id);
  const type = data.contentType === 'movie' ? 'movie' : 'series';

  return (
    <div className="tv-details">
      <div className="tv-details__hero">
        <MediaPoster src={data.banner || data.cover || data.image} alt={title} layoutId={`poster-${id}`} size="tv" priority />
        <div className="tv-details__copy">
          <h1>{title}</h1>
          <p>{data.description?.replace(/<[^>]*>/g, '').slice(0, 300)}</p>
          <div className="tv-details__actions">
            <button
              ref={playRef as any}
              className="tv-details__play"
              onClick={() => window.location.assign(buildWatchHref(id, type, resume?.seasonNumber || 1, Number(resume?.episodeNumber || 1), resume?.playbackTimestamp || 0))}
            >
              <Play size={20} fill="currentColor" /> {resume && !resume.isCompleted ? 'Resume' : 'Play'}
            </button>
            <button
              ref={favRef as any}
              className={`tv-details__icon${isFav ? ' is-active' : ''}`}
              aria-pressed={isFav}
              aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
              onClick={() => setIsFav(libraryManager.toggleFavorite({ id, title, image: data.image }))}
            >
              {isFav ? <Check size={20} /> : <Heart size={20} />}
            </button>
            <button
              ref={listRef as any}
              className={`tv-details__icon${inList ? ' is-active' : ''}`}
              aria-pressed={inList}
              aria-label={inList ? 'Remove from My List' : 'Add to My List'}
              onClick={() => setInList(libraryManager.toggleWatchlist({ id, title, image: data.image }))}
            >
              {inList ? <Check size={20} /> : <Plus size={20} />}
            </button>
            <button className="tv-details__icon" aria-label="Share"><Share2 size={20} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
