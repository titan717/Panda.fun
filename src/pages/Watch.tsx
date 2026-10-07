import React, { useEffect, useMemo, useState } from 'react';
import { Footer } from '../components/ui/Footer';
import { useLocation, useRoute, useSearch } from 'wouter';
import { ArrowLeft, ChevronLeft, ChevronRight, Film, Play, Plus, Check, Share2, Tv } from 'lucide-react';
import { api } from '../lib/api';
import { historyUtil } from '../lib/history';
import { libraryManager } from '../lib/library';
import type { AnimeItem, Episode, AnimeSeasonItem } from '../types';
import { DEFAULT_POSTER } from '../types';
import { updateSEO } from '../lib/seo';
import { trackGAEvent } from '../lib/analytics';
import { buildDetailsHref, buildWatchHref } from '../lib/mediaRoute';

function clean(value: unknown) {
  return typeof value === 'string' ? value.replace(/<[^>]*>/g, '').trim() : '';
}
function titleOf(data: any, fallback: string) {
  return typeof data?.title === 'string' ? data.title : data?.title?.english || data?.title?.romaji || data?.title?.native || fallback;
}
function mediaType(id: string, queryType: string | null, data: any): 'movie' | 'series' {
  return queryType === 'movie' || data?.contentType === 'movie' || data?.type === 'movie' ? 'movie' : 'series';
}

