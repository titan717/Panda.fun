import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Footer } from '../components/ui/Footer';
import { Bookmark, CheckCircle2, Clock3, Heart, Search, X, Play } from 'lucide-react';
import { buildDetailsHref, buildWatchHref } from '../lib/mediaRoute';
import { ModernCard } from '../components/ui/modern/ModernCard';
import { historyUtil, HistoryItem } from '../lib/history';
import { libraryManager, LibraryItem } from '../lib/library';

type Tab = 'continue' | 'watchlist' | 'favorites' | 'completed';

const FILTERS: { id: Tab; label: string; Icon: typeof Clock3 }[] = [
  { id: 'continue', label: 'Continue', Icon: Clock3 },
  { id: 'watchlist', label: 'Watchlist', Icon: Bookmark },
  { id: 'favorites', label: 'Favourites', Icon: Heart },
  { id: 'completed', label: 'Completed', Icon: CheckCircle2 },
];

const EMPTY_COPY: Record<Tab, [string, string, string]> = {
  continue: ['Nothing to continue', 'Your next episode will be waiting here when you start watching.', 'Explore titles'],
  watchlist: ['Your list is taking shape', 'Save films and series to keep your next watch close.', 'Find something to watch'],
  favorites: ['No favourites yet', 'Add the stories you love and they will live here.', 'Discover favourites'],
  completed: ['Your credits are still rolling', 'Finished titles will collect here as you watch.', 'Browse the catalogue'],
};

function EmptyState({ tab, onBrowse }: { tab: Tab; onBrowse: () => void }) {
  const [title, description, action] = EMPTY_COPY[tab];
  return (
    <div className="kinoma-library-empty panda-library__empty">
      <div className="kinoma-library-empty__icon" aria-hidden="true">
        {tab === 'watchlist' ? <Bookmark size={21} /> : tab === 'favorites' ? <Heart size={21} /> : tab === 'completed' ? <CheckCircle2 size={21} /> : <Play size={21} />}
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      <button type="button" onClick={onBrowse}>{action}</button>
    </div>
  );
}

function LibraryPosterCard({ item, onRemove }: { key?: React.Key; item: LibraryItem; onRemove: () => void }) {
  const mediaType = item.id.startsWith('tmdb_movie_') ? 'movie' : 'series';
  return (
    <ModernCard
      item={{ id: item.id, title: item.title, image: item.image, type: mediaType }}
      subText={item.type === 'watchlist' ? 'My List' : item.type === 'favorites' ? 'Favourite' : 'Completed'}
      href={buildDetailsHref(item.title, mediaType, item.id)}
      onRemove={onRemove}
    />
  );
}

