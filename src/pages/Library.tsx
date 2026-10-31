import React, { useEffect, useState } from 'react';
import { Footer } from '../components/ui/Footer';
import { Bookmark, CheckCircle2, Clock3, Heart, Play, Search, X, Sparkles } from 'lucide-react';
import { buildDetailsHref, buildWatchHref } from '../lib/mediaRoute';
import { ModernCard } from '../components/ui/modern/ModernCard';
import { historyUtil, HistoryItem } from '../lib/history';
import { libraryManager, LibraryItem } from '../lib/library';

type Tab = 'continue' | 'watchlist' | 'favorites' | 'completed';

function EmptyState({ tab, onBrowse }: { tab: Tab; onBrowse: () => void }) {
  const copy = {
    continue: ['Nothing to continue', 'Start watching something and your progress will appear here.', 'Find something to watch'],
    watchlist: ['Your watchlist is empty', 'Save movies and series you want to watch later.', 'Browse titles'],
    favorites: ['No favourites yet', 'Keep the titles you love in one simple place.', 'Find favourites'],
    completed: ['Nothing completed yet', 'Finished titles will be collected here.', 'Start watching'],
  }[tab];

  return (
    <div className="kinoma-library-empty">
      <div className="kinoma-library-empty__icon"><Sparkles size={22} /></div>
      <h3>{copy[0]}</h3>
      <p>{copy[1]}</p>
      <button type="button" onClick={onBrowse}>{copy[2]}</button>
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
  const [active, setActive] = useState<Tab>('continue');
  const [query, setQuery] = useState('');
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

  const current = active === 'continue' ? history : active === 'watchlist' ? watchlist : active === 'favorites' ? favorites : completed;
  const sectionCopy = {
    continue: ['Continue watching', 'Pick up where you left off.'],
    watchlist: ['Your watchlist', 'The titles you have saved for later.'],
    favorites: ['Your favourites', 'The stories you want to keep close.'],
    completed: ['Completed titles', 'A collection of everything you have finished.'],
  }[active];
  const filtered = query.trim()
    ? current.filter((item: any) => String(item.title || '').toLowerCase().includes(query.trim().toLowerCase()))
    : current;

  const removeHistory = (slug: string) => {
    historyUtil.removeHistory(slug);
    setHistory(prev => prev.filter(item => item.slug !== slug && item.animeId !== slug));
  };

  const removeLibrary = (id: string, type: 'watchlist' | 'favorites' | 'completed') => {
    libraryManager.removeItem(id, type);
    refresh();
  };

  const browse = () => { window.location.href = '/home'; };


  return (
    <main className="kinoma-library-page">
      <div className="kinoma-library-page__ambient" aria-hidden="true" />
      <div className="kinoma-library-page__inner">
        <header className="kinoma-library-head">
          <div>
            <span className="kinoma-eyebrow">Your space</span>
            <h1>Library</h1>
            <p>Your personal collection, organised around what you love to watch.</p>
          </div>
          <div className="kinoma-library-head__art" aria-hidden="true">
            <span className="kinoma-library-head__art-orbit" />
            <span className="kinoma-library-head__art-screen"><Play size={25} fill="currentColor" /></span>
          </div>
        </header>

        <nav className="kinoma-library-tabs" aria-label="Library sections">
          {([
            ['continue', 'Continue Watching', Clock3],
            ['watchlist', 'Watchlist', Bookmark],
            ['favorites', 'Favourites', Heart],
            ['completed', 'Completed', CheckCircle2],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" className={active === id ? 'is-active' : ''} aria-pressed={active === id} onClick={() => { setActive(id); setQuery(''); }}>
              <Icon size={16} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <section className="kinoma-library-collection-heading" aria-live="polite">
          <div>
            <span className="kinoma-eyebrow">Your collection</span>
            <h2>{sectionCopy[0]}</h2>
            <p>{sectionCopy[1]}</p>
          </div>
        </section>

        <div className="kinoma-library-toolbar">
          <label className="kinoma-library-search">
            <Search size={15} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search this collection…" aria-label="Search this collection" />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear filter"><X size={14} /></button>}
          </label>
          {active === 'continue' && history.length > 0 && (
            <button type="button" className="kinoma-library-clear" onClick={() => { historyUtil.clearHistory(); setHistory([]); }}>Clear progress</button>
          )}
        </div>

        {active === 'continue' ? (
          filtered.length ? (
            <section className="kinoma-library-grid">
              {(filtered as HistoryItem[]).map(item => {
                const mediaId = item.animeId || item.slug;
                const type = mediaId.startsWith('tmdb_movie_') ? 'movie' : 'series';
                const season = Math.max(1, Number(item.seasonNumber) || 1);
                const episode = Math.max(1, Number(item.episodeNumber) || 1);
                const watchUrl = buildWatchHref(mediaId, type, season, episode, item.playbackTimestamp);
                return (
                  <ModernCard
                    key={item.episodeId || item.slug}
                    item={{ id: mediaId, title: item.title || 'Untitled', image: item.image, type }}
                    href={watchUrl}
                    subText="Continue watching"
                    onRemove={() => removeHistory(item.slug)}
                  />
                );
              })}
            </section>
          ) : <EmptyState tab="continue" onBrowse={browse} />
        ) : filtered.length ? (
          <section className="kinoma-library-grid">
            {(filtered as LibraryItem[]).map(item => (
              <LibraryPosterCard
                key={item.id}
                item={item}
                onRemove={() => removeLibrary(
                  item.id,
                  active === 'watchlist' ? 'watchlist' : active === 'favorites' ? 'favorites' : 'completed'
                )}
              />
            ))}
          </section>
        ) : <EmptyState tab={active} onBrowse={browse} />}

        <section className="kinoma-library-discovery">
          <div>
            <span className="kinoma-eyebrow">A little nudge from Panda</span>
            <h2>Find your next favourite.</h2>
            <p>Browse something new, then save it here when you find a title worth keeping.</p>
            <button type="button" className="kinoma-library-discovery__cta" onClick={browse}>Browse titles</button>
          </div>
          <div className="kinoma-library-discovery__art" aria-hidden="true">
            <span /><span /><span />
          </div>
        </section>



        <Footer />
      </div>
    </main>
  );
}