export function Watch() {
  const [, params] = useRoute<{ id: string }>('/watch/:id');
  const [, setLocation] = useLocation();
  const search = useSearch();
  const raw = params?.id ? decodeURIComponent(params.id) : '';
  const query = new URLSearchParams(search || '');
  const queryType = query.get('type');
  const playbackProgress = Math.max(0, Number(query.get('t') || 0));
  const parsed = raw.match(/^(.*)\$season\$(\d+)\$episode\$(\d+)$/);
  const id = parsed?.[1] || raw;
  const [data, setData] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<AnimeItem[]>([]);
  const [seasons, setSeasons] = useState<AnimeSeasonItem[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [season, setSeason] = useState(Number(parsed?.[2] || 1));
  const [episode, setEpisode] = useState(Number(parsed?.[3] || 1));
  const [source, setSource] = useState<string>('');
  const [sourceLoading, setSourceLoading] = useState(false);
  const [playbackRetry, setPlaybackRetry] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [inList, setInList] = useState(false);
  const [shareMessage, setShareMessage] = useState('');

  useEffect(() => {
    const nextSeason = Number(parsed?.[2] || 1);
    const nextEpisode = Number(parsed?.[3] || 1);
    setSeason(Number.isFinite(nextSeason) && nextSeason > 0 ? nextSeason : 1);
    setEpisode(Number.isFinite(nextEpisode) && nextEpisode > 0 ? nextEpisode : 1);
  }, [raw]);

  const type = mediaType(id, queryType, data);
  const title = titleOf(data, id || 'Untitled');
  const currentEpisode = episodes.find(item => item.number === episode);
  const poster = data?.image || DEFAULT_POSTER;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true); setError(''); setSource('');
    api.getDetails(id, controller.signal).then(details => {
      if (!active) return;
      setData(details);
      setInList(libraryManager.isInWatchlist(id));
      setLoading(false);

      api.getRecommendations(id, controller.signal)
        .then(recs => active && setRecommendations(recs.results))
        .catch(() => undefined);
    }).catch(err => {
      if (!active) return;
      setError(err instanceof Error ? err.message : 'Unable to load this title.');
      setLoading(false);
    });
    return () => { active = false; controller.abort(); };
  }, [id]);

  useEffect(() => {
    if (!data || type !== 'series') return;
    let active = true;
    const controller = new AbortController();
    api.getSeasons(id, controller.signal).then(result => {
      if (!active) return;
      setSeasons(result.seasons);
      if (result.seasons.length && !result.seasons.some(s => s.seasonNumber === season)) {
        setSeason(result.seasons[0].seasonNumber);
      }
    }).catch(() => active && setSeasons([]));
    return () => { active = false; controller.abort(); };
  }, [data, id, type]);

  useEffect(() => {
    if (!data || type !== 'series') return;
    let active = true;
    const controller = new AbortController();
    api.getSeasonEpisodes(id, season, controller.signal).then(result => {
      if (!active) return;
      setEpisodes(result.episodes);
      if (result.episodes.length && !result.episodes.some(ep => ep.number === episode)) setEpisode(result.episodes[0].number);
    }).catch(() => active && setEpisodes([]));
    return () => { active = false; controller.abort(); };
  }, [data, id, season, type]);

  useEffect(() => {
    if (!data) return;
    let active = true;
    const controller = new AbortController();
    setSourceLoading(true);
    setSource('');
    setError('');
    api.getWatchLink(id, type === 'series' ? season : 1, type === 'series' ? episode : 1, controller.signal, playbackProgress)
      .then(result => { if (!active) return; setSource(result.url); setSourceLoading(true); trackGAEvent('watch_start', { content_type: type, title }); })
      .catch(err => { if (!active) return; setSourceLoading(false); setError(err instanceof Error ? err.message : 'Playback source unavailable.'); });
    return () => { active = false; controller.abort(); };
  }, [data, id, type, season, episode, playbackRetry]);

  useEffect(() => {
    if (!data) return;
    const timer = window.setInterval(() => {
      try {
        historyUtil.saveProgress(
          id,
          currentEpisode?.id || String(episode),
          episode,
          0,
          currentEpisode?.duration || 1440,
          { title, image: poster, animeId: id, seasonNumber: type === 'series' ? season : 1 }
        );
      } catch {}
    }, 15000);
    return () => window.clearInterval(timer);
  }, [data, id, title, poster, type, season, episode]);

  const navigateEpisode = (direction: number) => {
    const index = episodes.findIndex(item => item.number === episode);
    const next = episodes[index + direction];
    if (next) {
      trackGAEvent('episode_navigate', { content_type: type, direction: direction > 0 ? 'next' : 'previous', episode: next.number, title });
      setEpisode(next.number);
      setLocation(buildWatchHref(id, 'series', season, next.number));
    }
  };

  const chooseSeason = (next: number) => {
    trackGAEvent('season_select', { content_type: type, season: next, title });
    setSeason(next);
  };

  const toggleList = () => {
    const next = libraryManager.toggleWatchlist({ id, title, image: poster });
    setInList(next);
    trackGAEvent(next ? 'add_to_list' : 'remove_from_list', { content_type: type });
  };

  const similar = useMemo(() => recommendations.slice(0, 5), [recommendations]);

  useEffect(() => {
    if (!data) return;
    const episodeLabel = type === 'series' && currentEpisode ? ` — Season ${season}, Episode ${episode}${currentEpisode.title ? `: ${clean(currentEpisode.title)}` : ''}` : '';
    const watchDescription = `${title}${episodeLabel} on Panda.fun. ${clean(data?.description) || 'Watch this title on Panda.fun.'}`.slice(0, 160);
    updateSEO({
      title: `Watch ${title}${episodeLabel}`,
      description: watchDescription,
      image: poster,
      type: type === 'movie' ? 'video.movie' : 'video.episode',
      keywords: [title, ...(data?.genres || []), type === 'movie' ? 'movie' : 'TV series', 'watch online', 'Panda.fun'],
      schema: {
        '@context': 'https://schema.org',
        '@type': type === 'movie' ? 'Movie' : 'TVEpisode',
        name: type === 'series' && currentEpisode?.title ? `${title} — ${currentEpisode.title}` : title,
        description: watchDescription,
        image: poster ? [poster] : undefined,
        url: window.location.href,
        episodeNumber: type === 'series' ? episode : undefined,
        partOfSeason: type === 'series' ? { '@type': 'TVSeason', seasonNumber: season, name: `Season ${season}` } : undefined,
        partOfSeries: type === 'series' ? { '@type': 'TVSeries', name: title } : undefined,
        datePublished: data?.releaseDate || undefined,
        isPartOf: { '@type': 'WebSite', name: 'Panda.fun', url: window.location.origin }
      }
    });
  }, [data, title, poster, type, season, episode, currentEpisode?.title]);

  const shareTitle = title || 'Panda.fun';
  const shareText = type === 'movie'
    ? `Watch ${shareTitle} on Panda.fun 🐼\n\n${window.location.href}`
    : `Watch ${shareTitle} on Panda.fun 🐼\nSeason ${season} • Episode ${episode}${currentEpisode?.title ? ` — ${currentEpisode.title}` : ''}\n\n${window.location.href}`;

  const shareCurrentPage = async () => {
    const url = window.location.href;
    const copyText = type === 'movie'
      ? `Watch ${shareTitle} on Panda.fun 🐼\n\n${url}`
      : `Watch ${shareTitle} on Panda.fun 🐼\nSeason ${season} • Episode ${episode}${currentEpisode?.title ? ` — ${currentEpisode.title}` : ''}\n\n${url}`;

    try {
      if (typeof navigator.share === 'function') {
        trackGAEvent('share', { content_type: type, method: 'native' });
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url,
        });
        return;
      }
      trackGAEvent('share', { content_type: type, method: 'clipboard' });
      await navigator.clipboard?.writeText(copyText);
      setShareMessage('Share text copied');
      window.setTimeout(() => setShareMessage(''), 1800);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      try {
        await navigator.clipboard?.writeText(copyText);
        setShareMessage('Share text copied');
        window.setTimeout(() => setShareMessage(''), 1800);
      } catch {}
    }
  };

  if (loading) {
    return <main className="panda-watch-page"><div className="panda-watch-loading"><span /></div></main>;
  }

  return (
    <main className="panda-watch-page">
      <section className="panda-watch-stage">
        <div className="panda-watch-player">
          {source ? (
            <iframe
              key={source}
              src={source}
              title={'Watch ' + title + ' on Panda.fun'}
              allow="encrypted-media; autoplay *; fullscreen *"
              allowFullScreen
              referrerPolicy="no-referrer"
              loading="eager"
              onLoad={() => setSourceLoading(false)}
            />
          ) : sourceLoading ? (
            <div className="panda-watch-player-loading" role="status" aria-live="polite">
              <span aria-hidden="true" />
            </div>
          ) : (
            <div className="panda-watch-player-empty">
              <strong>Playback unavailable</strong>
              <span>{error || 'The player could not be resolved for this title.'}</span>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
