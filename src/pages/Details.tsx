import React, { useEffect, useMemo, useState } from 'react';
import { Footer } from '../components/ui/Footer';
import { useLocation, useRoute } from 'wouter';
import { Play, Plus, Check, ChevronRight, Film, Tv, Clock3, Share2, List, Grid2X2, Search, ArrowUpDown } from 'lucide-react';
import { api, resolveMediaIdFromSlug } from '../lib/api';
import type { AnimeItem, Episode, AnimeSeasonItem } from '../types';
import { DEFAULT_POSTER, DEFAULT_BANNER } from '../types';
import { libraryManager } from '../lib/library';
import { historyUtil } from '../lib/history';
import { updateSEO } from '../lib/seo';
import { trackGAEvent } from '../lib/analytics';
import { buildDetailsHref } from '../lib/mediaRoute';

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
  const [episodeView, setEpisodeView] = useState<'list' | 'grid'>('grid');
  const [seasonMenuOpen, setSeasonMenuOpen] = useState(false);
  const [episodeSearch, setEpisodeSearch] = useState('');
  const [episodeSort, setEpisodeSort] = useState<'asc' | 'desc'>('asc');
  const kind = kindOf(type, data);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true); setError(null); setData(null); setSeasonItems([]); setSeasonEpisodes([]); setRecommendations([]);
    resolveMediaIdFromSlug(routeSlug, type || undefined).then(resolvedId => {
      if (!active) return;
      setId(resolvedId);
      return Promise.all([
      api.getDetails(resolvedId, controller.signal),
      api.getTrailer(resolvedId, controller.signal).catch(() => ({ available: false, trailer: null })), 
      api.getRecommendations(resolvedId, controller.signal).catch(() => ({ results: [] as AnimeItem[] }))
      ]).then(([details, trailerResult, recs]) => {
        if (!active) return;
        setData(details); setTrailer(trailerResult); setRecommendations(recs.results); setLoading(false);
      });
    }).catch(err => {
      if (!active) return;
      setError(err instanceof Error ? err.message : 'Unable to load this title.'); setLoading(false);
    });
    return () => { active = false; controller.abort(); };
  }, [routeSlug, type, retryKey]);

  useEffect(() => {
    if (!data || kind !== 'series') return;
    let active = true;
    const controller = new AbortController();
    api.getSeasons(id, controller.signal).then(result => {
      if (!active) return;
      setSeasonItems(result.seasons);
      const saved = historyUtil.getAnimeProgress(id);
      setSelectedSeason(result.seasons.some(s => s.seasonNumber === saved?.seasonNumber) ? saved!.seasonNumber : (result.seasons[0]?.seasonNumber || 1));
    }).catch(() => active && setSeasonItems([]));
    return () => { active = false; controller.abort(); };
  }, [data, id, kind]);

  useEffect(() => {
    if (!data || kind !== 'series' || !seasonItems.length) return;
    let active = true;
    const controller = new AbortController();
    api.getSeasonEpisodes(id, selectedSeason, controller.signal).then(result => active && setSeasonEpisodes(result.episodes)).catch(() => active && setSeasonEpisodes([]));
    return () => { active = false; controller.abort(); };
  }, [data, id, kind, selectedSeason, seasonItems.length]);

  useEffect(() => {
    if (!data || !id) return;
    historyUtil.saveMeta(id, {
      title: titleOf(data, id),
      image: data?.image || DEFAULT_POSTER,
      animeId: id,
      seasonNumber: selectedSeason
    });
  }, [data, id, selectedSeason]);

  const title = titleOf(data, id || 'Untitled');
  const synopsis = cleanText(data?.description) || 'No synopsis is available for this title yet.';
  const poster = data?.image || DEFAULT_POSTER;
  const backdrop = data?.cover || data?.banner || DEFAULT_BANNER;
  const resume = historyUtil.getAnimeProgress(id);
  const watchLabel = resume && !resume.isCompleted ? 'Continue Watching' : resume?.isCompleted ? 'Watch Again' : 'Watch Now';
  const modelSeasons = useMemo(() => seasonItems.map(season => ({
    number: season.seasonNumber,
    episodes: season.seasonNumber === selectedSeason ? [...seasonEpisodes]
      .filter(ep => {
        const q = episodeSearch.trim().toLowerCase();
        return !q || ('episode ' + ep.number).includes(q) || cleanText(ep.title).toLowerCase().includes(q) || cleanText(ep.synopsis).toLowerCase().includes(q);
      })
      .sort((a, b) => episodeSort === 'asc' ? a.number - b.number : b.number - a.number)
      .map(ep => ({
        number: ep.number, title: cleanText(ep.title) || 'Episode ' + ep.number, synopsis: cleanText(ep.synopsis), image: ep.image || '', duration: ep.duration, rating: ep.rating
      })) : []
  })), [seasonItems, selectedSeason, seasonEpisodes, episodeSearch, episodeSort]);

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
    const canonicalPath = buildDetailsHref(routeSlug || title, kind);
    if (data && window.location.pathname !== new URL(canonicalPath, window.location.origin).pathname) {
      window.history.replaceState(window.history.state, '', canonicalPath);
    }
    updateSEO({ title, description: `${title} — ${synopsis}`.slice(0, 160), image: poster, type: kind === 'movie' ? 'video.movie' : 'video.tv_show', keywords: [title, ...(data?.genres || []), kind === 'movie' ? 'movie' : 'TV series', 'Panda.fun', 'watch online'], schema: { '@context': 'https://schema.org', '@type': kind === 'movie' ? 'Movie' : 'TVSeries', name: title, description: synopsis, image: poster ? [poster] : undefined, url: window.location.origin + buildDetailsHref(routeSlug || title, kind), datePublished: data?.releaseDate || undefined, aggregateRating: data?.rating != null ? { '@type': 'AggregateRating', ratingValue: data.rating, bestRating: 10 } : undefined, genre: data?.genres || undefined, isPartOf: { '@type': 'WebSite', name: 'Panda.fun', url: window.location.origin } } });
    setIsInList(libraryManager.isInWatchlist(id));
  }, [title, synopsis, poster, id, kind]);

  const share = async () => {
    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: 'Watch ' + title + ' on Panda.fun', url: shareUrl });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }
    } catch {
      // Native share can be cancelled; no UI error is needed.
    }
  };

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
        </div>
        <div className="kinoma-details-hero__content">
          <div className="kinoma-details-copy">
            <div className="kinoma-details-eyebrow">{kind === 'movie' ? <Film size={13} /> : <Tv size={13} />} {kind === 'movie' ? 'Movie' : 'TV Series'}</div>
            <h1 className={'kinoma-details-title kinoma-details-title--' + (kind === 'movie' ? 'movie' : 'series')}>{title}</h1>
            <div className="kinoma-details-meta" aria-label="Title information">
              {data?.releaseDate && <span>{String(data.releaseDate).slice(0, 4)}</span>}
              {data?.rating != null && <span>★ {data.rating}</span>}
              <span>{kind === 'movie' ? formatDuration(data?.runtime) : 'Series'}</span>
              {(data?.genres || []).slice(0, 3).map((g: string) => <span key={g}>{g}</span>)}
            </div>
            <p className="kinoma-details-synopsis">{synopsis}</p>
            <div className="kinoma-details-actions">
              <button className="kinoma-details-3d-button kinoma-details-3d-button--watch" onClick={watch}><span><Play size={18} fill="currentColor" /> {watchLabel}</span></button>
              <button className={'kinoma-details-3d-button kinoma-details-3d-button--list ' + (isInList ? 'is-added' : '')} onClick={toggleList}><span>{isInList ? <Check size={18} /> : <Plus size={18} />} {isInList ? 'In My List' : 'Add to My List'}</span></button>
              <button className="kinoma-details-share" type="button" onClick={share} aria-label="Share this title"><span><Share2 className="kinoma-details-share__icon" size={16} /> Share</span></button>
            </div>
          </div>
        </div>
      </section>

      {kind === 'series' && (
        <section className="kinoma-details-section kinoma-details-seasons">
          <div className="kinoma-details-section__heading kinoma-details-section__heading--episodes">
            <div className="kinoma-season-heading">
              <span className="kinoma-section-accent" aria-hidden="true" />
              <div className="kinoma-season-picker">
              <button type="button" className="kinoma-season-picker__trigger" onClick={() => setSeasonMenuOpen(value => !value)} aria-expanded={seasonMenuOpen} aria-haspopup="listbox">
                <span>Seasons</span><span className="kinoma-season-picker__chevron">⌄</span>
              </button>
              {seasonMenuOpen && (
                <div className="kinoma-season-picker__menu" role="listbox" aria-label="Choose season">
                  {modelSeasons.map(season => (
                    <button type="button" key={season.number} role="option" aria-selected={selectedSeason === season.number} className={selectedSeason === season.number ? 'is-selected' : ''} onClick={() => { setSelectedSeason(season.number); setSeasonMenuOpen(false); }}>
                      Season {season.number}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="kinoma-details-section__controls">
              <div className="kinoma-episode-search"><Search size={14} /><input value={episodeSearch} onChange={e => setEpisodeSearch(e.target.value)} placeholder="Search episodes" aria-label="Search episodes" /></div>
              <button type="button" className="kinoma-episode-sort" onClick={() => setEpisodeSort(value => value === 'asc' ? 'desc' : 'asc')} title={episodeSort === 'asc' ? 'Sort descending' : 'Sort ascending'} aria-label={episodeSort === 'asc' ? 'Sort episodes descending' : 'Sort episodes ascending'}><ArrowUpDown size={15} /><span>{episodeSort === 'asc' ? 'ASC' : 'DESC'}</span></button>
              <small>{modelSeasons.find(s => s.number === selectedSeason)?.episodes.length || 0} {((modelSeasons.find(s => s.number === selectedSeason)?.episodes.length || 0) === 1) ? 'episode' : 'episodes'}</small>
              <button type="button" className="kinoma-episode-view-toggle" onClick={() => setEpisodeView(value => value === 'list' ? 'grid' : 'list')} aria-label={episodeView === 'list' ? 'Switch to grid view' : 'Switch to list view'} title={episodeView === 'list' ? 'Grid view' : 'List view'}>
                {episodeView === 'list' ? <Grid2X2 size={16} /> : <List size={17} />}
              </button>
            </div>
          </div>
          </div>
          <div className={'kinoma-episode-list kinoma-episode-list--' + episodeView}>
            {(modelSeasons.find(s => s.number === selectedSeason)?.episodes || []).map(ep => (
              <button
                type="button"
                key={ep.number}
                className="kinoma-episode-card"
                onClick={() => {
                  trackGAEvent('episode_select', { content_type: 'series', season: selectedSeason, episode: ep.number, title });
                  setLocation('/watch/' + encodeURIComponent(id + '$season$' + selectedSeason + '$episode$' + ep.number) + '?type=series');
                }}
              >
                <div className="kinoma-episode-art">
                  {ep.image ? <img src={ep.image} alt="" loading={ep.number === (historyUtil.getAnimeProgress(id)?.episodeNumber || 0) ? 'eager' : 'lazy'} decoding="async" /> : <span><Play size={20} /></span>}
                </div>
                <div className="kinoma-episode-copy">
                  <strong className="kinoma-episode-number">Episode {ep.number}</strong>
                  {ep.title && ep.title.toLowerCase() !== ('episode ' + ep.number).toLowerCase() && <span>{ep.title}</span>}
                  <div className="kinoma-episode-meta">{ep.duration ? <span>{formatDuration(ep.duration)}</span> : null}{ep.duration && ep.rating ? <i>•</i> : null}{ep.rating ? <span>★ {ep.rating.toFixed(1)}</span> : null}</div>
                  {ep.synopsis && <p>{ep.synopsis}</p>}
                </div>
                <ChevronRight className="kinoma-episode-arrow" size={18} />
              </button>
            ))}
            {!loading && !(modelSeasons.find(s => s.number === selectedSeason)?.episodes.length) && <div className="kinoma-details-bottom">No episodes were returned for this season.</div>}
          </div>
        </section>
      )}

      <section className="kinoma-details-section kinoma-details-more-section">
        <div className="kinoma-details-section__heading kinoma-details-section__heading--more"><div><span className="kinoma-section-accent" aria-hidden="true" /><div><span>DISCOVER MORE</span><h2>More Like This</h2></div></div><small>Recommended for you</small></div>
        <div className="kinoma-more-rail">
          {recommendations.map((item, i) => {
            const itemTitle = typeof item.title === 'string' ? item.title : item.title.english || item.title.romaji || 'Untitled';
            const itemType = item.contentType === 'movie' ? 'movie' : 'series';
            return (
              <button type="button" key={item.id} className="kinoma-more-card" onClick={() => setLocation(buildDetailsHref(itemTitle, itemType))} aria-label={'Open ' + itemTitle}>
                <div className={'kinoma-more-card__art tone-' + (i % 5)}>
                  {item.image ? <img src={item.image} alt="" loading={i < 3 ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" /> : <Film size={25} />}
                </div>
                <div className="kinoma-more-card__copy"><strong>{itemTitle}</strong><span>{item.genres?.[0] || 'Recommended'} <i>•</i> {itemType === 'movie' ? 'Movie' : 'Series'}</span></div>
              </button>
            );
          })}
          {!recommendations.length && !loading && <div className="kinoma-details-bottom">No recommendations are available right now.</div>}
        </div>
      </section>
      <div className="kinoma-details-bottom"><Clock3 size={14} /> Metadata and playback are powered by MovieApi.</div>
    </main>
  );
}
