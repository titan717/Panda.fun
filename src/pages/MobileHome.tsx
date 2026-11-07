import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Play, Plus, Check } from 'lucide-react';
import { MovieApiMedia } from '../lib/api';
import { buildDetailsHref, buildWatchHref } from '../lib/mediaRoute';
import { libraryManager } from '../lib/library';
import { optimizeImageUrl } from '../lib/mediaImages';
import { ModernContinueWatching } from '../components/ui/modern/ModernContinueWatching';
import { HeroBanner, MediaCard, Rail, Chip } from '../components/blueprint';

/**
 * Blueprint mobile Home.
 *
 * Data remains supplied by Home.tsx and the existing MovieApi service; this
 * component only owns the blueprint presentation and interaction behavior.
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

function metadataFor(item: MovieApiMedia) {
  return [
    item.year,
    item.rating ? `IMDb ${Number(item.rating).toFixed(1)}` : null,
    item.type === 'movie' ? 'Movie' : 'Series',
  ].filter(Boolean).join(' · ');
}

function MediaRail({ title, items, badge }: { title: string; items: MovieApiMedia[]; badge?: string }) {
  const visible = uniqueItems(items).slice(0, 18);
  if (!visible.length) return null;

  return (
    <Rail
      title={title}
      action={<Link href="/search" className="text-xs font-semibold text-[var(--bp-accent)]">See all</Link>}
    >
      {visible.map(item => (
        <MediaCard
          key={item.id}
          title={item.title}
          image={imageFor(item)}
          subtitle={metadataFor(item)}
          badge={badge}
          onClick={() => {
            window.location.assign(buildDetailsHref(item, item.type === 'movie' ? 'movie' : 'series'));
          }}
        />
      ))}
    </Rail>
  );
}

function TopTenRail({ items }: { items: MovieApiMedia[] }) {
  const visible = uniqueItems(items).slice(0, 10);
  if (!visible.length) return null;

  return (
    <Rail title="Top 10 in India Today">
      {visible.map((item, index) => (
        <div key={item.id} className="relative flex items-end">
          <span
            className="absolute -left-1 bottom-2 z-10 text-5xl font-black leading-none text-white/90"
            style={{ WebkitTextStroke: '2px black' }}
            aria-hidden="true"
          >
            {index + 1}
          </span>
          <MediaCard
            title={item.title}
            image={imageFor(item, 'w342')}
            subtitle={metadataFor(item)}
            className="ml-8"
            onClick={() => {
              window.location.assign(buildDetailsHref(item, item.type === 'movie' ? 'movie' : 'series'));
            }}
          />
        </div>
      ))}
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
  const [touchPaused, setTouchPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchResumeTimer = useRef<number | null>(null);

  const featuredItems = useMemo(
    () => uniqueItems(items).filter(item => item.poster || item.backdrop).slice(0, 5),
    [items]
  );
  const catalogue = useMemo(
    () => uniqueItems([...(trendingItems || []), ...popularMovies, ...popularTv, ...items]),
    [trendingItems, popularMovies, popularTv, items]
  );
  const topTen = catalogue.slice(0, 10);
  const trending = uniqueItems(trendingItems?.length ? trendingItems : items);
  const featured = featuredItems[activeIndex] || featuredItems[0];

  useEffect(() => {
    setActiveIndex(current => Math.min(current, Math.max(0, featuredItems.length - 1)));
  }, [featuredItems.length]);

  useEffect(() => {
    setIsInList(featured ? libraryManager.isInWatchlist(featured.id) : false);
  }, [featured?.id]);

  useEffect(() => {
    if (touchPaused || featuredItems.length < 2) return;
    const timer = window.setTimeout(() => {
      setActiveIndex(index => (index + 1) % featuredItems.length);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [activeIndex, featuredItems.length, touchPaused]);

  useEffect(() => () => {
    if (touchResumeTimer.current) window.clearTimeout(touchResumeTimer.current);
  }, []);

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
    setActiveIndex((index + featuredItems.length) % featuredItems.length);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
    setTouchPaused(true);
    if (touchResumeTimer.current) window.clearTimeout(touchResumeTimer.current);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const startX = touchStartX.current;
    touchStartX.current = null;
    const endX = event.changedTouches[0]?.clientX;
    if (startX == null || endX == null) return;
    const distance = endX - startX;
    if (Math.abs(distance) >= 48) {
      selectFeatured(activeIndex + (distance < 0 ? 1 : -1));
    }
    touchResumeTimer.current = window.setTimeout(() => setTouchPaused(false), 1800);
  };

  return (
    <div className="bp-screen">
      <div className="bp-page pt-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-black tracking-tight text-white">Panda<span className="text-[var(--bp-accent)]">.fun</span></Link>
          <Link
            href="/settings"
            className="bp-focusable rounded-full border border-[var(--bp-border-strong)] bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white"
          >
            Upgrade
          </Link>
        </div>

        <div className="mt-4">
          {featured ? (
            <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onTouchCancel={() => setTouchPaused(false)}>
              <HeroBanner
                title={featured.title}
                image={featured.backdrop || featured.poster || undefined}
                metadata={metadataFor(featured)}
                synopsis={featured.overview || undefined}
                onWatch={() => {
                  window.location.assign(buildWatchHref(featured.id, featured.type === 'movie' ? 'movie' : 'series'));
                }}
                onAdd={toggleFeaturedList}
              />
              <div className="mt-3 flex items-center justify-between">
                <div className="flex gap-1.5">
                  {featuredItems.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-label={`Show ${item.title}`}
                      aria-current={index === activeIndex}
                      onClick={() => selectFeatured(index)}
                      className={`h-1.5 rounded-full transition-all ${index === activeIndex ? 'w-6 bg-[var(--bp-accent)]' : 'w-1.5 bg-white/30'}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={toggleFeaturedList}
                  aria-pressed={isInList}
                  className="bp-focusable inline-flex items-center gap-1.5 rounded-full border border-[var(--bp-border-strong)] bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {isInList ? <Check size={14} /> : <Plus size={14} />}
                  {isInList ? 'Added' : 'Watchlist'}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-[var(--bp-radius-lg)] bg-[var(--bp-surface)] p-6 text-center" role="status">
              <strong className="block text-lg font-bold text-white">
                {error ? 'We couldn’t load your picks.' : loading ? 'Finding your next watch' : 'Your next watch is waiting.'}
              </strong>
              <p className="mt-2 text-sm text-[var(--bp-text-secondary)]">
                {error || 'Explore the catalogue to find something worth watching.'}
              </p>
              <Link href="/search" className="mt-4 inline-block rounded-full bg-[var(--bp-accent)] px-4 py-2 text-sm font-semibold text-white">
                Explore titles
              </Link>
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          <Chip selected>Home</Chip>
          <Chip onClick={() => { window.location.assign('/search?type=series'); }}>TV</Chip>
          <Chip onClick={() => { window.location.assign('/search?type=movie'); }}>Movies</Chip>
          <Chip onClick={() => { window.location.assign('/search'); }}>Sports</Chip>
        </div>

        <TopTenRail items={topTen} />
        <ModernContinueWatching />
        <MediaRail title="Trending Now" items={trending} />
        <MediaRail title="New on Panda" items={newOnNetflix} badge="NEW" />
        <MediaRail title="Explore Panda" items={newOnDisneyPlus} badge="NEWLY ADDED" />
        <MediaRail title="Latest TV Episodes" items={airing} badge="NEW EPISODE" />
        <MediaRail title="Popular Movies" items={popularMovies} />
        <MediaRail title="Popular TV Shows" items={popularTv} />
      </div>
    </div>
  );
}

export default MobileHome;
