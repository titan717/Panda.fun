import React from 'react';
import { api } from '../lib/api';
import { historyUtil } from '../lib/history';
import { libraryManager } from '../lib/library';
import { TvHeroCarousel } from './TvHeroCarousel';
import { TvContentRail } from './TvContentRail';
import type { AnimeItem } from '../types';

export function TvHome() {
  const [trending, setTrending] = React.useState<AnimeItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();
    api.getTrending().then(data => {
      if (active) setTrending(data.results);
    }).catch(err => {
      if (active) setError(err instanceof Error ? err.message : 'Unable to load recommendations');
    }).finally(() => active && setLoading(false));
    return () => { active = false; controller.abort(); };
  }, []);

  const continueWatching = historyUtil.getHistory().slice(0, 20).map(h => ({
    id: h.animeId,
    title: h.title,
    image: h.image,
    contentType: 'series' as const,
  }));
  const myList = libraryManager.getWatchlist().slice(0, 20).map(item => ({
    id: item.id,
    title: item.title,
    image: item.image,
    contentType: 'series' as const,
  }));

  if (loading) return <div className="tv-loading" role="status">Loading Panda.fun…</div>;
  if (error) return <div className="tv-error" role="alert"><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Retry</button></div>;

  return (
    <div className="tv-home">
      <TvHeroCarousel items={trending.slice(0, 5)} />
      {continueWatching.length > 0 && <TvContentRail title="Continue Watching" items={continueWatching} />}
      <TvContentRail title="Trending Now" items={trending} />
      {myList.length > 0 && <TvContentRail title="My List" items={myList} />}
    </div>
  );
}