export function Library() {
  const [active, setActive] = useState<Tab | null>(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>(() => historyUtil.getHistory());
  const [watchlist, setWatchlist] = useState<LibraryItem[]>(() => libraryManager.getWatchlist());
  const [favorites, setFavorites] = useState<LibraryItem[]>(() => libraryManager.getFavorites());
  const [completed, setCompleted] = useState<LibraryItem[]>(() => libraryManager.getCompleted());

  const refresh = () => {
    setHistory(historyUtil.getHistory());
    setWatchlist(libraryManager.getWatchlist());
    setFavorites(libraryManager.getFavorites());
    setCompleted(libraryManager.getCompleted());
  };

  useEffect(() => {
    window.addEventListener('kinoma_progress_update', refresh);
    window.addEventListener('kinoma_library_update', refresh);
    return () => {
      window.removeEventListener('kinoma_progress_update', refresh);
      window.removeEventListener('kinoma_library_update', refresh);
    };
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const matches = <T extends { title?: string }>(items: T[]) => normalizedQuery
    ? items.filter(item => String(item.title || '').toLowerCase().includes(normalizedQuery))
    : items;
  const visibleHistory = useMemo(() => matches(history), [history, normalizedQuery]);
  const visibleWatchlist = useMemo(() => matches(watchlist), [watchlist, normalizedQuery]);
  const visibleFavorites = useMemo(() => matches(favorites), [favorites, normalizedQuery]);
  const visibleCompleted = useMemo(() => matches(completed), [completed, normalizedQuery]);
  const latestHistory = useMemo(
    () => [...history].sort((a, b) => b.lastWatchedTime - a.lastWatchedTime)[0],
    [history]
  );

  const removeHistory = (slug: string) => {
    historyUtil.removeHistory(slug);
    setHistory(prev => prev.filter(item => item.slug !== slug && item.animeId !== slug));
  };

  const removeLibrary = (id: string, type: 'watchlist' | 'favorites' | 'completed') => {
    libraryManager.removeItem(id, type);
    refresh();
  };

  const browse = () => { window.location.href = '/home'; };
  const tabItems: Record<Tab, HistoryItem[] | LibraryItem[]> = {
    continue: visibleHistory,
    watchlist: visibleWatchlist,
    favorites: visibleFavorites,
    completed: visibleCompleted,
  };
  const counts: Record<Tab, number> = {
    continue: history.length,
    watchlist: watchlist.length,
    favorites: favorites.length,
    completed: completed.length,
  };
  const shelfItems: Record<Tab, HistoryItem[] | LibraryItem[]> = {
    continue: visibleHistory,
    watchlist: visibleWatchlist,
    favorites: visibleFavorites,
    completed: visibleCompleted,
  };
  const shelfTitles: Record<Tab, string> = {
    continue: 'Continue Watching',
    watchlist: 'My List',
    favorites: 'Favourites',
    completed: 'Completed',
  };

  const renderHistoryCard = (item: HistoryItem) => {
    const mediaId = item.animeId || item.slug;
    const type = mediaId.startsWith('tmdb_movie_') ? 'movie' : 'series';
    const season = Math.max(1, Number(item.seasonNumber) || 1);
    const episode = Math.max(1, Number(item.episodeNumber) || 1);
    return (
      <div className="panda-library__shelf-card" key={item.episodeId || item.slug}>
        <ModernCard
          item={{ id: mediaId, title: item.title || 'Untitled', image: item.image, type }}
          layout="wide"
          progress={Math.min(1, Math.max(0, Number(item.completionPercentage || 0) / 100))}
          href={buildWatchHref(mediaId, type, season, episode, item.playbackTimestamp)}
          subText={`S${season} E${episode}`}
          onRemove={() => removeHistory(item.slug)}
        />
      </div>
    );
  };

  const renderPosterCard = (item: LibraryItem, type: 'watchlist' | 'favorites' | 'completed') => (
    <div className="panda-library__poster-card" key={item.id}>
      <LibraryPosterCard item={item} onRemove={() => removeLibrary(item.id, type)} />
    </div>
  );

  const renderShelf = (tab: Tab) => {
    const items = shelfItems[tab];
    return (
      <section className={`panda-library__shelf panda-library__shelf--${tab}`} aria-labelledby={`panda-library-${tab}-title`} key={tab}>
        <div className="panda-library__shelf-heading">
          <div>
            <h2 id={`panda-library-${tab}-title`}>{shelfTitles[tab]}</h2>
            <span>{counts[tab]} {counts[tab] === 1 ? 'title' : 'titles'}</span>
          </div>
          <button type="button" onClick={() => { setActive(tab); setQuery(''); }} aria-label={`View all ${shelfTitles[tab]}`}>See all</button>
        </div>
        {items.length ? (
          <div className="panda-library__shelf-track">
            {tab === 'continue'
              ? (items as HistoryItem[]).map(renderHistoryCard)
              : (items as LibraryItem[]).map(item => renderPosterCard(item, tab))}
          </div>
        ) : (
          <EmptyState tab={tab} onBrowse={browse} />
        )}
      </section>
    );
  };

  const renderSelectedGrid = (tab: Tab) => {
    const items = tabItems[tab];
    if (!items.length) return <EmptyState tab={tab} onBrowse={browse} />;
    if (tab === 'continue') {
      return <div className="panda-library__selected-grid panda-library__selected-grid--wide">{(items as HistoryItem[]).map(renderHistoryCard)}</div>;
    }
    return <div className="panda-library__selected-grid">{(items as LibraryItem[]).map(item => renderPosterCard(item, tab))}</div>;
  };

  return (
    <div className="kinoma-library-page panda-library">
      <div className="kinoma-library-page__inner panda-library__inner">
        <header className="kinoma-library-head panda-library__head">
          <div>
            <span className="kinoma-eyebrow">YOUR COLLECTION</span>
            <h1>My Library</h1>
          </div>
          <button
            type="button"
            className="panda-library__search-toggle"
            aria-label={searchOpen ? 'Close library search' : 'Search library'}
            aria-expanded={searchOpen}
            onClick={() => { setSearchOpen(open => !open); setQuery(''); }}
          >
            {searchOpen ? <X size={20} /> : <Search size={20} />}
          </button>
        </header>

        {searchOpen && (
          <label className="kinoma-library-search panda-library__search-field">
            <Search size={17} aria-hidden="true" />
            <input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Search your library" aria-label="Search your library" />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}
          </label>
        )}

        {latestHistory && (
          <section className="panda-library__resume" aria-label="Resume watching">
            {latestHistory.image && <img className="panda-library__resume-backdrop" src={latestHistory.image} alt="" aria-hidden="true" />}
            <div className="panda-library__resume-shade" aria-hidden="true" />
            <div className="panda-library__resume-content">
              <span className="panda-library__resume-label">RESUME</span>
              <h2>{latestHistory.title || 'Continue watching'}</h2>
              <p>S{Math.max(1, Number(latestHistory.seasonNumber) || 1)} E{Math.max(1, Number(latestHistory.episodeNumber) || 1)}</p>
              <div className="panda-library__resume-progress" role="progressbar" aria-label="Playback progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, Math.max(0, latestHistory.completionPercentage || 0)))}>
                <span style={{ width: `${Math.min(100, Math.max(0, latestHistory.completionPercentage || 0))}%` }} />
              </div>
              <Link
                className="panda-library__resume-button"
                href={buildWatchHref(latestHistory.animeId || latestHistory.slug, (latestHistory.animeId || latestHistory.slug).startsWith('tmdb_movie_') ? 'movie' : 'series', Math.max(1, Number(latestHistory.seasonNumber) || 1), Math.max(1, Number(latestHistory.episodeNumber) || 1), latestHistory.playbackTimestamp)}
              >
                <Play size={16} fill="currentColor" /> Resume
              </Link>
            </div>
          </section>
        )}

        <nav className="kinoma-library-tabs panda-library__filters" aria-label="Library filters">
          {FILTERS.map(({ id, label, Icon }) => (
            <button key={id} type="button" className={active === id ? 'is-active' : ''} aria-pressed={active === id} onClick={() => setActive(current => current === id ? null : id)}>
              <Icon size={15} aria-hidden="true" />
              <span>{label}</span>
              <span className="panda-library__filter-count">{counts[id]}</span>
            </button>
          ))}
        </nav>

        {active ? (
          <section className="panda-library__selected" aria-live="polite">
            <div className="panda-library__shelf-heading">
              <div>
                <h2>{shelfTitles[active]}</h2>
                <span>{tabItems[active].length} matching {tabItems[active].length === 1 ? 'title' : 'titles'}</span>
              </div>
              <button type="button" onClick={() => setActive(null)} aria-label="Show all library shelves">All shelves</button>
            </div>
            {renderSelectedGrid(active)}
          </section>
        ) : (
          <div className="panda-library__shelves">
            {(['continue', 'watchlist', 'favorites', 'completed'] as Tab[]).map(renderShelf)}
          </div>
        )}

        <Footer />
      </div>
    </div>
  );
}
