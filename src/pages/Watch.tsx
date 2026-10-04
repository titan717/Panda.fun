import React, { useEffect, useMemo, useState } from 'react';
import { Footer } from '../components/ui/Footer';
import { useLocation, useRoute } from 'wouter';
import { ArrowLeft, ChevronLeft, ChevronRight, Film, Play, Plus, Check, Share2, Tv } from 'lucide-react';
import { api } from '../lib/api';
import { historyUtil } from '../lib/history';
import { libraryManager } from '../lib/library';
import type { AnimeItem, Episode, AnimeSeasonItem } from '../types';
import { DEFAULT_POSTER } from '../types';
import { updateSEO } from '../lib/seo';
import { trackGAEvent } from '../lib/analytics';
import { slugifyTitle } from '../lib/slug';

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
  const [location, setLocation] = useLocation();
  const raw = params?.id ? decodeURIComponent(params.id) : '';
  const query = new URLSearchParams(location.split('?')[1] || '');
  const queryType = query.get('type');
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
    api.getWatchLink(id, type === 'series' ? season : 1, type === 'series' ? episode : 1, controller.signal)
      .then(result => { if (!active) return; setSource(result.url); trackGAEvent('watch_start', { content_type: type, title }); })
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
      setEpisode(next.number);
      setLocation('/watch/' + encodeURIComponent(id + '$season$' + season + '$episode$' + next.number) + '?type=series');
    }
  };

  const chooseSeason = (next: number) => {
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
    return <main className="panda-watch-page"><div className="panda-watch-loading"><span /><p>Preparing your stream…</p></div></main>;
  }

  return (
    <main className="panda-watch-page">
      <div className="panda-watch-topbar">
        <button className="panda-watch-back" type="button" onClick={() => window.history.length > 1 ? window.history.back() : setLocation('/home')}><ArrowLeft size={17} /><span>Back</span></button>
        <div className="panda-watch-brand"><span className="panda-watch-brand__mark">🐼</span><strong>Panda.fun</strong><span className="panda-watch-brand__status">NOW PLAYING</span></div>
        <button className="panda-watch-list-btn" type="button" onClick={toggleList}>{inList ? <Check size={16} /> : <Plus size={16} />}<span>{inList ? 'My List' : 'Add to My List'}</span></button>
      </div>

      {error && <div className="panda-watch-error" role="alert"><span>{error}</span><button type="button" onClick={() => setPlaybackRetry(value => value + 1)}>Retry</button></div>}

      <section className={'panda-watch-stage ' + (type === 'series' ? 'is-series' : 'is-movie')}>
        <div className="panda-watch-player">
          {source ? (
            <>
              {sourceLoading && (
                <div className="panda-watch-player-loading" role="status" aria-live="polite">
                  <span aria-hidden="true" />
                  <strong>Preparing your stream…</strong>
                  <small>Connecting to EmbedWave</small>
                </div>
              )}
              <iframe
                key={source}
                src={source}
                title={'Watch ' + title}
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                allowFullScreen
                referrerPolicy="no-referrer"
                loading="eager"
                onLoad={() => setSourceLoading(false)}
              />
            </>
          ) : sourceLoading ? (
            <div className="panda-watch-player-loading" role="status" aria-live="polite">
              <span aria-hidden="true" />
              <strong>Preparing your stream…</strong>
              <small>Connecting to EmbedWave</small>
            </div>
          ) : (
            <div className="panda-watch-player-empty"><Film size={32} /><strong>Playback unavailable</strong><span>The EmbedWave player could not be resolved for this title.</span></div>
          )}
        </div>

      <section className="panda-watch-info">
        <div className="panda-watch-info__backdrop" aria-hidden="true">
          <img src={data?.backdrop || poster} alt="" srcSet={data?.backdrop?.includes("/w1280/") ? (data.backdrop.replace("/w1280/", "/w780/") + " 780w, " + data.backdrop + " 1280w") : undefined} sizes="100vw" loading="eager" fetchPriority="high" decoding="async" />
        </div>
        <div className="panda-watch-info__visual">
          <img src={poster} alt="" srcSet={poster.includes("/w500/") ? (poster.replace("/w500/", "/w342/") + " 342w, " + poster + " 500w") : undefined} sizes="(max-width: 700px) 34vw, 220px" loading="eager" fetchPriority="high" decoding="async" />
          <span>{type === 'movie' ? 'MOVIE' : 'SERIES'}</span>
        </div>
        <div className="panda-watch-info__copy">
          <div className="panda-watch-kicker">
            {type === 'movie' ? <Film size={12} /> : <Tv size={12} />}
            <span>{type === 'movie' ? 'MOVIE' : 'TV SERIES'}</span>
            {type === 'series' && <span>· S{season} E{episode}</span>}
          </div>
          <h1>{title}</h1>
          {currentEpisode && <p className="panda-watch-episode-title">{currentEpisode.title}</p>}
          <div className="panda-watch-info__meta">
            {data?.releaseDate && <span>{String(data.releaseDate).slice(0, 4)}</span>}
            {data?.rating != null && <span>★ {data.rating}</span>}
            {(data?.genres || []).slice(0, 4).map((genre: string) => <span key={genre}>{genre}</span>)}
          </div>
          <p className="panda-watch-info__description">{clean(data?.description) || 'No synopsis is available for this title yet.'}</p>
          <div className="panda-watch-info__actions">
            {shareMessage && <span className="panda-watch-share-feedback" role="status" aria-live="polite">{shareMessage}</span>}
            <button type="button" className="panda-watch-info__action is-primary" onClick={toggleList}>
              {inList ? <Check size={15} /> : <Plus size={15} />} {inList ? 'Saved to My List' : 'Add to My List'}
            </button>
            <button type="button" className="panda-watch-info__action" onClick={shareCurrentPage}>
              <Share2 size={15} /> Share
            </button>
          </div>
        </div>
      </section>

        {type === 'series' && (
          <section className="panda-watch-player-episodes">
            <div className="kinoma-details-section__heading">
              <div>
                <span>KEEP WATCHING</span>
                <h2>Seasons & Episodes</h2>
              </div>
              <small>{seasons.length} {seasons.length === 1 ? 'season' : 'seasons'}</small>
            </div>

            <div className="kinoma-season-tabs panda-watch-season-tabs" role="tablist" aria-label="Seasons">
              {seasons.map(item => (
                <button
                  type="button"
                  key={item.seasonNumber}
                  role="tab"
                  aria-selected={season === item.seasonNumber}
                  className={season === item.seasonNumber ? 'is-selected' : ''}
                  onClick={() => chooseSeason(item.seasonNumber)}
                >
                  Season {item.seasonNumber}
                </button>
              ))}
            </div>

            <div className="kinoma-episode-list panda-watch-episode-list">
              {episodes.map(item => (
                <button
                  type="button"
                  key={item.number}
                  className={'kinoma-episode-card panda-watch-episode-card ' + (item.number === episode ? 'is-current' : '')}
                  onClick={() => {
                    setEpisode(item.number);
                    setLocation('/watch/' + encodeURIComponent(id + '$season$' + season + '$episode$' + item.number) + '?type=series');
                  }}
                >
                  <div className="kinoma-episode-art">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt=""
                        loading={item.number === episode ? 'eager' : 'lazy'}
                        fetchPriority={item.number === episode ? 'high' : 'auto'}
                        decoding="async"
                        srcSet={item.image.includes('/w500/') ? `${item.image.replace('/w500/', '/w342/')} 342w, ${item.image} 500w` : undefined}
                        sizes="(max-width: 620px) 34vw, 108px"
                      />
                    ) : <span><Film size={20} /></span>}
                    <b>EP {item.number}</b>
                    {item.number === episode && <i className="panda-watch-current-indicator"><Play size={12} fill="currentColor" /></i>}
                  </div>
                  <div className="kinoma-episode-copy">
                    <strong>{clean(item.title) || 'Episode ' + item.number}</strong>
                    {item.synopsis && <p>{clean((item as any).synopsis)}</p>}
                    {item.duration && <small>{item.duration}</small>}
                  </div>
                  <ChevronRight className="kinoma-episode-arrow" size={18} />
                </button>
              ))}
              {!episodes.length && <div className="panda-watch-empty">No episodes were returned for this season.</div>}
            </div>

            <div className="panda-watch-episodes__nav">
              <button type="button" disabled={!episodes.find(item => item.number === episode - 1)} onClick={() => navigateEpisode(-1)}>
                <ChevronLeft size={15} /> Previous
              </button>
              <button type="button" disabled={!episodes.find(item => item.number === episode + 1)} onClick={() => navigateEpisode(1)}>
                Next <ChevronRight size={15} />
              </button>
            </div>
          </section>
        )}
      </section>

      <section className="panda-watch-similar">
        <div className="panda-watch-section-head"><div><span>KEEP EXPLORING</span><h2>More like this</h2></div><small>{similar.length} titles</small></div>
        <div className="panda-watch-similar-grid">
          {similar.map(item => <button type="button" key={item.id} onClick={() => setLocation('/details/' + slugifyTitle(titleOf(item, 'Untitled')) + '?type=' + (item.contentType === 'movie' ? 'movie' : 'series'))}>
            <div>{item.image ? <img src={item.image} alt="" loading="lazy" decoding="async" /> : <Film size={25} />}</div>
            <strong>{titleOf(item, 'Untitled')}</strong>
            <span>{item.contentType === 'movie' ? 'Movie' : 'Series'}{item.genres?.[0] ? ' · ' + item.genres[0] : ''}</span>
          </button>)}
          {!similar.length && <div className="panda-watch-empty">No recommendations available right now.</div>}
        </div>
      </section>
    </main>
  );
}
