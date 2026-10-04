import React, { useEffect, useMemo, useState } from 'react';
import { Footer } from '../components/ui/Footer';
import { useLocation, useRoute } from 'wouter';
import { Play, Plus, Check, ChevronRight, Film, Tv, Clock3 } from 'lucide-react';
import { api, resolveMediaIdFromSlug } from '../lib/api';
import type { AnimeItem, Episode, AnimeSeasonItem } from '../types';
import { DEFAULT_POSTER, DEFAULT_BANNER } from '../types';
import { libraryManager } from '../lib/library';
import { historyUtil } from '../lib/history';
import { updateSEO } from '../lib/seo';
import { trackGAEvent } from '../lib/analytics';
import { slugifyTitle } from '../lib/slug';

function cleanText(value: unknown) { return typeof value === 'string' ? value.replace(/<[^>]*>/g, '').trim() : ''; }
function titleOf(data: any, fallback: string) { return typeof data?.title === 'string' ? data.title : data?.title?.english || data?.title?.romaji || data?.title?.native || fallback; }
function kindOf(raw: string | null, data: any) { return raw === 'movie' || data?.contentType === 'movie' ? 'movie' : 'series'; }
function trailerSrc(url: unknown) {
  if (typeof url !== 'string' || !url) return '';
  try {
    const parsed = new URL(url);
    const isYouTube = /(^|\.)youtube(?:-nocookie)?\.com$/.test(parsed.hostname) || parsed.hostname === 'youtu.be';
    parsed.searchParams.set('autoplay', '1');
    parsed.searchParams.set('mute', '0');
    parsed.searchParams.set('playsinline', '1');
    parsed.searchParams.set('controls', '0');
    parsed.searchParams.set('disablekb', '1');
    parsed.searchParams.set('fs', '0');
    parsed.searchParams.set('iv_load_policy', '3');
    parsed.searchParams.set('rel', '0');
    if (isYouTube) {
      parsed.searchParams.set('enablejsapi', '1');
      parsed.searchParams.set('origin', window.location.origin);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}
function formatDuration(value: unknown) { const n = Number(value); if (!Number.isFinite(n) || n <= 0) return 'Series'; const h = Math.floor(n / 60); const m = Math.round(n % 60); return h ? h + 'h ' + String(m).padStart(2, '0') + 'm' : m + 'm'; }

export function Details() {
  const [, params] = useRoute<{ id: string }>('/details/:id');
  const [location, setLocation] = useLocation();
  const routeSlug = params?.id ? decodeURIComponent(params.id) : '';
  const [id, setId] = useState(routeSlug);
  const type = new URLSearchParams(location.split('?')[1] || '').get('type');
  const [data, setData] = useState<any>(null);
  const [trailer, setTrailer] = useState<any>(null);
  const [seasonItems, setSeasonItems] = useState<AnimeSeasonItem[]>([]);
  const [seasonEpisodes, setSeasonEpisodes] = useState<Episode[]>([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [recommendations, setRecommendations] = useState<AnimeItem[]>([]);
  const [isInList, setIsInList] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const kind = kindOf(type, data);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setData(null); setSeasonItems([]); setSeasonEpisodes([]); setRecommendations([]);
    resolveMediaIdFromSlug(routeSlug, type || undefined).then(resolvedId => {
      if (!active) return;
      setId(resolvedId);
      return Promise.all([
      api.getDetails(resolvedId),
      api.getTrailer(resolvedId).catch(() => ({ available: false, trailer: null })),
      api.getRecommendations(resolvedId).catch(() => ({ results: [] as AnimeItem[] }))
      ]).then(([details, trailerResult, recs]) => {
        if (!active) return;
        setData(details); setTrailer(trailerResult); setRecommendations(recs.results); setLoading(false);
      });
    }).catch(err => {
      if (!active) return;
      setError(err instanceof Error ? err.message : 'Unable to load this title.'); setLoading(false);
    });
    return () => { active = false; };
  }, [routeSlug, type, retryKey]);

  useEffect(() => {
    if (!data || kind !== 'series') return;
    let active = true;
    api.getSeasons(id).then(result => {
      if (!active) return;
      setSeasonItems(result.seasons);
      const saved = historyUtil.getAnimeProgress(id);
      setSelectedSeason(result.seasons.some(s => s.seasonNumber === saved?.seasonNumber) ? saved!.seasonNumber : (result.seasons[0]?.seasonNumber || 1));
    }).catch(() => active && setSeasonItems([]));
    return () => { active = false; };
  }, [data, id, kind]);

  useEffect(() => {
    if (!data || kind !== 'series' || !seasonItems.length) return;
    let active = true;
    api.getSeasonEpisodes(id, selectedSeason).then(result => active && setSeasonEpisodes(result.episodes)).catch(() => active && setSeasonEpisodes([]));
    return () => { active = false; };
  }, [data, id, kind, selectedSeason, seasonItems.length]);

  const title = titleOf(data, id || 'Untitled');
  const synopsis = cleanText(data?.description) || 'No synopsis is available for this title yet.';
  const poster = data?.image || DEFAULT_POSTER;
  const backdrop = data?.cover || data?.banner || DEFAULT_BANNER;
  const resume = historyUtil.getAnimeProgress(id);
  const watchLabel = resume && !resume.isCompleted ? 'Continue Watching' : resume?.isCompleted ? 'Watch Again' : 'Watch Now';
  const modelSeasons = useMemo(() => seasonItems.map(season => ({
    number: season.seasonNumber,
    episodes: season.seasonNumber === selectedSeason ? seasonEpisodes.map(ep => ({
      number: ep.number, title: cleanText(ep.title) || 'Episode ' + ep.number, synopsis: cleanText((ep as any).synopsis), image: ep.image || ''
    })) : []
  })), [seasonItems, selectedSeason, seasonEpisodes]);

  const watch = () => {
    trackGAEvent('select_content', { content_type: kind });
    if (kind === 'movie') {
      const suffix = resume?.playbackTimestamp ? '?type=movie&t=' + Math.floor(resume.playbackTimestamp) : '?type=movie';
      setLocation('/watch/' + encodeURIComponent(id) + suffix);
      return;
    }
    const season = resume?.seasonNumber && seasonItems.some(s => s.seasonNumber === resume.seasonNumber) ? resume.seasonNumber : selectedSeason;
    const episode = Math.max(1, Number(resume?.episodeNumber || 1));
    setLocation('/watch/' + encodeURIComponent(id + '$season$' + season + '$episode$' + episode) + '?type=series');
  };

  useEffect(() => {
    const canonicalPath = '/details/' + slugifyTitle(title) + '?type=' + kind;
    if (data && routeSlug !== slugifyTitle(title)) {
      window.history.replaceState(window.history.state, '', canonicalPath);
    }
    updateSEO({ title, description: `${title} — ${synopsis}`.slice(0, 160), image: poster, type: kind === 'movie' ? 'video.movie' : 'video.tv_show', keywords: [title, ...(data?.genres || []), kind === 'movie' ? 'movie' : 'TV series', 'Panda.fun', 'watch online'], schema: { '@context': 'https://schema.org', '@type': kind === 'movie' ? 'Movie' : 'TVSeries', name: title, description: synopsis, image: poster ? [poster] : undefined, url: window.location.origin + '/details/' + slugifyTitle(title) + '?type=' + kind, datePublished: data?.releaseDate || undefined, aggregateRating: data?.rating != null ? { '@type': 'AggregateRating', ratingValue: data.rating, bestRating: 10 } : undefined, genre: data?.genres || undefined, isPartOf: { '@type': 'WebSite', name: 'Panda.fun', url: window.location.origin } } });
    setIsInList(libraryManager.isInWatchlist(id));
  }, [title, synopsis, poster, id, kind]);

  const toggleList = () => {
    const next = libraryManager.toggleWatchlist({ id, title, image: poster });
    setIsInList(next);
    trackGAEvent(next ? 'add_to_list' : 'remove_from_list', { content_type: kind });
  };

  return (
    <main className="kinoma-details-page">
      {loading && <div className="panda-state-card" role="status"><span className="panda-state-card__spinner" aria-hidden="true" /><div><strong>Loading title</strong><small>Fetching the latest details…</small></div></div>}
      {error && !loading && <div className="panda-state-card is-error" role="alert"><div><strong>We couldn't load this title.</strong><small>{error}</small></div><button type="button" onClick={() => setRetryKey(value => value + 1)}>Retry</button></div>}
      <section className="kinoma-details-hero kinoma-details-hero--trailer">
        <div className="kinoma-details-hero__trailer-bg" aria-label={title + ' trailer preview'}>
          {trailer?.trailer?.embedUrl ? <iframe src={trailerSrc(trailer.trailer.embedUrl)} title={title + ' trailer'} className="kinoma-details-hero__trailer-video" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /> : (
            <div className="kinoma-details-hero__trailer-placeholder"><div><Film size={42} /></div><span>TRAILER PREVIEW</span><strong>Trailer preview unavailable</strong><small>MovieApi did not return a trailer for this title.</small></div>
          )}
          <div className="kinoma-details-hero__trailer-shade" />
        </div>
        <div className="kinoma-details-hero__content">
          <div className="kinoma-details-copy">
            <div className="kinoma-details-eyebrow">{kind === 'movie' ? <Film size={13} /> : <Tv size={13} />} {kind === 'movie' ? 'Movie' : 'TV Series'}</div>
            <h1>{title}</h1>
            <div className="kinoma-details-meta">{data?.releaseDate && <span>{String(data.releaseDate).slice(0, 4)}</span>}{data?.rating != null && <span>★ {data.rating}</span>}<span>{kind === 'movie' ? formatDuration(data?.runtime) : 'Series'}</span>{(data?.genres || []).slice(0, 3).map((g: string) => <span key={g}>{g}</span>)}</div>
            <p className="kinoma-details-synopsis">{synopsis}</p>
            <div className="kinoma-details-actions">
              <button className="kinoma-details-3d-button kinoma-details-3d-button--watch" onClick={watch}><span><Play size={18} fill="currentColor" /> {watchLabel}</span></button>
              <button className={'kinoma-details-3d-button kinoma-details-3d-button--list ' + (isInList ? 'is-added' : '')} onClick={toggleList}><span>{isInList ? <Check size={18} /> : <Plus size={18} />} {isInList ? 'In My List' : 'Add to My List'}</span></button>
            </div>
          </div>
        </div>
      </section>

      {kind === 'series' && (
        <section className="kinoma-details-section">
          <div className="kinoma-details-section__heading"><div><span>KEEP WATCHING</span><h2>Seasons & Episodes</h2></div><small>{modelSeasons.length} {modelSeasons.length === 1 ? 'season' : 'seasons'}</small></div>
          <div className="kinoma-season-tabs">{modelSeasons.map(season => <button type="button" key={season.number} className={selectedSeason === season.number ? 'is-selected' : ''} onClick={() => setSelectedSeason(season.number)}>Season {season.number}</button>)}</div>
          <div className="kinoma-episode-list">
            {(modelSeasons.find(s => s.number === selectedSeason)?.episodes || []).map(ep => (
              <button type="button" key={ep.number} className="kinoma-episode-card" onClick={() => setLocation('/watch/' + encodeURIComponent(id + '$season$' + selectedSeason + '$episode$' + ep.number) + '?type=series')}>
                <div className="kinoma-episode-art">{ep.image ? <img src={ep.image} alt="" loading="lazy" decoding="async" /> : <span><Play size={20} /></span>}<b>EP {ep.number}</b></div>
                <div className="kinoma-episode-copy"><strong>{ep.title}</strong>{ep.synopsis && <p>{ep.synopsis}</p>}</div>
                <ChevronRight className="kinoma-episode-arrow" size={18} />
              </button>
            ))}
            {!loading && !(modelSeasons.find(s => s.number === selectedSeason)?.episodes.length) && <div className="kinoma-details-bottom">No episodes were returned for this season.</div>}
          </div>
        </section>
      )}

      {kind === 'movie' && (
        <section className="kinoma-details-section">
          <div className="kinoma-details-section__heading"><div><span>KEEP EXPLORING</span><h2>More like this</h2></div><small>Powered by MovieApi recommendations</small></div>
          <div className="kinoma-more-grid">
            {recommendations.map((item, i) => <button type="button" key={item.id} className="kinoma-more-card" onClick={() => setLocation('/details/' + slugifyTitle(typeof item.title === 'string' ? item.title : item.title.english || item.title.romaji || 'Untitled') + '?type=' + (item.contentType === 'movie' ? 'movie' : 'series'))}><div className={'kinoma-more-card__art tone-' + (i % 5)}>{item.image ? <img src={item.image} alt="" loading="lazy" decoding="async" /> : <Film size={25} />}</div><strong>{typeof item.title === 'string' ? item.title : item.title.english || item.title.romaji || 'Untitled'}</strong><span>{item.genres?.[0] || 'Recommended'} • {item.contentType === 'movie' ? 'Movie' : 'Series'}</span></button>)}
            {!recommendations.length && !loading && <div className="kinoma-details-bottom">No recommendations are available right now.</div>}
          </div>
        </section>
      )}
      <div className="kinoma-details-bottom"><Clock3 size={14} /> Metadata and playback are powered by MovieApi.</div>
    </main>
  );
}
