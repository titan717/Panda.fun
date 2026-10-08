import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Footer } from '../components/ui/Footer';
import { Link } from 'wouter';
import { KinomaLogo } from '../components/ui/KinomaLogo';
import { ArrowRight, Check, Film, Github, Play, Plus, Search, Sparkles, Tv } from 'lucide-react';
import { api, MovieApiError, MovieApiMedia } from '../lib/api';
import { trackEvent, trackGAEvent } from '../lib/analytics';
import { libraryManager } from '../lib/library';
import { useAuth } from '../lib/AuthContext';
import {
  getActiveProfileId,
  listProfiles,
  saveProfile,
  setActiveProfileId,
  type PandaProfile,
} from '../lib/profileStore';
import { initializeProfileStorage } from '../lib/profileScope';
import { historyUtil } from '../lib/history';
import { ProfileAvatar, ProfileSetup } from './Profile';
import { updateSEO } from '../lib/seo';
import { buildDetailsHref, buildWatchHref } from '../lib/mediaRoute';
import { optimizeImageUrl } from '../lib/mediaImages';
import { ModernContinueWatching } from '../components/ui/modern/ModernContinueWatching';
import '../styles/panda-home.css';

type RailKind = 'trending' | 'streamingNetflix' | 'streamingDisney' | 'popular' | 'tv' | 'movie' | 'airing';

function KindIcon({ kind }: { kind: RailKind }) {
  if (kind === 'movie') return <Film size={14} strokeWidth={1.9} />;
  if (kind === 'trending' || kind === 'streamingNetflix' || kind === 'streamingDisney') return <Sparkles size={14} strokeWidth={1.9} />;
  if (kind === 'airing' || kind === 'tv') return <Tv size={14} strokeWidth={1.9} />;
  return <Sparkles size={14} strokeWidth={1.9} />;
}

