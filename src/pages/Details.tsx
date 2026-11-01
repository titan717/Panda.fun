import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Footer } from '../components/ui/Footer';
import { useLocation, useRoute, useSearch } from 'wouter';
import { Play, Plus, Check, Film, Tv, Clock3, Share2, List, Grid2X2, Search, ArrowUpDown, Star, ChevronRight, Volume2, VolumeX, Heart, X } from 'lucide-react';
import { api, resolveMediaIdFromSlug } from '../lib/api';
import type { AnimeItem, Episode, AnimeSeasonItem } from '../types';
import { DEFAULT_POSTER, DEFAULT_BANNER } from '../types';
import { libraryManager } from '../lib/library';
import { historyUtil } from '../lib/history';
import { updateSEO } from '../lib/seo';
import { trackGAEvent } from '../lib/analytics';
import { buildDetailsHref, buildWatchHref, parseDetailsRouteSearch } from '../lib/mediaRoute';
import { friendlyNetworkError } from '../lib/networkMessage';
import { Pressable, Reveal, Stagger, ProgressRing, useMotionPreference } from '../motion';
import './details-ott.css';

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/<[^>]*>/g, '').trim() : '';
}

function titleOf(data: any, fallback: string) {
  return typeof data?.title === 'string'
    ? data.title
    : data?.title?.english || data?.title?.romaji || data?.title?.native || fallback;
}

function kindOf(raw: string | null, data: any) {
  return raw === 'movie' || data?.contentType === 'movie' ? 'movie' : 'series';
}

