import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { KinomaLogo } from '../components/ui/KinomaLogo';
import { ArrowRight, Check, Film, Github, Play, Plus, Search, Sparkles, Tv } from 'lucide-react';
import { api, MovieApiError, MovieApiMedia } from '../lib/api';
import { libraryManager } from '../lib/library';
import { updateSEO } from '../lib/seo';
import { ModernContinueWatching } from '../components/ui/modern/ModernContinueWatching';
import '../styles/panda-home.css';

type RailKind = 'trending' | 'streamingNetflix' | 'streamingDisney' | 'popular' | 'tv' | 'movie' | 'airing';

function KindIcon({ kind }: { kind: RailKind }) {
  if (kind === 'movie') return <Film size={14} strokeWidth={1.9} />;
  if (kind === 'trending' || kind === 'streamingNetflix' || kind === 'streamingDisney') return <Sparkles size={14} strokeWidth={1.9} />;
  if (kind === 'airing' || kind === 'tv') return <Tv size={14} strokeWidth={1.9} />;
  return <Sparkles size={14} strokeWidth={1.9} />;
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

function PandaPoster({ item }: { item: MovieApiMedia }) {
  const candidates = [item.poster, item.backdrop].filter((value): value is string => typeof value === 'string' && value.length > 0);
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
        alt=""
        loading="lazy"
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
  badge
}: {
  item: MovieApiMedia;
  onHover: (item: MovieApiMedia) => void;
  onLeave: () => void;
  badge?: string;
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
    <Link
      href={`/details/${slugifyTitle(item.title)}?type=${type}`}
      className="panda-content-card"
      aria-label={`Open ${item.title}`}
      onMouseEnter={() => onHover(item)}
      onMouseLeave={onLeave}
      onFocus={() => onHover(item)}
      onBlur={onLeave}
    >
      <div className="panda-content-card__media">
        <PandaPoster item={item} />
        <div className="panda-content-card__top">
          <span className="panda-content-card__badge">{badge || (item.type === 'movie' ? 'Movie' : 'Series')}</span>
          <button type="button" className={`panda-content-card__quick${inList ? " is-added" : ""}`} onClick={toggleList} aria-label={inList ? `Remove ${item.title} from My List` : `Add ${item.title} to My List`} title={inList ? "Remove from My List" : "Add to My List"}>{inList ? <Check size={15} /> : <Plus size={15} />}</button>
        </div>
        <span className="panda-content-card__play" aria-hidden="true"><Play size={17} fill="currentColor" /></span>
      </div>
      <div className="panda-content-card__copy">
        <strong title={item.title}>{item.title}</strong>
        <span>{metadata || 'Panda.fun'}</span>
      </div>
    </Link>
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
  badge
}: {
  kind: RailKind;
  title: string;
  subtitle?: string;
  items: MovieApiMedia[];
  onHover: (item: MovieApiMedia) => void;
  onLeave: () => void;
  action?: boolean;
  badge?: string;
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
        {items.slice(0, 5).map((item, index) => React.createElement(PandaContentCard, { key: `${kind}-${item.id}-${index}`, item, onHover, onLeave, badge }))}
      </div>
    </section>
  );
}