function HomeProfileGate({
  onReady,
  onBlock,
}: {
  onReady: () => void;
  onBlock: () => void;
}) {
  const { user, loading } = useAuth();
  const [profiles, setProfiles] = useState<PandaProfile[]>([]);
  const [gateState, setGateState] = useState<'loading' | 'chooser' | 'setup' | 'leaving' | 'hidden'>('loading');
  const [autoProfileId, setAutoProfileId] = useState('');
  const [transitionProfileId, setTransitionProfileId] = useState('');
  const selectionTimer = useRef<number | null>(null);
  const [countdownProgress, setCountdownProgress] = useState(1);
  const [countdownEnabled, setCountdownEnabled] = useState(true);

  const activateProfile = React.useCallback((profile: PandaProfile, reason: 'auto' | 'manual') => {
    if (!user) return;

    initializeProfileStorage(user.uid, profile.id, false, [
      'kinoma_history',
      'kinoma_watchlist',
      'kinoma_completed',
      'kinoma_favorites',
      'kinoma_ep_progress',
      'kinoma_meta_cache',
      'kinoma_search_history',
    ]);
    setActiveProfileId(user.uid, profile.id);
    void historyUtil.syncFromFirestore(user.uid);
    void libraryManager.syncFromFirestore(user.uid);

    void trackEvent({
      type: 'profile_select',
      metadata: {
        profileId: profile.id,
        selectionMode: reason,
      },
    });

    setTransitionProfileId(profile.id);
    setGateState('leaving');
    if (selectionTimer.current) window.clearTimeout(selectionTimer.current);
    selectionTimer.current = window.setTimeout(() => {
      selectionTimer.current = null;
      setTransitionProfileId('');
      setGateState('hidden');
      onReady();
    }, 380);
  }, [onReady, user]);

  const chooseProfile = React.useCallback((profile: PandaProfile, reason: 'auto' | 'manual' = 'manual') => {
    setCountdownEnabled(false);
    activateProfile(profile, reason);
  }, [activateProfile]);

  useEffect(() => {
    if (loading) {
      onBlock();
      setGateState('loading');
      return;
    }

    if (!user) {
      setProfiles([]);
      setGateState('hidden');
      onReady();
      return;
    }

    let cancelled = false;
    onBlock();
    setGateState('loading');
    setCountdownEnabled(true);
    setCountdownProgress(1);

    void listProfiles(user.uid).then((loaded) => {
      if (cancelled) return;

      setProfiles(loaded);

      if (!loaded.length) {
        setAutoProfileId('');
        setGateState('setup');
        return;
      }

      const lastUsedId = getActiveProfileId(user.uid);
      const fallback = loaded.find((profile) => profile.id === lastUsedId) || loaded[0];

      setAutoProfileId(fallback.id);
      setCountdownProgress(1);
      setCountdownEnabled(true);
      setGateState('chooser');
    });

    return () => {
      cancelled = true;
      if (selectionTimer.current) {
        window.clearTimeout(selectionTimer.current);
        selectionTimer.current = null;
      }
    };
  }, [loading, onBlock, onReady, user?.uid]);

  useEffect(() => {
    if (gateState !== 'chooser' || !autoProfileId || !countdownEnabled) return;

    const startedAt = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const progress = Math.max(0, 1 - elapsed / 5000);
      setCountdownProgress(progress);

      if (elapsed >= 5000) {
        const profile = profiles.find((item) => item.id === autoProfileId);
        if (profile) {
          chooseProfile(profile, 'auto');
        }
        return;
      }

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [gateState, autoProfileId, countdownEnabled, profiles, chooseProfile]);

  if (gateState === 'hidden') return null;

  if (gateState === 'loading') {
    return (
      <div className="panda-home-profile-gate" role="status" aria-live="polite">
        <div className="panda-home-profile-gate__ambient" aria-hidden="true" />
        <div className="panda-home-profile-gate__loading">
          <div className="panda-home-profile-gate__loading-mark" aria-hidden="true">
            <img src="/profile-avatars/panda.svg" alt="" />
          </div>
        </div>
      </div>
    );
  }

  if (gateState === 'setup' && user) {
    const defaultName = user.displayName?.trim() || user.email?.split('@')[0] || 'Panda';
    return (
      <div className="panda-home-profile-gate panda-home-profile-gate--setup">
        <div className="panda-home-profile-gate__ambient" aria-hidden="true" />
        <ProfileSetup
          defaultName={defaultName}
          initialProfile={null}
          onComplete={async (profile) => {
            const saved = await saveProfile(user.uid, {
              ...profile,
              id: profile.id,
            });
            initializeProfileStorage(user.uid, saved.id, profiles.length === 0, [
              'kinoma_history',
              'kinoma_watchlist',
              'kinoma_completed',
              'kinoma_favorites',
              'kinoma_ep_progress',
              'kinoma_meta_cache',
              'kinoma_search_history',
            ]);
            setActiveProfileId(user.uid, saved.id);
            void historyUtil.syncFromFirestore(user.uid);
            void libraryManager.syncFromFirestore(user.uid);
            void trackEvent({
              type: 'profile_create',
              metadata: {
                profileId: saved.id,
                avatar: saved.avatar,
                movieGenres: saved.movieGenres,
                seriesGenres: saved.seriesGenres,
                selectionMode: 'home_setup',
              },
            });
            setProfiles([saved, ...profiles]);
            setGateState('hidden');
            onReady();
          }}
          onBack={() => setGateState('chooser')}
        />
      </div>
    );
  }

  const autoProfile = profiles.find((profile) => profile.id === autoProfileId) || profiles[0];

  return (
    <>
      <div className={'panda-home-profile-gate' + (gateState === 'leaving' ? ' panda-home-profile-gate--leaving' : '')}>
        <div className="panda-home-profile-gate__ambient" aria-hidden="true" />
        <div className="panda-home-profile-gate__inner">
          <div className="panda-home-profile-gate__brand" aria-label="Panda.fun">
            <span className="panda-home-profile-gate__brand-icon">
              <img src="/icon.svg" alt="" />
            </span>
            <span>PANDA.FUN</span>
          </div>
          <h1>Who's watching?</h1>

          <div className="panda-home-profile-gate__profiles">
            {profiles.map((profile) => {
              const isAuto = profile.id === autoProfile?.id && countdownEnabled;
              return (
                <button
                  key={profile.id}
                  type="button"
                  className={
                    'panda-home-profile-gate__tile' +
                    (isAuto ? ' is-autoselect' : '') +
                    (profile.id === transitionProfileId ? ' is-selected' : '') +
                    (gateState === 'leaving' && profile.id !== transitionProfileId ? ' is-dimmed' : '')
                  }
                  onClick={() => chooseProfile(profile)}
                  disabled={gateState === 'leaving'}
                  aria-label={'Use ' + profile.name + ' profile' + (profile.pinHash ? ' (locked)' : '')}
                >
                  <span className="panda-home-profile-gate__avatar">
                    <ProfileAvatar profile={profile} size="lg" />
                    {isAuto && (
                      <svg
                        className="panda-home-profile-gate__countdown"
                        viewBox="0 0 132 132"
                        aria-hidden="true"
                      >
                        <circle
                          cx="66"
                          cy="66"
                          r="58"
                          pathLength="1"
                          className="panda-home-profile-gate__countdown-track"
                        />
                        <circle
                          cx="66"
                          cy="66"
                          r="58"
                          pathLength="1"
                          className="panda-home-profile-gate__countdown-progress"
                          style={{ strokeDashoffset: 1 - countdownProgress }}
                        />
                      </svg>
                    )}
                  </span>
                  <span>{profile.name}</span>
                </button>
              );
            })}

            {profiles.length < 6 && (
              <button
                type="button"
                className="panda-home-profile-gate__tile panda-home-profile-gate__tile--add"
                onClick={() => {
                  if (gateState === 'leaving') return;
                  setCountdownEnabled(false);
                  setGateState('setup');
                }}
              >
                <span className="panda-home-profile-gate__add-avatar"><Plus size={30} /></span>
                <span>Add profile</span>
              </button>
            )}
          </div>

          <div className="panda-home-profile-gate__footer">
            <Link href="/profile?manage=1">Manage profiles</Link>
            <Link href="/settings">Settings</Link>
          </div>
        </div>
      </div>

    </>
  );
}

function trailerSrc(url: unknown, soundEnabled = true) {
  if (typeof url !== 'string' || !url) return '';
  try {
    const parsed = new URL(url);
    const isYouTube = /(^|\.)youtube(?:-nocookie)?\.com$/.test(parsed.hostname) || parsed.hostname === 'youtu.be';
    parsed.searchParams.set('autoplay', '1');
    parsed.searchParams.set('mute', soundEnabled ? '0' : '1');
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

function PandaPoster({ item, priority = false }: { item: MovieApiMedia; priority?: boolean }) {
  const candidates = [item.poster, item.backdrop]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .map(value => optimizeImageUrl(value, 'w342') || value);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSourceIndex(0);
    setFailed(false);
  }, [item.id, item.poster, item.backdrop]);

  const src = candidates[sourceIndex];

  if (!src || failed) {
    return (
      <div className="panda-content-card__image-fallback" aria-hidden="true">
        <KinomaLogo size="md" variant="mark" />
        <span>{item.title}</span>
      </div>
    );
  }

  return (
    <div className="panda-content-card__image-wrap">
      <div className="panda-content-card__image-skeleton" aria-hidden="true" />
      <img
        src={src}
        srcSet={src.includes('/w500/') ? `${src.replace('/w500/', '/w342/')} 342w, ${src} 500w` : undefined}
        sizes="(max-width: 700px) 42vw, (max-width: 1100px) 24vw, 18vw"
        alt=""
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => {
          if (sourceIndex < candidates.length - 1) setSourceIndex(index => index + 1);
          else setFailed(true);
        }}
        onLoad={event => event.currentTarget.previousElementSibling?.classList.add('is-hidden')}
      />
    </div>
  );
}

