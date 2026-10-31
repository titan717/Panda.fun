import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Play, Plus } from 'lucide-react';
import { ThinkingOrb } from 'thinking-orbs';
import { ModernContinueWatching } from '../components/ui/modern/ModernContinueWatching';
import { MovieApiMedia } from '../lib/api';
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
  loading?: boolean;
  error?: string | null;
};

function imageFor(item: MovieApiMedia) {
  const source = item.poster || item.backdrop;
  return source ? optimizeImageUrl(source, 'w500') || source : '';
}

function uniqueItems(items: MovieApiMedia[]) {
  return items.filter((item, index, all) => Boolean(item?.id) && all.findIndex(other => other?.id === item.id) === index);
}

function MobileRail({ title, items, topTen = false }: { title: string; items: MovieApiMedia[]; topTen?: boolean }) {
  if (!items.length) return null;
  const visible = items.slice(0, topTen ? 10 : 12);

  return (
    <section className={`panda-mobile-home__collection${topTen ? ' panda-mobile-home__collection--top10' : ''}`} aria-label={title}>
      <div className="panda-mobile-home__section-head">
        <h2>{title}</h2>
        <Link href="/search" aria-label={`Explore ${title}`}><ArrowRight size={17} /></Link>
      </div>
      <div className={topTen ? 'panda-mobile-home__top10' : 'panda-mobile-home__trending'}>
        {visible.map((item, index) => {
          const image = imageFor(item);
          const href = buildDetailsHref(item, item.type === 'movie' ? 'movie' : 'series');
          return topTen ? (
            <div className="panda-mobile-home__top10-item" key={item.id}>
              <span className="panda-mobile-home__rank" aria-label={`Rank ${index + 1}`}>{index + 1}</span>
              <Link href={href} className="panda-mobile-home__top10-card" aria-label={`Open ${item.title}, Top 10 rank ${index + 1}`}>
                {image ? <img src={image} alt="" loading={index < 3 ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" /> : <span className="panda-mobile-featured__no-art" />}
              </Link>
            </div>
          ) : (
            <Link key={item.id} href={href} className="panda-mobile-home__trending-card" aria-label={`Open ${item.title}`}>
              {image ? <img src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : <span className="panda-mobile-featured__no-art" />}
            </Link>
          );
        })}
      </div>
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
  loading = false,
  error = null,
}: MobileHomeProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isInList, setIsInList] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'next' | 'previous'>('next');
  const touchStartX = useRef<number | null>(null);
  const featuredItems = useMemo(() => uniqueItems(items).filter(item => item.poster || item.backdrop).slice(0, 5), [items]);
  const catalogue = useMemo(() => uniqueItems([
    ...(trendingItems || []),
    ...popularMovies,
    ...popularTv,
    ...items,
  ]), [trendingItems, popularMovies, popularTv, items]);
  const topTen = catalogue.slice(0, 10);
  const trending = uniqueItems(trendingItems?.length ? trendingItems : items);

  useEffect(() => {
    setActiveIndex(current => Math.min(current, Math.max(0, featuredItems.length - 1)));
  }, [featuredItems.length]);

  const featured = featuredItems[activeIndex] || featuredItems[0];

  useEffect(() => {
    setIsInList(featured ? libraryManager.isInWatchlist(featured.id) : false);
  }, [featured?.id]);

  const toggleFeaturedList = () => {
    if (!featured) return;
    setIsInList(libraryManager.toggleWatchlist({
      id: featured.id,
      title: featured.title,
      image: featured.poster || featured.backdrop || '',
    }));
  };

  const selectFeatured = (index: number) => {
    if (!featuredItems.length) return;
    const nextIndex = (index + featuredItems.length) % featuredItems.length;
    if (nextIndex === activeIndex) return;
    setSwipeDirection(nextIndex > activeIndex || (activeIndex === featuredItems.length - 1 && nextIndex === 0) ? 'next' : 'previous');
    setActiveIndex(nextIndex);
  };

  const handleFeaturedTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  };

  const handleFeaturedTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const startX = touchStartX.current;
    touchStartX.current = null;
    const endX = event.changedTouches[0]?.clientX;
    if (startX == null || endX == null) return;
    const distance = endX - startX;
    if (Math.abs(distance) < 48) return;
    selectFeatured(activeIndex + (distance < 0 ? 1 : -1));
  };

  return (
    <div className="panda-mobile-home">
      <section className="panda-mobile-featured" aria-label="Featured titles">
        <div className="panda-mobile-featured__head">
          <span className="panda-mobile-eyebrow">YOUR NEXT WATCH</span>
        </div>
        {featuredItems.length > 0 && featured ? (
          <article key={featured.id} className={`panda-mobile-featured__spotlight panda-mobile-featured__spotlight-track is-${swipeDirection}`} aria-label={"Featured: " + featured.title} onTouchStart={handleFeaturedTouchStart} onTouchEnd={handleFeaturedTouchEnd} onTouchCancel={() => { touchStartX.current = null; }}>
            <div className="panda-mobile-featured__art" aria-hidden="true">
              {(() => {
                const source = featured.backdrop || featured.poster || '';
                const image = source ? optimizeImageUrl(source, 'w1280') || source : '';
                return image ? <img src={image} alt="" fetchPriority="high" decoding="async" referrerPolicy="no-referrer" /> : <span className="panda-mobile-featured__no-art" />;
              })()}
            </div>
            <div className="panda-mobile-featured__copy" aria-live="polite">
              
              <div className="panda-mobile-featured__meta">
                <span>{featured.type === 'movie' ? 'MOVIE' : 'SERIES'}</span>
                {featured.year && <span>{featured.year}</span>}
                {featured.rating != null && <span>★ {Number(featured.rating).toFixed(1)}</span>}
              </div>
              <h1>{featured.title}</h1>
              {featured.overview && <p>{featured.overview}</p>}
              {!!featured.genres?.length && (
                <div className="panda-mobile-featured__genres">
                  {featured.genres.slice(0, 3).map(genre => <span key={genre}>{genre}</span>)}
                </div>
              )}
              <div className="panda-mobile-featured__actions">
                <Link href={buildWatchHref(featured.id, featured.type === 'movie' ? 'movie' : 'series')} className="panda-mobile-featured__watch" aria-label={"Watch " + featured.title + " now"}>
                  <Play size={16} fill="currentColor" aria-hidden="true" /> Watch now
                </Link>
                <Link href={buildDetailsHref(featured, featured.type === 'movie' ? 'movie' : 'series')} className="panda-mobile-featured__details">View details</Link>
                <button type="button" className="panda-mobile-featured__list" onClick={toggleFeaturedList} aria-pressed={isInList} aria-label={isInList ? "Remove " + featured.title + " from My List" : "Add " + featured.title + " to My List"}>
                  {isInList ? <Check size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}
                </button>
              </div>
            </div>
          </article>
        ) : loading ? (
          <div className="panda-mobile-featured__loading" role="status" aria-live="polite">
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
        {featuredItems.length > 1 && (
          <div className="panda-mobile-featured__controls" role="group" aria-label="Choose featured title">
            <button type="button" className="panda-mobile-featured__step" onClick={() => selectFeatured(activeIndex - 1)} aria-label="Previous featured title"><ChevronLeft size={17} aria-hidden="true" /></button>
            <div className="panda-mobile-featured__hint">
              {featuredItems.map((item, index) => (
                <button key={item.id} type="button" className={index === activeIndex ? 'is-active' : ''} aria-label={"Show featured title " + (index + 1) + " of " + featuredItems.length + ": " + item.title} aria-current={index === activeIndex ? 'true' : undefined} onClick={() => selectFeatured(index)} />
              ))}
            </div>
            <button type="button" className="panda-mobile-featured__step" onClick={() => selectFeatured(activeIndex + 1)} aria-label="Next featured title"><ChevronRight size={17} aria-hidden="true" /></button>
          </div>
        )}
      </section>

      <MobileRail title="Top 10" items={topTen} topTen />
      <ModernContinueWatching />
      <MobileRail title="Trending Now" items={trending} />
      <MobileRail title="New on Netflix" items={uniqueItems(newOnNetflix)} />
      <MobileRail title="New on Disney+" items={uniqueItems(newOnDisneyPlus)} />
      <MobileRail title="Popular Movies" items={uniqueItems(popularMovies)} />
      <MobileRail title="Popular TV Shows" items={uniqueItems(popularTv)} />
      <MobileRail title="Airing Today" items={uniqueItems(airing)} />
    </div>
  );
}
