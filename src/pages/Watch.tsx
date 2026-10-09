import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Footer } from '../components/ui/Footer';
import { useLocation, useRoute, useSearch } from 'wouter';
import { ArrowLeft, ChevronLeft, ChevronRight, Film, Play, Plus, Check, Share2, Tv, Maximize, Minimize, RotateCcw, LifeBuoy } from 'lucide-react';
import { api } from '../lib/api';
import { historyUtil } from '../lib/history';
import { libraryManager } from '../lib/library';
import type { AnimeItem, Episode, AnimeSeasonItem } from '../types';
import { DEFAULT_POSTER } from '../types';
import { updateSEO } from '../lib/seo';
import { trackEvent, trackGAEvent } from '../lib/analytics';
import { buildDetailsHref, buildWatchHref } from '../lib/mediaRoute';
import { parseVidyPlaybackMessage } from '../lib/vidyPlayerEvents';

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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerPageRef = useRef<HTMLElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const retryPlayback = () => {
    setError('');
    setSource('');
    setSourceLoading(true);
    setPlaybackRetry((current) => current + 1);
  };
  const toggleFullscreen = async () => {
    setFullscreenError('');
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      const page = playerPageRef.current;
      if (!page?.requestFullscreen) {
        setFullscreenError('This browser does not support full-screen mode. Use the player’s own full-screen control, or try a current version of Chrome, Edge, Firefox, or Safari.');
        return;
      }
      await page.requestFullscreen();
    } catch {
      setFullscreenError('The browser blocked full-screen mode. Use the full-screen control inside the video, or allow full-screen access for this site and try again.');
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement && (
      document.fullscreenElement === playerPageRef.current ||
      document.fullscreenElement.contains(playerPageRef.current)
    )));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);
  const lastAnalyticsPositionRef = useRef(playbackProgress);
  const playbackRef = useRef({
    currentTime: playbackProgress,
    duration: 0,
    dirty: playbackProgress > 0,
  });

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
      .then(result => {
        if (!active) return;
        setSource(result.url);
        setSourceLoading(true);
        trackGAEvent('watch_start', { content_type: type, item_id: id, title, season: type === 'series' ? season : 1, episode: type === 'series' ? episode : 1 });
        void trackEvent({
          type: 'watch_start',
          animeId: id,
          animeTitle: title,
          episodeId: currentEpisode?.id,
          episodeNumber: type === 'series' ? String(episode) : '1',
          metadata: { contentType: type, season: type === 'series' ? season : 1, source: 'watch' },
        });
      })
      .catch(err => { if (!active) return; setSourceLoading(false); setError(err instanceof Error ? err.message : 'Playback source unavailable.'); });
    return () => { active = false; controller.abort(); };
  }, [data, id, type, season, episode, playbackRetry]);

  const saveCurrentPlayback = useCallback((complete = false) => {
    if (!data) return;

    const current = playbackRef.current;
    const episodeDuration = Math.max(0, Number(currentEpisode?.duration) || 0);
    const duration = complete
      ? Math.max(current.duration, episodeDuration, current.currentTime)
      : Math.max(current.duration, episodeDuration, 1440);

    const playbackTimestamp = complete
      ? duration
      : Math.min(Math.max(0, current.currentTime), duration);

    if (playbackTimestamp <= 0) return;

    const previousAnalyticsPosition = lastAnalyticsPositionRef.current;
    const watchedDelta = playbackTimestamp - previousAnalyticsPosition;
    if (watchedDelta > 0 && watchedDelta <= 120) {
      void trackEvent({
        type: 'watch_progress',
        animeId: id,
        animeTitle: title,
        episodeId: currentEpisode?.id,
        episodeNumber: String(episode),
        durationSeconds: watchedDelta,
        metadata: { positionSeconds: playbackTimestamp, mediaDurationSeconds: duration, season: type === 'series' ? season : 1 },
      });
      trackGAEvent('watch_progress', { content_type: type, item_id: id, seconds: Math.round(watchedDelta), position: Math.round(playbackTimestamp) });
    }
    lastAnalyticsPositionRef.current = playbackTimestamp;
    if (complete) {
      void trackEvent({
        type: 'watch_complete',
        animeId: id,
        animeTitle: title,
        episodeId: currentEpisode?.id,
        episodeNumber: String(episode),
        durationSeconds: duration,
        metadata: { season: type === 'series' ? season : 1, source: 'watch' },
      });
      trackGAEvent('watch_complete', { content_type: type, item_id: id, title, duration: Math.round(duration) });
    }

    historyUtil.saveProgress(
      id,
      currentEpisode?.id || String(episode),
      episode,
      playbackTimestamp,
      duration,
      { title, image: poster, animeId: id, seasonNumber: type === 'series' ? season : 1 }
    );
    playbackRef.current.dirty = false;
  }, [data, id, title, poster, type, season, episode, currentEpisode?.id, currentEpisode?.duration]);

  useEffect(() => {
    lastAnalyticsPositionRef.current = playbackProgress;
    playbackRef.current = {
      currentTime: playbackProgress,
      duration: 0,
      dirty: playbackProgress > 0,
    };
  }, [id, season, episode, source, playbackProgress]);

  useEffect(() => {
    if (!data || !source) return;

    const handleVidyMessage = (event: MessageEvent<unknown>) => {
      const payload = parseVidyPlaybackMessage(
        event,
        iframeRef.current?.contentWindow || null
      );
      if (!payload) return;

      playbackRef.current.currentTime = payload.currentTime;
      playbackRef.current.duration = payload.duration;
      playbackRef.current.dirty = true;

      if (payload.event === 'pause') {
        saveCurrentPlayback();
      } else if (payload.event === 'ended') {
        saveCurrentPlayback(true);
      }
    };

    window.addEventListener('message', handleVidyMessage);
    return () => window.removeEventListener('message', handleVidyMessage);
  }, [data, source, saveCurrentPlayback]);

  useEffect(() => {
    if (!data || !source) return;

    const timer = window.setInterval(() => {
      if (playbackRef.current.dirty) saveCurrentPlayback();
    }, 15000);

    const handlePageHide = () => saveCurrentPlayback();

    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [data, source, saveCurrentPlayback]);

  const navigateEpisode = (direction: number) => {
    const index = episodes.findIndex(item => item.number === episode);
    const next = episodes[index + direction];
    if (next) {
      trackGAEvent('episode_navigate', { content_type: type, direction: direction > 0 ? 'next' : 'previous', episode: next.number, title });
      void trackEvent({ type: 'episode_select', animeId: id, animeTitle: title, episodeId: next.id, episodeNumber: String(next.number), metadata: { direction: direction > 0 ? 'next' : 'previous', source: 'watch' } });
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
    return <main className="panda-watch-page" ref={playerPageRef} aria-label="Video player"><div className="panda-watch-loading" role="status" aria-live="polite"><span /><span className="sr-only">Loading video and title details</span></div></main>;
  }

  return (
    <main className="panda-watch-page" ref={playerPageRef} aria-label="Video player" tabIndex={-1}>
      <section className="panda-watch-stage" aria-label={`Now playing ${title}`}>
        <div className="panda-watch-player">
          {source ? (
            <iframe
              ref={iframeRef}
              key={source}
              src={source}
              title={'Watch ' + title + ' on Panda.fun'}
              allow="encrypted-media; autoplay *; fullscreen *; picture-in-picture"
              allowFullScreen
              referrerPolicy="no-referrer"
              loading="eager"
              onLoad={() => setSourceLoading(false)}
            />
          ) : sourceLoading ? (
            <div className="panda-watch-player-loading" role="status" aria-live="polite">
              <span aria-hidden="true" /><span className="sr-only">Resolving playback source</span>
            </div>
          ) : (
            <div className="panda-watch-player-empty" role="alert">
              <strong>We couldn’t start this video.</strong>
              <span>{error || 'The playback provider did not return a playable source for this title.'}</span>
              <span>Try again in a moment. If the issue continues, reopen the title details, or send support the title name and the error above.</span>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <button type="button" className="panda-watch-chrome__button" onClick={retryPlayback}><RotateCcw size={15} /> Retry playback</button>
                <button type="button" className="panda-watch-chrome__button" onClick={() => setLocation(buildDetailsHref(title, type, id))}><ArrowLeft size={15} /> Title details</button>
                <a className="panda-watch-chrome__button" href="/contact?category=playback&subject=Playback%20failed"><LifeBuoy size={15} /> Contact support</a>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="panda-watch-chrome">
        <div className="panda-watch-chrome__group">
          <button type="button" className="panda-watch-chrome__button" onClick={() => setLocation(buildDetailsHref(title, type, id))} aria-label="Back to title details">
            <ArrowLeft size={16} aria-hidden="true" /><span>Back to details</span>
          </button>
          <span className="hidden sm:inline text-xs font-semibold text-white/65 max-w-[35vw] truncate" title={title}>{title}</span>
        </div>
        <div className="panda-watch-chrome__group">
          {shareMessage && <span role="status" className="hidden sm:inline text-xs text-white/75">{shareMessage}</span>}
          <button type="button" className="panda-watch-chrome__button" onClick={() => void toggleFullscreen()} aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'} title={fullscreenError || (isFullscreen ? 'Exit full screen' : 'Enter full screen')}>
            {isFullscreen ? <Minimize size={16} aria-hidden="true" /> : <Maximize size={16} aria-hidden="true" />}
            <span>{isFullscreen ? 'Exit full screen' : 'Full screen'}</span>
          </button>
        </div>
      </div>
      {fullscreenError && <div className="panda-watch-fullscreen-error" role="status">{fullscreenError}</div>}
    </main>
  );
}