function PandaContentCard({
  item,
  onHover,
  onLeave,
  badge,
  priority = false,
  analyticsSection
}: {
  item: MovieApiMedia;
  onHover: (item: MovieApiMedia) => void;
  onLeave: () => void;
  badge?: string;
  priority?: boolean;
  analyticsSection?: string;
}) {
  const [inList, setInList] = useState(() => libraryManager.isInWatchlist(item.id));
  const toggleList = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setInList(libraryManager.toggleWatchlist({ id: item.id, title: item.title, image: item.poster || '' }));
  };
  const type = item.type === 'movie' ? 'movie' : 'series';
  const metadata = [
    item.year,
    item.rating ? `★ ${Number(item.rating).toFixed(1)}` : null,
    item.type === 'movie' ? 'Movie' : 'Series'
  ].filter(Boolean).join(' · ');

  return (
    <div
      className="panda-content-card"
      onMouseEnter={() => onHover(item)}
      onMouseLeave={onLeave}
    >
      <Link
        href={buildDetailsHref(item, type)}
        className="panda-content-card__link"
        aria-label={`Open ${item.title}`}
        onFocus={() => onHover(item)}
        onBlur={onLeave}
        onClick={() => {
          trackGAEvent('select_content', { content_type: item.type === 'movie' ? 'movie' : 'series', item_id: item.id, section: analyticsSection, title: item.title });
          void trackEvent({ type: 'content_select', animeId: item.id, animeTitle: item.title, metadata: { source: analyticsSection || 'home' } });
        }}
      >
        <div className="panda-content-card__media">
          <PandaPoster item={item} priority={priority} />
          <div className="panda-content-card__top">
            <span className="panda-content-card__badge">{badge || (item.type === 'movie' ? 'Movie' : 'Series')}</span>
          </div>
          <span className="panda-content-card__play" aria-hidden="true"><Play size={17} fill="currentColor" /></span>
        </div>
        <div className="panda-content-card__copy">
          <strong title={item.title}>{item.title}</strong>
          <span>{metadata || 'Panda.fun'}</span>
        </div>
      </Link>
      <button type="button" className={`panda-content-card__quick${inList ? " is-added" : ""}`} onClick={toggleList} aria-label={inList ? `Remove ${item.title} from My List` : `Add ${item.title} to My List`} title={inList ? "Remove from My List" : "Add to My List"}>{inList ? <Check size={15} /> : <Plus size={15} />}</button>
    </div>
  );
}