export function Home() {
  const [home, setHome] = useState<any>(null);
  const [newOnNetflix, setNewOnNetflix] = useState<MovieApiMedia[]>([]);
  const [newOnDisneyPlus, setNewOnDisneyPlus] = useState<MovieApiMedia[]>([]);
  const [airing, setAiring] = useState<MovieApiMedia[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [trailer, setTrailer] = useState<any>(null);
  const [isInList, setIsInList] = useState(false);
  const soundEnabled = true;
  const [trailerReady, setTrailerReady] = useState(false);
  const trailerFrameRef = useRef<HTMLIFrameElement | null>(null);
  const pandaSecretBuffer = useRef('');
  const pandaSecretTimer = useRef<number | null>(null);
  const pandaTapCount = useRef(0);
  const [pandaSecret, setPandaSecret] = useState<string | null>(null);
  const [hoverTrailer, setHoverTrailer] = useState<MovieApiMedia | null>(null);
  const [hoverTrailerUrl, setHoverTrailerUrl] = useState('');
  const hoverTrailerTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    api.getHome()
      .then(async data => {
        if (!active) return;
        setHome(data);
        if (data?.featured?.id) {
          const [trailerResult] = await Promise.allSettled([
            api.getTrailer(data.featured.id)
          ]);
          if (!active) return;
          if (trailerResult.status === 'fulfilled') setTrailer(trailerResult.value);
         }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof MovieApiError ? err.message : 'MovieApi is unavailable right now.');
      });

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

    return () => { active = false; };
  }, []);

  const featured = home?.featured as MovieApiMedia | null | undefined;
  const sections = home?.sections;
  const trending = (sections?.trending || []) as MovieApiMedia[];
  const popularMovies = (sections?.popularMovies || []) as MovieApiMedia[];
  const popularTv = (sections?.popularTv || []) as MovieApiMedia[];
  const featuredType = featured?.type === 'movie' ? 'movie' : 'series';
  const featuredWatchUrl = featured?.id ? '/watch/' + encodeURIComponent(featured.id) + '?type=' + featuredType : '/search';

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.length !== 1) return;
      pandaSecretBuffer.current = (pandaSecretBuffer.current + event.key.toLowerCase()).slice(-12);
      if (pandaSecretBuffer.current.endsWith('panda')) {
        setPandaSecret('🐼 You found the sleepy panda den.');
        pandaSecretBuffer.current = '';
        if (pandaSecretTimer.current) window.clearTimeout(pandaSecretTimer.current);
        pandaSecretTimer.current = window.setTimeout(() => setPandaSecret(null), 3600);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (pandaSecretTimer.current) window.clearTimeout(pandaSecretTimer.current);
    };
  }, []);

  const showHoverTrailer = (item: MovieApiMedia) => {
    if (hoverTrailerTimer.current) window.clearTimeout(hoverTrailerTimer.current);
    setHoverTrailer(item);
    setHoverTrailerUrl('');
    hoverTrailerTimer.current = window.setTimeout(async () => {
      const result = await api.getTrailer(item.id).catch(() => ({ available: false, trailer: null }));
      if (result?.trailer?.embedUrl) setHoverTrailerUrl(trailerSrc(result.trailer.embedUrl, true));
    }, 650);
  };

  const hideHoverTrailer = () => {
    if (hoverTrailerTimer.current) window.clearTimeout(hoverTrailerTimer.current);
    hoverTrailerTimer.current = window.setTimeout(() => {
      setHoverTrailer(null);
      setHoverTrailerUrl('');
    }, 180);
  };

  useEffect(() => () => {
    if (hoverTrailerTimer.current) window.clearTimeout(hoverTrailerTimer.current);
  }, []);

  const wakePanda = () => {
    pandaTapCount.current += 1;
    if (pandaTapCount.current >= 3) {
      setPandaSecret('🌿 The panda noticed you. Keep browsing.');
      pandaTapCount.current = 0;
      if (pandaSecretTimer.current) window.clearTimeout(pandaSecretTimer.current);
      pandaSecretTimer.current = window.setTimeout(() => setPandaSecret(null), 3600);
    }
  };

  return (
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
            <div className="kinoma-home-hero__trailer-shade" />
          </div>
          <div className="kinoma-home-hero__copy">
            <button type="button" className="kinoma-home-hero__eyebrow panda-secret-trigger" onClick={wakePanda}><Sparkles size={14} /> YOUR NEXT WATCH</button>
            <h1 id="kinoma-home-title">{featured?.title || 'Something good is waiting.'}</h1>
            <p>{featured?.overview || error || 'Movies, series and stories worth pressing play for. Discover something, save it, and come back whenever you like.'}</p>
            <div className="kinoma-home-hero__actions">
              <Link href={featuredWatchUrl} className="kinoma-3d-button"><span className="kinoma-3d-button__face"><Play size={16} fill="currentColor" /> Watch Now</span><span className="kinoma-3d-button__depth" aria-hidden="true" /></Link>
              <button type="button" onClick={toggleFeaturedList} className={`kinoma-3d-button kinoma-3d-button--secondary${isInList ? ' is-added' : ''}`}><span className="kinoma-3d-button__face">{isInList ? <><span>✓</span> In My List</> : <><Plus size={16} /> Add to My List</>}</span><span className="kinoma-3d-button__depth" aria-hidden="true" /></button>
            </div>
          </div>
        </section>

        <div className="panda-home-v2">
          <div className="panda-home-v2__inner">
            <ModernContinueWatching />

            <PandaRail kind="trending" title="Trending now" subtitle="The titles getting attention today." items={trending} onHover={showHoverTrailer} onLeave={hideHoverTrailer} />
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
                  {hoverTrailerUrl ? <iframe src={hoverTrailerUrl} title={hoverTrailer.title + ' trailer preview'} allow="autoplay; encrypted-media; picture-in-picture" /> : <img src={(hoverTrailer.backdrop || hoverTrailer.poster || '') as string} alt="" />}
                </div>
                <div className="panda-home-hover-trailer__copy">
                  <span>🐼 QUICK LOOK</span>
                  <strong>{hoverTrailer.title}</strong>
                  <small>{[hoverTrailer.year, hoverTrailer.rating ? `★ ${hoverTrailer.rating}` : null, ...(hoverTrailer.genres || []).slice(0, 2)].filter(Boolean).join(' • ')}</small>
                  <em>Click the card to open details</em>
                </div>
              </div>
            )}

            <footer className="kinoma-home-footer">
              <div className="kinoma-home-footer__art" aria-hidden="true">
                <div className="kinoma-home-footer__halo" />
                <div className="kinoma-home-footer__orbit kinoma-home-footer__orbit--one" />
                <div className="kinoma-home-footer__orbit kinoma-home-footer__orbit--two" />
                <div className="kinoma-home-footer__orbit kinoma-home-footer__orbit--three" />
                <div className="kinoma-home-footer__core">
                  <span className="kinoma-home-footer__core-glow" />
                  <button type="button" className="kinoma-home-footer__panda-button" onClick={wakePanda} aria-label="Wake the Panda">
                    <KinomaLogo size="md" variant="mark" className="kinoma-home-footer__mark" />
                  </button>
                </div>
              </div>
              <div className="kinoma-home-footer__content">
                <div className="kinoma-home-footer__brand">
                  <div className="kinoma-home-footer__logo" aria-label="Panda.fun"><KinomaLogo size="lg" variant="full" /></div>
                  <p>Stories, shelves and little moments worth pressing play for.</p>
                </div>
                <div className="kinoma-home-footer__links">
                  <div className="kinoma-home-footer__promo" aria-label="Panda.fun partners">
                    <a href="https://trafficpeak.io" target="_blank" rel="noopener noreferrer" aria-label="TrafficPeak website" className="kinoma-home-footer__trafficpeak">Boost Your Website Traffic with TrafficPeak</a>
                    <Link href="/" aria-label="Panda.fun" className="kinoma-home-footer__panda-brand"><KinomaLogo size="sm" variant="mark" /><span className="sr-only">Panda.fun</span></Link>
                  </div>
                  <div><span>Explore</span><Link href="/home">Home</Link><Link href="/search">Search</Link><Link href="/library">My List</Link></div>
                  <div><span>Panda.fun</span><Link href="/profile">Profile</Link><Link href="/about">About</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></div>
                  <div><span>Project</span><a href="https://github.com/titan717/Panda.fun" target="_blank" rel="noreferrer"><Github size={15} /> Source</a><Link href="/contact">Support</Link></div>
                </div>
              </div>
              <div className="kinoma-home-footer__bottom"><span>© 2026 Panda.fun</span><span>Built for the next watch.</span><Link href="/contact">Contact / Support</Link></div>
            </footer>
          </div>
        </div>
      </div>
      {pandaSecret && <div className="panda-easter-egg" role="status" aria-live="polite">{pandaSecret}</div>}
    </main>
  );
}
