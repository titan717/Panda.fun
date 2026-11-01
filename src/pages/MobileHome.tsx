import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Info, Play, Plus } from 'lucide-react';
import { AnimatedCheck, Pressable, Reveal, Shimmer, useMotionPreference } from '../motion';
import { ThinkingOrb } from 'thinking-orbs';
import { ModernContinueWatching } from '../components/ui/modern/ModernContinueWatching';
import { api, MovieApiMedia } from '../lib/api';
import { buildDetailsHref, buildWatchHref } from '../lib/mediaRoute';
import { libraryManager } from '../lib/library';
import { optimizeImageUrl } from '../lib/mediaImages';
import './mobile-home.css';
import './mobile-featured-controls.css';

type MobileHomeProps = {
  items: MovieApiMedia[];
  trendingItems?: MovieApiMedia[];
  popularMovies?: MovieApiMedia[];
  popularTv?: MovieApiMedia[];
  newOnNetflix?: MovieApiMedia[];
  newOnDisneyPlus?: MovieApiMedia[];
  airing?: MovieApiMedia[];
  comingSoon?: MovieApiMedia[];
  becauseWatched?: MovieApiMedia[];
  lastWatchedTitle?: string;
  loading?: boolean;
  error?: string | null;
};

function imageFor(item: MovieApiMedia) {
  const source = item.poster || item.backdrop;
  return source ? optimizeImageUrl(source, 'w500') || source : '';
}

function uniqueItems(items: MovieApiMedia[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    if (!item?.id) return false;
    const titleKey = (item.title || '').trim().toLocaleLowerCase() + ':' + item.type;
    if (seen.has(titleKey)) return false;
    seen.add(titleKey);
    return true;
  });
}