function trailerSrc(url: unknown, muted: boolean) {
  if (typeof url !== 'string' || !url) return '';
  try {
    const parsed = new URL(url);
    const isYouTube = /(^|\.)youtube(?:-nocookie)?\.com$/.test(parsed.hostname) || parsed.hostname === 'youtu.be';
    parsed.searchParams.set('autoplay', '1');
    parsed.searchParams.set('mute', muted ? '1' : '0');
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

function formatDuration(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'Series';
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

function formatRemaining(seconds: number) {
  const remaining = Math.max(1, Math.round(seconds / 60));
  if (remaining >= 60) {
    const hours = Math.floor(remaining / 60);
    return `${hours}h ${String(remaining % 60).padStart(2, '0')}m left`;
  }
  return `${remaining}m left`;
}

type DetailsTab = 'episodes' | 'more' | 'details';

export function Details() {
  const [, params] = useRoute<{ id: string }>('/details/:id');
  const [, setLocation] = useLocation();
  const search = useSearch();
  const routeSlug = params?.id ? decodeURIComponent(params.id) : '';
  const { type, mediaId: routeMediaId } = parseDetailsRouteSearch(search);
  const motionPreference = useMotionPreference();
  const [id, setId] = useState(routeMediaId || routeSlug);
  const [data, setData] = useState<any>(null);
  const [trailer, setTrailer] = useState<any>(null);
  const [trailerFailed, setTrailerFailed] = useState(false);
  const [trailerActive, setTrailerActive] = useState(false);
  const [trailerRequested, setTrailerRequested] = useState(false);
  const [trailerMuted, setTrailerMuted] = useState(true);
  const [seasonItems, setSeasonItems] = useState<AnimeSeasonItem[]>([]);
  const [seasonEpisodes, setSeasonEpisodes] = useState<Episode[]>([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [recommendations, setRecommendations] = useState<AnimeItem[]>([]);
  const [isInList, setIsInList] = useState(false);
  const [isFavourite, setIsFavourite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [activeTab, setActiveTab] = useState<DetailsTab>('episodes');
  const [seasonSheetOpen, setSeasonSheetOpen] = useState(false);
  const [episodeSearch, setEpisodeSearch] = useState('');
  const [episodeSort, setEpisodeSort] = useState<'asc' | 'desc'>('asc');
  const [episodeView, setEpisodeView] = useState<'list' | 'grid'>('list');
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [compactBarVisible, setCompactBarVisible] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');
  const heroRef = useRef<HTMLElement | null>(null);
  const seasonTriggerRef = useRef<HTMLButtonElement | null>(null);
  const watchButtonRef = useRef<HTMLButtonElement | null>(null);
  const kind = kindOf(type, data);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);
    setTrailerFailed(false);
    setTrailerActive(false);
    setSeasonItems([]);
    setSeasonEpisodes([]);
    setRecommendations([]);
    setActiveTab(type === 'movie' ? 'details' : 'episodes');

    const routeMedia = routeMediaId ? api.getDetailsMediaId(routeMediaId) : null;
    const routeTypeMatches = !routeMedia || !type || (type === 'movie' ? routeMedia.type === 'movie' : routeMedia.type === 'tv');
    const resolveSelectedMedia = routeMediaId && routeTypeMatches
      ? Promise.resolve(routeMediaId)
      : resolveMediaIdFromSlug(routeSlug, type || undefined);

    resolveSelectedMedia.then(resolvedId => {
      if (!active) return;
      const parsed = api.getDetailsMediaId(resolvedId);
      if (type === 'movie' && parsed && parsed.type !== 'movie') throw new Error('This title is not a movie result.');
      if (type === 'series' && parsed && parsed.type !== 'tv') throw new Error('This title is not a series result.');
      setId(resolvedId);
      return Promise.all([
        api.getDetails(resolvedId, controller.signal),
        api.getRecommendations(resolvedId, controller.signal).catch(() => ({ results: [] as AnimeItem[] }))
      ]).then(([details, recs]) => {
        if (!active) return;
        setData(details);
        setTrailer({
          available: Boolean(details.trailer?.embedUrl),
          trailer: details.trailer || null
        });
        setRecommendations(recs.results);
        setLoading(false);
      });
    }).catch(err => {
      if (!active) return;
      setError(friendlyNetworkError(err, 'Unable to load this title.'));
      setLoading(false);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [routeSlug, type, retryKey]);

  useEffect(() => {
    if (!trailer?.available || trailerFailed || motionPreference !== 'full') return;
    const timer = window.setTimeout(() => setTrailerActive(true), 1200);
    return () => window.clearTimeout(timer);
  }, [trailer?.available, trailerFailed, motionPreference]);

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
    return () => {
      active = false;
      controller.abort();
    };
  }, [data, id, kind]);

  useEffect(() => {
    if (!data || kind !== 'series' || !seasonItems.length) return;
    let active = true;
    const controller = new AbortController();
    api.getSeasonEpisodes(id, selectedSeason, controller.signal)
      .then(result => active && setSeasonEpisodes(result.episodes))
      .catch(() => active && setSeasonEpisodes([]));
    return () => {
      active = false;
      controller.abort();
    };
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

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      setCompactBarVisible(!entry.isIntersecting);
    }, { rootMargin: '-72px 0px 0px 0px' });
    observer.observe(hero);
    return () => observer.disconnect();
  }, [loading, error]);

  const title = titleOf(data, id || 'Untitled');
  const synopsis = cleanText(data?.description) || 'No synopsis is available for this title yet.';
  const poster = data?.image || DEFAULT_POSTER;
  const backdrop = data?.cover || data?.banner || DEFAULT_BANNER;
  const resume = historyUtil.getAnimeProgress(id);
  const episodeProgress = historyUtil.getAnimeEpisodesProgress(id);
  const resumeLabel = resume && !resume.isCompleted
    ? `Resume S${resume.seasonNumber || selectedSeason} E${resume.episodeNumber || 1}${resume.duration ? ` · ${formatRemaining(resume.duration - resume.playbackTimestamp)}` : ''}`
    : resume?.isCompleted ? 'Watch Again' : 'Play';

  const episodes = useMemo(() => {
    const query = episodeSearch.trim().toLowerCase();
    const filtered = [...seasonEpisodes].filter(ep => {
      if (!query) return true;
      return (`episode ${ep.number}`).includes(query)
        || cleanText(ep.title).toLowerCase().includes(query)
        || cleanText(ep.synopsis).toLowerCase().includes(query);
    });
    filtered.sort((a, b) => episodeSort === 'asc' ? a.number - b.number : b.number - a.number);
    return filtered.map(ep => ({
      ...ep,
      displayTitle: cleanText(ep.title) || `Episode ${ep.number}`,
      displaySynopsis: cleanText(ep.synopsis),
      progress: episodeProgress[String(ep.number)] || null
    }));
  }, [seasonEpisodes, episodeProgress, episodeSearch, episodeSort]);

  useEffect(() => {
    if (loading || error || !(window as Window & { isKinomaAndroidTV?: boolean }).isKinomaAndroidTV) return;
    const frame = window.requestAnimationFrame(() => watchButtonRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [loading, error, id]);

  const watch = () => {
    trackGAEvent('select_content', { content_type: kind });
    if (kind === 'movie') {
      setLocation(buildWatchHref(id, 'movie', 1, 1, resume?.playbackTimestamp || 0));
      return;
    }
    const season = resume?.seasonNumber && seasonItems.some(s => s.seasonNumber === resume.seasonNumber) ? resume.seasonNumber : selectedSeason;
    const episode = Math.max(1, Number(resume?.episodeNumber || 1));
    setLocation(buildWatchHref(id, 'series', season, episode));
  };

  useEffect(() => {
    const canonicalPath = buildDetailsHref({ title: title || routeSlug, id }, kind);
    if (data && window.location.pathname !== new URL(canonicalPath, window.location.origin).pathname) {
      window.history.replaceState(window.history.state, '', canonicalPath);
    }
    updateSEO({
      title,
      description: `${title} — ${synopsis}`.slice(0, 160),
      image: poster,
      type: kind === 'movie' ? 'video.movie' : 'video.tv_show',
      keywords: [title, ...(data?.genres || []), kind === 'movie' ? 'movie' : 'TV series', 'Panda.fun', 'watch online'],
      schema: {
        '@context': 'https://schema.org',
        '@type': kind === 'movie' ? 'Movie' : 'TVSeries',
        name: title,
        description: synopsis,
        image: poster ? [poster] : undefined,
        url: window.location.origin + buildDetailsHref({ title: title || routeSlug, id }, kind),
        datePublished: data?.releaseDate || undefined,
        aggregateRating: data?.rating != null ? { '@type': 'AggregateRating', ratingValue: data.rating, bestRating: 10 } : undefined,
        genre: data?.genres || undefined,
        isPartOf: { '@type': 'WebSite', name: 'Panda.fun', url: window.location.origin }
      }
    });
    setIsInList(libraryManager.isInWatchlist(id));
    setIsFavourite(libraryManager.isFavorite(id));
  }, [title, synopsis, poster, id, kind]);

  const share = async () => {
    const shareUrl = window.location.href;
    setShareFeedback('');
    if (navigator.share) {
      try {
        await navigator.share({ title, text: 'Watch ' + title + ' on Panda.fun', url: shareUrl });
        setShareFeedback('Thanks for sharing!');
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setShareFeedback('Link copied to clipboard');
      } else {
        setShareFeedback('Sharing is not available in this browser.');
      }
    } catch {
      setShareFeedback('Could not share this title. Please try again.');
    }
  };

  const toggleList = () => {
    const next = libraryManager.toggleWatchlist({ id, title, image: poster });
    setIsInList(next);
    trackGAEvent(next ? 'add_to_list' : 'remove_from_list', { content_type: kind });
  };

  const toggleFavourite = () => {
    const next = libraryManager.toggleFavorite({ id, title, image: poster });
    setIsFavourite(next);
    trackGAEvent(next ? 'add_favorite' : 'remove_favorite', { content_type: kind });
  };

  const tabs: Array<{ id: DetailsTab; label: string; hidden?: boolean }> = [
    { id: 'episodes', label: 'Episodes', hidden: kind !== 'series' },
    { id: 'more', label: 'More Like This' },
    { id: 'details', label: 'Details' }
  ];
  const visibleTabs = tabs.filter(tab => !tab.hidden);
  const activeTabIndex = Math.max(0, visibleTabs.findIndex(tab => tab.id === activeTab));
  const hasTrailer = Boolean(trailer?.trailer?.embedUrl) && !trailerFailed;
  const trailerShouldPlay = hasTrailer && (motionPreference === 'full' ? trailerActive : trailerRequested);

  if (loading) {
    return (
      <main className="panda-details" aria-busy="true">
        <div className="panda-details__skeleton-hero panda-shimmer" />
        <div className="panda-details__shell">
          <div className="panda-details__skeleton-title panda-shimmer" />
          <div className="panda-details__skeleton-meta panda-shimmer" />
          <div className="panda-details__skeleton-actions">
            <div className="panda-details__skeleton-button panda-shimmer" />
            <div className="panda-details__skeleton-circle panda-shimmer" />
            <div className="panda-details__skeleton-circle panda-shimmer" />
            <div className="panda-details__skeleton-circle panda-shimmer" />
          </div>
          <div className="panda-details__skeleton-tabs panda-shimmer" />
          <div className="panda-details__skeleton-rail">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="panda-details__skeleton-card panda-shimmer" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="panda-details panda-details--error">
        <div className="panda-details__state" role="alert">
          <Film aria-hidden="true" size={28} />
          <h1>We couldn’t load this title</h1>
          <p>{error}</p>
          <button type="button" onClick={() => setRetryKey(value => value + 1)}>Try again</button>
        </div>
      </main>
    );
  }

  return (
    <main className="panda-details">
      <div className={`panda-details__compact ${compactBarVisible ? 'is-visible' : ''}`} aria-hidden={!compactBarVisible}>
        <img src={poster} alt="" />
        <strong>{title}</strong>
        <Pressable onClick={watch} tabIndex={compactBarVisible ? 0 : -1}>
          <Play size={15} fill="currentColor" aria-hidden="true" /> Play
        </Pressable>
      </div>

      <section ref={heroRef} className="panda-details__hero" aria-label={`${title} details`}>
        <div className="panda-details__backdrop">
          <img src={backdrop} alt="" fetchPriority="high" decoding="async" onError={event => {
            if (event.currentTarget.src !== DEFAULT_BANNER) event.currentTarget.src = DEFAULT_BANNER;
          }} />
          {trailerShouldPlay && (
            <iframe
              key={trailerMuted ? 'muted' : 'sound'}
              src={trailerSrc(trailer?.trailer?.embedUrl, trailerMuted)}
              title={`${title} trailer`}
              className="panda-details__trailer"
              loading="eager"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              onError={() => setTrailerFailed(true)}
            />
          )}
          <div className="panda-details__scrim" />
        </div>

        {trailerShouldPlay && (
          <Pressable
            className="panda-details__mute"
            onClick={() => setTrailerMuted(value => !value)}
            aria-pressed={trailerMuted}
            aria-label={trailerMuted ? 'Unmute trailer' : 'Mute trailer'}
          >
            {trailerMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </Pressable>
        )}

        <div className="panda-details__hero-content">
          <Reveal>
            <div className="panda-details__chips">
              <span className="panda-details__chip"><Tv size={12} aria-hidden="true" /> {kind === 'movie' ? 'Movie' : 'Series'}</span>
              {data?.releaseDate && <span className="panda-details__chip">{String(data.releaseDate).slice(0, 4)}</span>}
              {data?.rating != null && <span className="panda-details__chip"><Star size={12} aria-hidden="true" /> {data.rating}</span>}
              <span className="panda-details__chip">{kind === 'movie' ? formatDuration(data?.runtime) : `${data?.totalEpisodes || seasonItems.reduce((total, season) => total + season.episodeCount, 0) || 0} episodes`}</span>
            </div>

            <h1 className="panda-details__title">{title}</h1>

            {!!data?.genres?.length && <p className="panda-details__genres">{data.genres.slice(0, 5).join(' • ')}</p>}

            <div className="panda-details__actions">
              <Pressable ref={watchButtonRef} className="panda-details__play" onClick={watch}>
                <Play size={19} fill="currentColor" aria-hidden="true" />
                <span>{resumeLabel}</span>
              </Pressable>

              <Pressable
                className={`panda-details__icon-action ${isInList ? 'is-active' : ''}`}
                onClick={toggleList}
                aria-pressed={isInList}
                aria-label={isInList ? 'Remove from My List' : 'Add to My List'}
              >
                {isInList ? <Check size={19} /> : <Plus size={19} />}
              </Pressable>

              <Pressable
                className={`panda-details__icon-action panda-details__icon-action--heart ${isFavourite ? 'is-active' : ''}`}
                onClick={toggleFavourite}
                aria-pressed={isFavourite}
                aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
              >
                <Heart size={19} />
              </Pressable>

              <Pressable className="panda-details__icon-action" onClick={share} aria-label="Share this title">
                <Share2 size={19} />
              </Pressable>
            </div>

            {hasTrailer && motionPreference !== 'full' && !trailerRequested && (
              <Pressable className="panda-details__trailer-toggle" onClick={() => setTrailerRequested(true)}>
                <Film size={15} aria-hidden="true" /> Play trailer
              </Pressable>
            )}

            <p className="panda-details__share-feedback" role="status" aria-live="polite">{shareFeedback}</p>
          </Reveal>
        </div>
      </section>

      <div className="panda-details__shell">
        <div className="panda-details__tabs" role="tablist" aria-label="Title sections">
          <span
            className="panda-details__tab-indicator"
            style={{ transform: `translateX(${activeTabIndex * 100}%)`, width: `${100 / visibleTabs.length}%` }}
            aria-hidden="true"
          />
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`panda-details__tab ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'episodes' && kind === 'series' && (
          <section className="panda-details__panel" role="tabpanel" aria-label="Episodes">
            <div className="panda-details__season-row">
              <Pressable
                ref={seasonTriggerRef}
                className="panda-details__season-trigger"
                onClick={() => setSeasonSheetOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={seasonSheetOpen}
              >
                Season {selectedSeason}
                <ChevronRight size={16} aria-hidden="true" />
              </Pressable>
              <span>{episodes.length} {episodes.length === 1 ? 'episode' : 'episodes'}</span>
            </div>

            <div className="panda-details__controls">
              <div className="panda-details__episode-search">
                <Search size={14} aria-hidden="true" />
                <input
                  value={episodeSearch}
                  onChange={event => setEpisodeSearch(event.target.value)}
                  placeholder="Search episodes"
                  aria-label="Search episodes"
                  autoComplete="off"
                />
              </div>
              <Pressable
                className="panda-details__control"
                onClick={() => setEpisodeSort(value => value === 'asc' ? 'desc' : 'asc')}
                aria-label={episodeSort === 'asc' ? 'Sort episodes descending' : 'Sort episodes ascending'}
              >
                <ArrowUpDown size={15} aria-hidden="true" /> {episodeSort.toUpperCase()}
              </Pressable>
              <Pressable
                className="panda-details__control"
                onClick={() => setEpisodeView(value => value === 'list' ? 'grid' : 'list')}
                aria-label={episodeView === 'list' ? 'Switch to grid view' : 'Switch to list view'}
              >
                {episodeView === 'list' ? <Grid2X2 size={16} /> : <List size={16} />}
              </Pressable>
            </div>

            {episodes.length ? (
              <Stagger className={`panda-details__episodes ${episodeView === 'grid' ? 'is-grid' : ''}`}>
                {episodes.map(ep => {
                  const isCurrent = String(resume?.episodeNumber || '') === String(ep.number) && !resume?.isCompleted;
                  const progress = ep.progress?.completionPercentage || 0;
                  return (
                    <button
                      type="button"
                      key={ep.id || ep.number}
                      className={`panda-details__episode ${isCurrent ? 'is-current' : ''}`}
                      onClick={() => {
                        trackGAEvent('episode_select', { content_type: 'series', season: selectedSeason, episode: ep.number, title });
                        setLocation(buildWatchHref(id, 'series', selectedSeason, ep.number));
                      }}
                    >
                      <span className="panda-details__episode-art">
                        {ep.image ? <img src={ep.image} alt="" loading="lazy" decoding="async" /> : <Play size={20} aria-hidden="true" />}
                        <span className="panda-details__episode-number" aria-hidden="true">{ep.number}</span>
                        {progress > 0 && <ProgressRing value={progress} size={30} className="panda-details__episode-ring" />}
                      </span>
                      <span className="panda-details__episode-copy">
                        <strong>{ep.displayTitle}</strong>
                        {ep.displaySynopsis && <p>{ep.displaySynopsis}</p>}
                        <span className="panda-details__episode-meta">
                          <Clock3 size={12} aria-hidden="true" />
                          {ep.duration ? formatDuration(ep.duration) : 'Play'}
                          {ep.rating != null && <><Star size={11} aria-hidden="true" /> {Number(ep.rating).toFixed(1)}</>}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </Stagger>
            ) : (
              <div className="panda-details__state panda-details__state--inline">
                <h2>No episodes yet</h2>
                <p>Episodes for Season {selectedSeason} have not been added.</p>
              </div>
            )}
          </section>
        )}

        {activeTab === 'more' && (
          <section className="panda-details__panel" role="tabpanel" aria-label="More like this">
            {recommendations.length ? (
              <Stagger className="panda-details__rail">
                {recommendations.slice(0, 18).map(item => {
                  const itemTitle = typeof item.title === 'string' ? item.title : item.title.english || item.title.romaji || 'Untitled';
                  const itemType = item.contentType === 'movie' ? 'movie' : 'series';
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className="panda-details__rail-card"
                      onClick={() => setLocation(buildDetailsHref({ title: itemTitle, id: item.id }, itemType))}
                      aria-label={`Open ${itemTitle}`}
                    >
                      <span className="panda-details__rail-art">
                        {item.image ? <img src={item.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : <Film size={22} aria-hidden="true" />}
                      </span>
                      <strong>{itemTitle}</strong>
                      <span>{item.genres?.[0] || 'Recommended'} • {itemType === 'movie' ? 'Movie' : 'Series'}</span>
                    </button>
                  );
                })}
              </Stagger>
            ) : (
              <div className="panda-details__state panda-details__state--inline">
                <h2>No recommendations yet</h2>
                <p>We couldn’t find similar titles right now.</p>
              </div>
            )}
          </section>
        )}

        {activeTab === 'details' && (
          <section className="panda-details__panel panda-details__about" role="tabpanel" aria-label="Details">
            <Reveal>
              <h2>Synopsis</h2>
              <p className={synopsisExpanded ? 'is-expanded' : ''}>{synopsis}</p>
              <button type="button" onClick={() => setSynopsisExpanded(value => !value)} aria-expanded={synopsisExpanded}>
                {synopsisExpanded ? 'Show less' : 'More'}
              </button>
              <dl className="panda-details__facts">
                {data?.releaseDate && <div><dt>Released</dt><dd>{String(data.releaseDate).slice(0, 4)}</dd></div>}
                {data?.rating != null && <div><dt>Rating</dt><dd>{data.rating}/10</dd></div>}
                {data?.status && <div><dt>Status</dt><dd>{data.status}</dd></div>}
                {!!data?.genres?.length && <div><dt>Genres</dt><dd>{data.genres.join(', ')}</dd></div>}
              </dl>
            </Reveal>
          </section>
        )}
      </div>

      {seasonSheetOpen && (
        <div className="panda-details__sheet-root" role="dialog" aria-modal="true" aria-label="Choose season">
          <button type="button" className="panda-details__sheet-backdrop" onClick={() => setSeasonSheetOpen(false)} aria-label="Close season picker" />
          <div className="panda-details__sheet">
            <header>
              <h2>Choose season</h2>
              <button type="button" onClick={() => {
                setSeasonSheetOpen(false);
                seasonTriggerRef.current?.focus();
              }} aria-label="Close season picker"><X size={18} /></button>
            </header>
            <div>
              {seasonItems.map(season => (
                <button
                  type="button"
                  key={season.seasonNumber}
                  className={selectedSeason === season.seasonNumber ? 'is-selected' : ''}
                  aria-current={selectedSeason === season.seasonNumber}
                  onClick={() => {
                    setSelectedSeason(season.seasonNumber);
                    setSeasonSheetOpen(false);
                    seasonTriggerRef.current?.focus();
                  }}
                >
                  <span>Season {season.seasonNumber}</span>
                  <small>{season.episodeCount} episodes</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <Footer />
    </main>
  );
}