function PandaRail({
  kind,
  title,
  subtitle,
  items,
  onHover,
  onLeave,
  action = true,
  badge,
  priority = false
}: {
  kind: RailKind;
  title: string;
  subtitle?: string;
  items: MovieApiMedia[];
  onHover: (item: MovieApiMedia) => void;
  onLeave: () => void;
  action?: boolean;
  badge?: string;
  priority?: boolean;
}) {
  if (!items.length) return null;
  return (
    <section className="panda-home-v2__section" aria-labelledby={`panda-${kind}-heading`}>
      <div className="panda-home-v2__section-head">
        <div className="panda-home-v2__section-title">
          <span className="panda-home-v2__eyebrow"><KindIcon kind={kind} /> {kind === 'trending' ? 'Right now' : kind === 'streamingNetflix' || kind === 'streamingDisney' ? 'From TMDB' : kind === 'airing' ? 'On today' : 'Panda picks'}</span>
          <h3 id={`panda-${kind}-heading`}>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action && <Link href="/search" className="panda-home-v2__see-all">Explore <ArrowRight size={13} /></Link>}
      </div>
      <div className="panda-home-v2__rail">
        {items.slice(0, 5).map((item, index) => React.createElement(PandaContentCard, { key: `${kind}-${item.id}-${index}`, item, onHover, onLeave, badge, priority: priority && index < 5, analyticsSection: kind }))}
      </div>
    </section>
  );
}