function MobileRail({ title, items, topTen = false, wide = false, genre, loading = false }: { title: string; items: MovieApiMedia[]; topTen?: boolean; wide?: boolean; genre?: string; loading?: boolean }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [nearViewport, setNearViewport] = useState(false);
  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') { setNearViewport(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setNearViewport(true); observer.disconnect(); }
    }, { rootMargin: '420px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  if (!items.length && !loading) return null;
  if (!items.length && loading) {
    return (
      <section className="panda-mobile-home__collection" aria-label={title} aria-busy="true">
        <div className="panda-mobile-home__section-head"><h2>{title}</h2></div>
        <div className={wide ? "panda-mobile-home__rail-skeleton is-wide" : "panda-mobile-home__rail-skeleton"} aria-hidden="true"><span /><span /><span /><span /></div>
      </section>
    );
  }
  const visible = items.slice(0, topTen ? 10 : 12);
  const railClass = topTen ? 'panda-mobile-home__top10' : wide ? 'panda-mobile-home__trending panda-mobile-home__trending--wide' : 'panda-mobile-home__trending';
  return (
    <section ref={sectionRef} className={topTen ? 'panda-mobile-home__collection panda-mobile-home__collection--top10' : 'panda-mobile-home__collection'} aria-label={title}>
      <div className="panda-mobile-home__section-head">
        <h2>{title}</h2>
        <Link href={genre ? '/search?genre=' + encodeURIComponent(genre) : '/search'} aria-label={'Explore ' + title}><ArrowRight size={17} /></Link>
      </div>
      {!nearViewport ? (
        <div className={wide ? "panda-mobile-home__rail-skeleton is-wide" : "panda-mobile-home__rail-skeleton"} aria-hidden="true"><span /><span /><span /><span /></div>
      ) : (
        <div className={railClass}>
          {visible.map((item, index) => {
            const image = imageFor(item);
            const href = buildDetailsHref(item, item.type === 'movie' ? 'movie' : 'series');
            return topTen ? (
              <div className="panda-mobile-home__top10-item" key={item.id}>
                <span className="panda-mobile-home__rank" aria-label={'Rank ' + (index + 1)}>{index + 1}</span>
                <Link href={href} className="panda-mobile-home__top10-card" aria-label={'Open ' + item.title + ', Top 10 rank ' + (index + 1)}>
                  {image ? <img src={image} alt="" loading={index < 3 ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" /> : <span className="panda-mobile-featured__no-art" />}
                </Link>
              </div>
            ) : (
              <Link key={item.id} href={href} className={wide ? 'panda-mobile-home__trending-card is-wide' : 'panda-mobile-home__trending-card'} aria-label={'Open ' + item.title}>
                {image ? <img src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : <span className="panda-mobile-featured__no-art" />}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}


function LazyGenreRail({ title, genre, movieGenre, tvGenre, animeOnly = false }: {
  title: string;
  genre: string;
  movieGenre?: string;
  tvGenre?: string;
  animeOnly?: boolean;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [items, setItems] = useState<MovieApiMedia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') { setNearViewport(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: '480px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!nearViewport) return;
    let active = true;
    const requests = animeOnly
      ? [api.getGenreAnime('animation', 24)]
      : [
          api.getGenreMedia(movieGenre || genre, 'movie', 12),
          api.getGenreMedia(tvGenre || genre, 'tv', 12),
        ];
    Promise.allSettled(requests).then(results => {
      if (!active) return;
      const merged = results.flatMap(result => result.status === 'fulfilled' ? result.value.results : []);
      setItems(uniqueItems(merged));
      setLoading(false);
    });
    return () => { active = false; };
  }, [nearViewport, animeOnly, movieGenre, tvGenre, genre]);

  if (!items.length && !loading) return null;
  if (items.length) return <MobileRail title={title} items={items} genre={genre} />;
  return (
    <section ref={sectionRef} className="panda-mobile-home__collection" aria-label={title}>
      <div className="panda-mobile-home__section-head"><h2>{title}</h2><Link href={'/search?genre=' + encodeURIComponent(genre)} aria-label={'Explore ' + title}><ArrowRight size={17} /></Link></div>
      <div className="panda-mobile-home__rail-skeleton" aria-hidden="true"><span /><span /><span /><span /></div>
    </section>
  );
}

export function MobileHome({
  items,
  trendingItems,
  popularMovies = [],
  popularTv = [],
  newOnNetflix = [],
  newOnDisneyPlus = [],
  airing = [],
  comingSoon = [],
  becauseWatched = [],
  lastWatchedTitle = '',
  loading = false,
  error = null,
}: MobileHomeProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState('All');
  const [isInList, setIsInList] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'next' | 'previous'>('next');
  const [touchPaused, setTouchPaused] = useState(false);
  const [documentHidden, setDocumentHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const motionPreference = useMotionPreference();
  const motionAllowed = motionPreference === 'full';
  const touchStartX = useRef<number | null>(null);
  const suppressSwipeClick = useRef(false);
  const touchResumeTimer = useRef<number | null>(null);
  const filterCategory = (list: MovieApiMedia[]) => {
    if (activeCategory === 'All') return list;
    const category = activeCategory.toLowerCase();
    return list.filter(item => {
      const genres = (item.genres || []).map(genre => genre.toLowerCase());
      if (category === 'movies') return item.type === 'movie';
      if (category === 'tv shows') return item.type === 'tv';
      if (category === 'anime') return genres.some(genre => /anime|animation/.test(genre)) || item.language?.toLowerCase() === 'ja';
      if (category === 'kids') return genres.some(genre => /family|kids|animation/.test(genre));
      if (category === 'sci-fi & fantasy') return genres.some(genre => /science fiction|sci-fi|fantasy/.test(genre));
      if (category === 'action') return genres.some(genre => /action|adventure/.test(genre));
      return genres.some(genre => genre.includes(category));
    });
  };
  const categorizedItems = useMemo(() => filterCategory(items), [items, activeCategory]);
  const featuredItems = useMemo(() => uniqueItems(categorizedItems).filter(item => item.poster || item.backdrop).slice(0, 5), [categorizedItems]);
  const catalogue = useMemo(() => uniqueItems(filterCategory([
    ...(trendingItems || []),
    ...popularMovies,
    ...popularTv,
    ...items,
  ])), [trendingItems, popularMovies, popularTv, items, activeCategory]);
  const topTen = catalogue.slice(0, 10);
  const trending = uniqueItems(filterCategory(trendingItems?.length ? trendingItems : items));
  const myList = libraryManager.getWatchlist().map(item => ({ id: item.id, title: item.title, poster: item.image, type: item.id.toLowerCase().includes('movie') ? 'movie' : 'tv' } as MovieApiMedia));

  useEffect(() => {
    const onCategory = (event: Event) => {
      const category = (event as CustomEvent).detail;
      if (typeof category === 'string') {
        setActiveCategory(category);
        setActiveIndex(0);
      }
    };
    window.addEventListener('panda_home_category_select', onCategory);
    return () => window.removeEventListener('panda_home_category_select', onCategory);
  }, []);

  useEffect(() => {
    setActiveIndex(current => Math.min(current, Math.max(0, featuredItems.length - 1)));
  }, [featuredItems.length]);

  useEffect(() => {
    const updateVisibility = () => setDocumentHidden(document.hidden);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => () => {
    if (touchResumeTimer.current) window.clearTimeout(touchResumeTimer.current);
  }, []);

  const featured = featuredItems[activeIndex] || featuredItems[0];

  useEffect(() => {
    setIsInList(featured ? libraryManager.isInWatchlist(featured.id) : false);
  }, [featured?.id]);

  useEffect(() => {
    if (!motionAllowed || documentHidden || touchPaused || featuredItems.length < 2) return;
    const timer = window.setTimeout(() => {
      setSwipeDirection('next');
      setActiveIndex(index => (index + 1) % featuredItems.length);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [activeIndex, documentHidden, featuredItems.length, motionAllowed, touchPaused]);

  const toggleFeaturedList = () => {
    if (!featured) return;
    setIsInList(libraryManager.toggleWatchlist({
      id: featured.id,
      title: featured.title,
      image: featured.poster || featured.backdrop || '',
    }));
  };

  const selectFeatured = (index: number, direction?: 'next' | 'previous') => {
    if (!featuredItems.length) return;
    const nextIndex = (index + featuredItems.length) % featuredItems.length;
    if (nextIndex === activeIndex) return;
    setSwipeDirection(direction || (nextIndex > activeIndex || (activeIndex === featuredItems.length - 1 && nextIndex === 0) ? 'next' : 'previous'));
    setActiveIndex(nextIndex);
  };

  const handleFeaturedTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
    setTouchPaused(true);
    if (touchResumeTimer.current) window.clearTimeout(touchResumeTimer.current);
  };

  const resumeAfterTouch = () => {
    if (touchResumeTimer.current) window.clearTimeout(touchResumeTimer.current);
    touchResumeTimer.current = window.setTimeout(() => setTouchPaused(false), 1800);
  };

  const handleFeaturedTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const startX = touchStartX.current;
    touchStartX.current = null;
    const endX = event.changedTouches[0]?.clientX;
    if (startX == null || endX == null) {
      resumeAfterTouch();
      return;
    }
    const distance = endX - startX;
    if (Math.abs(distance) >= 48) {
      event.preventDefault();
      suppressSwipeClick.current = true;
      window.setTimeout(() => { suppressSwipeClick.current = false; }, 450);
      selectFeatured(activeIndex + (distance < 0 ? 1 : -1), distance < 0 ? 'next' : 'previous');
    }
    resumeAfterTouch();
  };

  return (
    <div className="panda-mobile-home">
      <section className={`panda-mobile-featured panda-billboard${touchPaused || documentHidden || !motionAllowed ? " is-paused" : ""}`} aria-label="Featured titles">
        {featuredItems.length > 0 && featured ? (
          <>
            <article key={featured.id} className={`panda-mobile-featured__spotlight panda-mobile-featured__spotlight-track is-${swipeDirection}`} aria-label={`Featured: ${featured.title}`} onTouchStart={handleFeaturedTouchStart} onTouchEnd={handleFeaturedTouchEnd} onTouchCancel={() => { touchStartX.current = null; resumeAfterTouch(); }} onClickCapture={event => { if (suppressSwipeClick.current) { event.preventDefault(); event.stopPropagation(); suppressSwipeClick.current = false; } }}>
              <div className="panda-mobile-featured__art" aria-hidden="true">
                {(() => {
                  const source = featured.backdrop || featured.poster || '';
                  const image = source ? optimizeImageUrl(source, 'w1280') || source : '';
                  return image ? <img src={image} alt="" fetchPriority="high" decoding="async" referrerPolicy="no-referrer" /> : <span className="panda-mobile-featured__no-art" />;
                })()}
              </div>
              <div className="panda-mobile-featured__copy" aria-live="polite">
                <Reveal className="panda-mobile-featured__reveal" delay={0}>
                  <div className="panda-mobile-featured__meta">
                    <span className="panda-mobile-featured__type">{featured.type === 'movie' ? 'MOVIE' : 'SERIES'}</span>
                    {featured.year && <span className="panda-mobile-featured__chip">{featured.year}</span>}
                    {featured.rating != null && <span className="panda-mobile-featured__chip">★ {Number(featured.rating).toFixed(1)}</span>}
                  </div>
                </Reveal>
                <Reveal className="panda-mobile-featured__reveal" delay={0.06}><h1>{featured.title}</h1></Reveal>
                {featured.overview && <Reveal className="panda-mobile-featured__reveal" delay={0.12}><p>{featured.overview}</p></Reveal>}
                {!!featured.genres?.length && (
                  <Reveal className="panda-mobile-featured__reveal" delay={0.18}>
                    <div className="panda-mobile-featured__genres" aria-label="Genres">
                      {featured.genres.slice(0, 3).map(genre => <span key={genre}>{genre}</span>)}
                    </div>
                  </Reveal>
                )}
                <Reveal className="panda-mobile-featured__reveal" delay={0.24}>
                  <div className="panda-mobile-featured__actions">
                    <Link href={buildWatchHref(featured.id, featured.type === 'movie' ? 'movie' : 'series')} className="panda-mobile-featured__watch panda-motion-play-cta" aria-label={`Play ${featured.title}`}>
                      <Play size={17} fill="currentColor" aria-hidden="true" /> Play
                    </Link>
                    <Pressable haptic className="panda-mobile-featured__list" onClick={toggleFeaturedList} aria-pressed={isInList} aria-label={isInList ? `Remove ${featured.title} from My List` : `Add ${featured.title} to My List`}>
                      {isInList ? <AnimatedCheck checked size={19} /> : <Plus size={19} aria-hidden="true" />}
                    </Pressable>
                    <Link href={buildDetailsHref(featured, featured.type === 'movie' ? 'movie' : 'series')} className="panda-mobile-featured__info" aria-label={`More information about ${featured.title}`}>
                      <Info size={19} aria-hidden="true" />
                    </Link>
                  </div>
                </Reveal>
              </div>
            </article>
            {featuredItems.length > 1 && (
              <div className="panda-mobile-featured__controls" role="group" aria-label="Featured title progress">
                {featuredItems.map((item, index) => (
                  <button key={item.id} type="button" className={`panda-mobile-featured__segment${index === activeIndex ? ' is-active' : ''}`} aria-label={`Show featured title ${index + 1} of ${featuredItems.length}: ${item.title}`} aria-current={index === activeIndex ? 'true' : undefined} onClick={() => selectFeatured(index)}>
                    <span aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : loading ? (
          <div className="panda-mobile-featured__loading" role="status" aria-live="polite">
            <Shimmer className="panda-mobile-featured__loading-shimmer" />
            <ThinkingOrb state="searching" size={64} theme="dark" aria-label="Loading featured titles" />
            <span className="panda-mobile-featured__loading-copy">Finding your next watch</span>
          </div>
        ) : (
          <div className="panda-mobile-featured__empty" role="status">
            <strong>{error ? 'We couldn’t load your picks.' : 'Your next watch is waiting.'}</strong>
            <span>{error ? 'The catalogue may be taking a break. Try Search while we recover.' : 'Explore the catalogue to find something worth watching.'}</span>
            <Link href="/search">Explore titles <ArrowRight size={15} /></Link>
          </div>
        )}
      </section>

      <MobileRail title="Top 10" items={topTen} topTen  loading={loading} />
      <ModernContinueWatching />
      <MobileRail title="My List" items={uniqueItems(filterCategory(myList))} />
      <MobileRail title="Trending Now" items={trending}  loading={loading} />
      <MobileRail title="New on Netflix" items={uniqueItems(filterCategory(newOnNetflix))}  loading={loading} />
      <MobileRail title="New on Disney+" items={uniqueItems(filterCategory(newOnDisneyPlus))}  loading={loading} />
      <MobileRail title="Popular Movies" items={uniqueItems(filterCategory(popularMovies))}  loading={loading} />
      <MobileRail title="Popular TV Shows" items={uniqueItems(filterCategory(popularTv))}  loading={loading} />
      <MobileRail title="Airing Today" items={uniqueItems(filterCategory(airing))}  loading={loading} />
      <MobileRail title="Coming Soon" items={uniqueItems(filterCategory(comingSoon))} wide  loading={loading} />
      {lastWatchedTitle && <MobileRail title={"Because you watched " + lastWatchedTitle} items={uniqueItems(filterCategory(becauseWatched))} loading={loading} />}
      <LazyGenreRail title="Anime" genre="anime" animeOnly />
      <LazyGenreRail title="Action" genre="Action" movieGenre="Action" tvGenre="Action & Adventure" />
      <LazyGenreRail title="Comedy" genre="Comedy" movieGenre="Comedy" tvGenre="Comedy" />
      <LazyGenreRail title="Drama" genre="Drama" />
      <LazyGenreRail title="Sci-Fi & Fantasy" genre="Sci-Fi & Fantasy" movieGenre="Science Fiction" tvGenre="Sci-Fi & Fantasy" />
      <LazyGenreRail title="Horror" genre="Horror" />
      <LazyGenreRail title="Animation & Family" genre="Animation & Family" movieGenre="Animation" tvGenre="Animation" />
      <LazyGenreRail title="Documentary" genre="Documentary" />
    </div>
  );
}
