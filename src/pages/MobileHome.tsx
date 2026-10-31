import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { ThinkingOrb } from 'thinking-orbs';
import { ModernContinueWatching } from '../components/ui/modern/ModernContinueWatching';
import { MovieApiMedia } from '../lib/api';
import { buildDetailsHref } from '../lib/mediaRoute';
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
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
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
    const viewport = viewportRef.current;
    if (viewport && featuredItems.length > 2) {
      const cards = Array.from(viewport.querySelectorAll('.panda-mobile-featured__card')) as HTMLElement[];
      const middle = cards[Math.min(2, cards.length - 1)];
      if (middle) {
        const viewportRect = viewport.getBoundingClientRect();
        const cardRect = middle.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const viewportCenter = viewportRect.left + viewport.clientWidth / 2;
        viewport.scrollLeft += cardCenter - viewportCenter;
      }
    }
    setActiveIndex(Math.min(2, Math.max(0, featuredItems.length - 1)));
  }, [featuredItems.length]);

  const updateActiveCard = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const viewportCenter = viewport.getBoundingClientRect().left + viewport.clientWidth / 2;
    const cards = Array.from(viewport.querySelectorAll('.panda-mobile-featured__card')) as HTMLElement[];
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    cards.forEach((card, index) => {
      const cardCenter = card.getBoundingClientRect().left + card.offsetWidth / 2;
      const distance = Math.abs(cardCenter - viewportCenter);
      if (distance < closestDistance) { closestDistance = distance; closestIndex = index; }
    });
    setActiveIndex(current => current === closestIndex ? current : closestIndex);
  };

  const scrollToFeatured = (index: number) => {
    const viewport = viewportRef.current;
    const card = viewport?.querySelectorAll<HTMLElement>('.panda-mobile-featured__card')[index];
    if (!card) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    card.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
  };

  return (
    <div className="panda-mobile-home">
      <section className="panda-mobile-featured" aria-label="Featured titles">
        <div className="panda-mobile-featured__head">
          <span className="panda-mobile-eyebrow">YOUR NEXT WATCH</span>
        </div>
        {featuredItems.length > 0 ? (
          <div className="panda-mobile-featured__viewport" ref={viewportRef} onScroll={updateActiveCard}>
            <div className="panda-mobile-featured__track">
              {featuredItems.map((item, index) => {
                const image = imageFor(item);
                return (
                  <Link
                    key={item.id}
                    href={buildDetailsHref(item, item.type === 'movie' ? 'movie' : 'series')}
                    className={'panda-mobile-featured__card' + (index === activeIndex ? ' is-initial-center' : '')}
                    aria-label={'Open ' + item.title}
                  >
                    {image ? <img src={image} alt="" loading={index < 3 ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" /> : <span className="panda-mobile-featured__no-art" />}
                    <span className="panda-mobile-featured__caption">{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
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
          <div className="panda-mobile-featured__hint" role="group" aria-label="Choose featured title">
            {featuredItems.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={index === activeIndex ? 'is-active' : ''}
                aria-label={`Show featured title ${index + 1} of ${featuredItems.length}: ${item.title}`}
                aria-current={index === activeIndex ? 'true' : undefined}
                onClick={() => scrollToFeatured(index)}
              />
            ))}
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
