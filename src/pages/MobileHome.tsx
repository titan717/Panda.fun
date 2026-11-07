import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Play, Plus, Check, Info, ArrowRight } from 'lucide-react';
import { MovieApiMedia } from '../lib/api';
import { buildDetailsHref, buildWatchHref } from '../lib/mediaRoute';
import { libraryManager } from '../lib/library';
import { optimizeImageUrl } from '../lib/mediaImages';
import { ModernContinueWatching } from '../components/ui/modern/ModernContinueWatching';
import { HeroBanner, MediaCard, Rail, Chip } from '../components/blueprint';
import './mobile-home.css';

/**
 * Blueprint mobile Home.
 *
 * Data contract is intentionally unchanged: Home.tsx supplies real MovieApi
 * results, while this component owns only the blueprint presentation layer.
 */

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

function imageFor(item: MovieApiMedia, width: 'w342' | 'w500' | 'w1280' = 'w500') {
  const source = item.poster || item.backdrop;
  return source ? optimizeImageUrl(source, width) || source : '';
}

function uniqueItems(items: MovieApiMedia[]) {
  return items.filter((item, index, all) => Boolean(item?.id) && all.findIndex(other => other?.id === item.id) === index);
}

function categoryFor(item: MovieApiMedia) {
  return item.type === 'movie' ? 'movie' : 'series';
}

function RailCards({ items, limit = 12 }: { items: MovieApiMedia[]; limit?: number }) {
  const visible = uniqueItems(items).slice(0, limit);
  if (!visible.length) return null;

  return (
    <>
      {visible.map(item => (
        <MediaCard
          key={item.id}
          title={item.title}
          image={imageFor(item)}
          subtitle={[item.year, item.rating ? `★ ${Number(item.rating).toFixed(1)}` : null].filter(Boolean).join(' · ') || undefined}
          onClick={() => {
            window.location.assign(buildDetailsHref(item, categoryFor(item)));
          }}
        />
      ))}
    </>
  );
}

function TopTenRail({ items }: { items: MovieApiMedia[] }) {
  const visible = uniqueItems(items).slice(0, 10);
  if (!visible.length) return null;

  return (
    <Rail title="Top 10 in India Today">
      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visible.map((item, index) => (
          <Link
            key={item.id}
            href={buildDetailsHref(item, categoryFor(item))}
            className="bp-focusable group relative flex w-[190px] shrink-0 items-end"
            aria-label={`Open ${item.title}, rank ${index + 1}`}
          >
            <span
              className="absolute -left-1 bottom-0 z-10 text-[64px] font-black leading-none text-transparent"
              style={{ WebkitTextStroke: '2px rgba(255,255,255,0.45)' }}
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <div className="bp-card ml-8 w-full">
              <div className="aspect-[2/3] w-full bg-[var(--bp-surface-hover)]">
                {imageFor(item) ? (
                  <img src={imageFor(item)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : null}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </Rail>
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
  const touchStartX = useRef<number | null>(null);

  const featuredItems = useMemo(
    () => uniqueItems(items).filter(item => item.poster || item.backdrop).slice(0, 5),
    [items]
  );
  const trending = uniqueItems(trendingItems?.length ? trendingItems : items);
  const topTen = uniqueItems([...trending, ...popularMovies, ...popularTv]).slice(0, 10);
  const featured = featuredItems[activeIndex] || featuredItems[0];

  useEffect(() => {
    setActiveIndex(current => Math.min(current, Math.max(0, featuredItems.length - 1)));
  }, [featuredItems.length]);

  useEffect(() => {
    setIsInList(featured ? libraryManager.isInWatchlist(featured.id) : false);
  }, [featured?.id]);

  useEffect(() => {
    if (featuredItems.length < 2) return;
    const timer = window.setTimeout(() => {
      setActiveIndex(index => (index + 1) % featuredItems.length);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [activeIndex, featuredItems.length]);

  const toggleFeaturedList = () => {
    if (!featured) return;
    setIsInList(
      libraryManager.toggleWatchlist({
        id: featured.id,
        title: featured.title,
        image: featured.poster || featured.backdrop || '',
      })
    );
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const start = touchStartX.current;
    const end = event.changedTouches[0]?.clientX;
    touchStartX.current = null;
    if (start == null || end == null || featuredItems.length < 2) return;
    const distance = end - start;
    if (Math.abs(distance) < 48) return;
    setActiveIndex(index => (index + (distance < 0 ? 1 : -1) + featuredItems.length) % featuredItems.length);
  };

  return (
    <div className="bp-screen">
      <div className="bp-page pt-3">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Chip selected>Home</Chip>
            <Chip onClick={() => window.location.assign('/search?type=series')}>TV</Chip>
            <Chip onClick={() => window.location.assign('/search?type=movie')}>Movies</Chip>
            <Chip>Sports</Chip>
          </div>
          <Link
            href="/settings"
            className="bp-focusable rounded-full border border-[var(--bp-border-strong)] bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white"
          >
            Upgrade
          </Link>
        </div>

        {featured ? (
          <HeroBanner
            title={featured.title}
            image={featured.backdrop || featured.poster || undefined}
            metadata={[
              featured.year,
              featured.rating ? `★ ${Number(featured.rating).toFixed(1)}` : null,
              featured.type === 'movie' ? 'Movie' : 'Series',
            ].filter(Boolean).join(' · ')}
            synopsis={featured.overview || undefined}
            onWatch={() => window.location.assign(buildWatchHref(featured.id, categoryFor(featured)))}
            onAdd={toggleFeaturedList}
          />
        ) : (
          <div className="rounded-[var(--bp-radius-lg)] bg-[var(--bp-surface)] p-6 text-center">
            <p className="text-lg font-semibold">{error ? 'We couldn’t load your picks.' : loading ? 'Finding your next watch…' : 'Your next watch is waiting.'}</p>
            <p className="mt-2 text-sm text-[var(--bp-text-secondary)]">
              {error || 'Explore movies and series from the catalogue.'}
            </p>
            <Link href="/search" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--bp-accent)]">
              Explore titles <ArrowRight size={16} />
            </Link>
          </div>
        )}

        {featuredItems.length > 1 ? (
          <div className="mt-3 flex justify-center gap-1.5">
            {featuredItems.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Show ${item.title}`}
                aria-current={index === activeIndex}
                onClick={() => setActiveIndex(index)}
                className={`h-1.5 rounded-full transition-all ${index === activeIndex ? 'w-6 bg-[var(--bp-accent)]' : 'w-1.5 bg-white/30'}`}
              />
            ))
            }
          </div>
        ) : null}
      </div>

      <div className="bp-page">
        <ModernContinueWatching />
        <TopTenRail items={topTen} />
        <Rail title="Trending Now">
          <RailCards items={trending} />
        </Rail>
        <Rail title="New on Panda">
          <RailCards items={newOnNetflix} />
        </Rail>
        <Rail title="Explore Panda">
          <RailCards items={newOnDisneyPlus} />
        </Rail>
        <Rail title="Latest TV Episodes">
          <RailCards items={airing} />
        </Rail>
        <Rail title="Popular Movies">
          <RailCards items={popularMovies} />
        </Rail>
        <Rail title="Popular TV Shows">
          <RailCards items={popularTv} />
        </Rail>
      </div>
    </div>
  );
}

export default MobileHome;