function HomeContent() {
  const [home, setHome] = useState<any>(null);
  const [newOnNetflix, setNewOnNetflix] = useState<MovieApiMedia[]>([]);
  const [newOnDisneyPlus, setNewOnDisneyPlus] = useState<MovieApiMedia[]>([]);
  const [airing, setAiring] = useState<MovieApiMedia[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [trailer, setTrailer] = useState<any>(null);
  const [isInList, setIsInList] = useState(false);
  // Hero trailers autoplay muted so browser autoplay policies do not block playback.
  const soundEnabled = false;
  const [trailerReady, setTrailerReady] = useState(false);
  const trailerFrameRef = useRef<HTMLIFrameElement | null>(null);
  
  const [hoverTrailer, setHoverTrailer] = useState<MovieApiMedia | null>(null);
  const [hoverTrailerUrl, setHoverTrailerUrl] = useState('');
  const hoverTrailerTimer = useRef<number | null>(null);
  const hoverTrailerRequest = useRef(0);
  const hoverTrailerController = useRef<AbortController | null>(null);
  const trailerCache = useRef(new Map<string, string>());

  useEffect(() => {
    let active = true;
    const featuredTrailerController = new AbortController();

    api.getHome()
      .then(data => {
        if (!active) return;
        setHome(data);

        if (data?.featured?.id) {
          api.getTrailer(data.featured.id, featuredTrailerController.signal)
            .then(result => {
              if (active) setTrailer(result);
            })
            .catch(() => undefined);
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof MovieApiError ? err.message : 'MovieApi is unavailable right now.');
      });

    const loadSecondaryRails = () => {
      Promise.allSettled([
        api.getNewOnNetflix(),
        api.getNewOnDisneyPlus(),
        api.getAiringToday()
      ]).then(([netflix, disney, today]) => {
        if (!active) return;
        if (netflix.status === 'fulfilled') setNewOnNetflix((netflix.value.results || []) as unknown as MovieApiMedia[]);
        if (disney.status === 'fulfilled') setNewOnDisneyPlus((disney.value.results || []) as unknown as MovieApiMedia[]);
        if (today.status === 'fulfilled') setAiring((today.value.results || []) as unknown as MovieApiMedia[]);
      });
    };
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(loadSecondaryRails, { timeout: 1200 })
      : window.setTimeout(loadSecondaryRails, 350);

    return () => {
      active = false;
      featuredTrailerController.abort();
      if (window.cancelIdleCallback && typeof idle === 'number') window.cancelIdleCallback(idle);
      else window.clearTimeout(idle as number);
    };
  }, []);

  const featured = home?.featured as MovieApiMedia | null | undefined;
  const sections = home?.sections;
  const trending = (sections?.trending || []) as MovieApiMedia[];
  const popularMovies = (sections?.popularMovies || []) as MovieApiMedia[];
  const popularTv = (sections?.popularTv || []) as MovieApiMedia[];
  const featuredType = featured?.type === 'movie' ? 'movie' : 'series';
  const featuredWatchUrl = featured?.id ? buildWatchHref(featured.id, featuredType) : '/search';
  const topTen = useMemo(() => [...trending, ...popularMovies, ...popularTv].filter((item, index, list) => item?.id && list.findIndex(candidate => candidate.id === item.id) === index).slice(0, 10), [trending, popularMovies, popularTv]);

  const toggleFeaturedList = () => {
    if (featured) {
      setIsInList(libraryManager.toggleWatchlist({
        id: featured.id,
        title: featured.title,
        image: featured.poster || ''
      }));
    }
  };

  useEffect(() => {
    setTrailerReady(false);
    if (featured?.id) setIsInList(libraryManager.isInWatchlist(featured.id));
  }, [featured?.id]);

  const showHoverTrailer = (item: MovieApiMedia) => {
    if (hoverTrailerTimer.current) window.clearTimeout(hoverTrailerTimer.current);
    const requestId = ++hoverTrailerRequest.current;
    hoverTrailerController.current?.abort();
    hoverTrailerController.current = new AbortController();
    setHoverTrailer(item);
    const cached = trailerCache.current.get(item.id);
    if (cached) {
      setHoverTrailerUrl(cached);
      return;
    }
    setHoverTrailerUrl('');
    hoverTrailerTimer.current = window.setTimeout(async () => {
      const result = await api.getTrailer(item.id, hoverTrailerController.current?.signal).catch(() => ({ available: false, trailer: null }));
      if (requestId !== hoverTrailerRequest.current) return;
      const embedUrl = result?.trailer?.embedUrl;
      if (embedUrl) {
        const url = trailerSrc(embedUrl, true);
        trailerCache.current.set(item.id, url);
        setHoverTrailerUrl(url);
      }
    }, 650);
  };

  const hideHoverTrailer = () => {
    if (hoverTrailerTimer.current) window.clearTimeout(hoverTrailerTimer.current);
    ++hoverTrailerRequest.current;
    hoverTrailerController.current?.abort();
    hoverTrailerController.current = null;
    hoverTrailerTimer.current = window.setTimeout(() => {
      setHoverTrailer(null);
      setHoverTrailerUrl('');
    }, 180);
  };

  useEffect(() => () => {
    if (hoverTrailerTimer.current) window.clearTimeout(hoverTrailerTimer.current);
    hoverTrailerController.current?.abort();
    hoverTrailerController.current = null;
  }, []);

  return (
    <>
      <main className="kinoma-home">
      <div className="kinoma-home__ambient" aria-hidden="true">
        <span className="kinoma-home__ambient-orb kinoma-home__ambient-orb--one" />
        <span className="kinoma-home__ambient-orb kinoma-home__ambient-orb--two" />
      </div>
      <div className="kinoma-home__inner">
        {/* PRESERVED HERO/TRAILER — intentionally unchanged */}
        <section className="kinoma-home-hero kinoma-home-hero--trailer" aria-labelledby="kinoma-home-title">
          <div className="kinoma-home-hero__trailer-bg" aria-label={featured?.title ? featured.title + ' trailer' : 'Featured trailer'}>
            {featured?.backdrop && <img src={featured.backdrop} alt="" className="kinoma-home-hero__banner-image kinoma-home-hero__banner-image--underlay" loading="eager" fetchPriority="high" decoding="async" />}
            {trailer?.trailer?.embedUrl ? (
              <iframe ref={trailerFrameRef} src={trailerSrc(trailer.trailer.embedUrl, soundEnabled)} title={featured?.title ? featured.title + ' trailer' : 'Featured trailer'} className={`kinoma-home-hero__trailer-video${trailerReady ? ' is-ready' : ''}`} onLoad={() => setTrailerReady(true)} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
            ) : featured?.backdrop ? (
              <img src={featured.backdrop} alt="" className="kinoma-home-hero__banner-image" loading="eager" fetchPriority="high" decoding="async" />
            ) : (
              <div className="kinoma-home-hero__banner-grid" />
            )}
          </div>
          <div className="kinoma-home-hero__copy">
            <span className="kinoma-home-hero__eyebrow"><Sparkles size={14} /> YOUR NEXT WATCH</span>
            <h1 id="kinoma-home-title">{featured?.title || 'Something good is waiting.'}</h1>
            <p>{featured?.overview || error || 'Movies, series and stories worth pressing play for. Discover something, save it, and come back whenever you like.'}</p>
            <div className="kinoma-home-hero__actions">
              <Link href={featuredWatchUrl} className="kinoma-3d-button"><span className="kinoma-3d-button__face"><Play size={16} fill="currentColor" /> Watch Now</span><span className="kinoma-3d-button__depth" aria-hidden="true" /></Link>
              <button type="button" onClick={toggleFeaturedList} aria-pressed={isInList} className={`kinoma-3d-button kinoma-3d-button--secondary${isInList ? ' is-added' : ''}`}><span className="kinoma-3d-button__face">{isInList ? <><span>✓</span> In My List</> : <><Plus size={16} /> Add to My List</>}</span><span className="kinoma-3d-button__depth" aria-hidden="true" /></button>
            </div>
          </div>
        </section>

        <div className="panda-home-v2">
          <div className="panda-home-v2__inner">
            {topTen.length > 0 && (
              <section className="panda-home-top10" aria-labelledby="panda-home-top10-heading">
                <div className="panda-home-top10__head">
                  <h2 id="panda-home-top10-heading" className="panda-home-top10__title">TOP10</h2>
                  <div className="panda-home-top10__today">
                    <span>Content</span>
                    <span>Today</span>
                  </div>
                </div>
                <div className="panda-home-top10__rail">
                  {topTen.map((item, index) => (
                    <div className="panda-home-top10__rank" key={item.id}>
                      <div className="panda-home-top10__rank-row">
                        <div className="panda-home-top10__number-wrap" aria-hidden="true">
                          <span className="panda-home-top10__number">{index + 1}</span>
                        </div>
                        <div className="panda-home-top10__card">
                          <Link
                            href={buildDetailsHref(item.title, item.type === 'movie' ? 'movie' : 'series', item.id)}
                            className="panda-home-top10__link"
                            aria-label={"Open " + item.title + ", Top 10 rank " + (index + 1)}
                            onClick={() => {
                              trackGAEvent('home_top10_select', { rank: index + 1, item_id: item.id, title: item.title });
                              void trackEvent({ type: 'content_select', animeId: item.id, animeTitle: item.title, metadata: { source: 'home_top10', rank: index + 1 } });
                            }}
                          >
                            {item.poster || item.backdrop ? (
                              <div className="panda-home-top10__poster-wrap">
                                <img
                                  className="panda-home-top10__poster"
                                  src={(optimizeImageUrl((item.poster || item.backdrop) as string, 'w342') || (item.poster || item.backdrop)) as string}
                                  alt=""
                                  loading={index < 3 ? 'eager' : 'lazy'}
                                  fetchPriority={index < 3 ? 'high' : 'auto'}
                                  decoding="async"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            ) : <div className="panda-home-top10__poster" aria-hidden="true" />}
                          </Link>
                          <div className="panda-home-top10__meta">
                            <p>{item.title}</p>
                            <div>
                              {item.rating ? <span className="panda-home-top10__rating">★</span> : null}
                              {item.rating ? <span>{Number(item.rating).toFixed(1)}</span> : null}
                              {item.year ? <><span className="panda-home-top10__dot">·</span><span>{item.year}</span></> : null}
                              <span className="panda-home-top10__dot">·</span>
                              <span>{item.type === 'movie' ? 'Movie' : 'Series'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <PandaRail priority kind="trending" title="Trending now" subtitle="The titles getting attention today." items={trending} onHover={showHoverTrailer} onLeave={hideHoverTrailer} />
            <PandaRail kind="streamingNetflix" title="New on Netflix" subtitle="Freshly released movies now showing on the service." items={newOnNetflix} onHover={showHoverTrailer} onLeave={hideHoverTrailer} badge="NETFLIX" />
            <PandaRail kind="streamingDisney" title="New on Disney+" subtitle="Recently added titles surfaced from TMDB." items={newOnDisneyPlus} onHover={showHoverTrailer} onLeave={hideHoverTrailer} badge="DISNEY+" />
            <PandaRail kind="movie" title="Popular movies" items={popularMovies} onHover={showHoverTrailer} onLeave={hideHoverTrailer} />
            <PandaRail kind="tv" title="Popular TV shows" items={popularTv} onHover={showHoverTrailer} onLeave={hideHoverTrailer} />
            <PandaRail kind="airing" title="Airing today" subtitle="What's moving through today's schedule." items={airing} onHover={showHoverTrailer} onLeave={hideHoverTrailer} />

            <section className="panda-home-v2__section panda-home-v2__section--compact" aria-label="Browse">
              <div className="panda-home-v2__section-head">
                <div className="panda-home-v2__section-title">
                  <span className="panda-home-v2__eyebrow"><Tv size={14} /> Browse your way</span>
                  <h3>Pick a mood, not a menu.</h3>
                </div>
                <Link href="/search" className="panda-home-v2__see-all">Open Search <ArrowRight size={13} /></Link>
              </div>
              <div className="panda-home-v2__featured-grid">
                <article className="panda-discovery-panel panda-discovery-panel--large">
                  {popularTv[0]?.backdrop && <img className="panda-discovery-panel__image" src={popularTv[0].backdrop as string} alt="" loading="lazy" />}
                  <div className="panda-discovery-panel__content">
                    <span className="panda-home-v2__eyebrow"><Tv size={13} /> TV nights</span>
                    <h3>Settle into a series.</h3>
                    <p>Open Search, filter for series and find something with enough episodes to keep the night going.</p>
                    <Link href="/search?keyword=series" className="panda-discovery-panel__button">Browse TV <ArrowRight size={13} /></Link>
                  </div>
                </article>
                <article className="panda-discovery-panel">
                  {popularMovies[0]?.backdrop && <img className="panda-discovery-panel__image" src={popularMovies[0].backdrop as string} alt="" loading="lazy" />}
                  <div className="panda-discovery-panel__content">
                    <span className="panda-home-v2__eyebrow"><Film size={13} /> Movie break</span>
                    <h3>One story. One sitting.</h3>
                    <p>Jump into movies when you want something complete.</p>
                    <Link href="/search?keyword=movie" className="panda-discovery-panel__button">Browse movies <ArrowRight size={13} /></Link>
                  </div>
                </article>
              </div>
            </section>

            {hoverTrailer && (
              <div
                className="panda-home-hover-trailer"
                onMouseEnter={() => { if (hoverTrailerTimer.current) window.clearTimeout(hoverTrailerTimer.current); }}
                onMouseLeave={hideHoverTrailer}
                role="dialog"
                aria-label={hoverTrailer.title + ' trailer preview'}
              >
                <div className="panda-home-hover-trailer__media">
                  {hoverTrailerUrl ? <iframe src={hoverTrailerUrl} title={hoverTrailer.title + ' trailer preview'} loading="lazy" allow="autoplay; encrypted-media; picture-in-picture" /> : <img src={(hoverTrailer.backdrop || hoverTrailer.poster || '') as string} alt="" />}
                </div>
                <div className="panda-home-hover-trailer__copy">
                  <span>🐼 QUICK LOOK</span>
                  <strong>{hoverTrailer.title}</strong>
                  <small>{[hoverTrailer.year, hoverTrailer.rating ? `★ ${hoverTrailer.rating}` : null, ...(hoverTrailer.genres || []).slice(0, 2)].filter(Boolean).join(' • ')}</small>
                  <em>Click the card to open details</em>
                </div>
              </div>
            )}

            <Footer />
          </div>
        </div>
      </div>
    </main>
    </>
  );
}

export function Home() {
  const [profileReady, setProfileReady] = useState(false);
  const handleProfileReady = React.useCallback(() => setProfileReady(true), []);
  const handleProfileBlock = React.useCallback(() => setProfileReady(false), []);

  return (
    <>
      <HomeProfileGate onReady={handleProfileReady} onBlock={handleProfileBlock} />
      {profileReady && <HomeContent />}
    </>
  );
}
