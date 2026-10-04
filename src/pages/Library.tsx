import React, { useEffect, useMemo, useState } from 'react';
import { Footer } from '../components/ui/Footer';
import { Bookmark, CheckCircle2, Clock3, Heart, Play, Search, Trash2, X, Sparkles } from 'lucide-react';
import { slugifyTitle } from '../lib/slug';
import { ModernCard } from '../components/ui/modern/ModernCard';
import { Link } from 'wouter';
import { historyUtil, HistoryItem } from '../lib/history';
import { libraryManager, LibraryItem } from '../lib/library';
import { preferencesUtil } from '../lib/preferences';

type Tab = 'continue' | 'watchlist' | 'favorites' | 'completed';

const FALLBACK = [
  { id: 'library-1', title: 'Your saved titles will appear here', meta: 'Ready for MovieApi', tone: 'rose' },
  { id: 'library-2', title: 'Build your watchlist', meta: 'Movies · Series · Anime', tone: 'violet' },
  { id: 'library-3', title: 'Keep your favourites close', meta: 'Personal collection', tone: 'blue' },
];

function LibraryPandaScene({ savedMoments }: { savedMoments: number }) {
  return <div className="panda-library-scene" aria-label={`${savedMoments} saved moments in Panda Library`} role="img">
    <div className="panda-library-tv"><div className="panda-library-tv__screen"><span className="panda-library-tv__screen-glow" /><span className="panda-library-tv__saved"><b>{savedMoments}</b><small>saved moments</small></span></div></div>
    <div className="panda-library-panda">
      <span className="panda-library-head"><i className="panda-library-eye panda-library-eye--left" /><i className="panda-library-eye panda-library-eye--right" /><span className="panda-library-muzzle" /></span>
      <span className="panda-library-body" />
      <span className="panda-library-paw panda-library-paw--left" />
      <span className="panda-library-paw panda-library-paw--right" />
      <span className="panda-library-remote" />
    </div>
    <span className="panda-library-caption">Panda is watching too 🍿</span>
  </div>;
}

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

function LibraryPosterCard({ item, onRemove }: { item: LibraryItem; onRemove: () => void }) {
  const mediaType = item.id.startsWith('kinoma_tmdb_movie_') ? 'movie' : 'series';

  return (
    <ModernCard
      item={{ id: item.id, title: item.title, image: item.image, type: mediaType }}
      subText={item.type === 'watchlist' ? 'My List' : item.type === 'favorites' ? 'Favourite' : 'Completed'}
      href={`/details/${slugifyTitle(item.title)}?type=${mediaType}`}
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

  const counts = useMemo(() => ({
    continue: history.length,
    watchlist: watchlist.length,
    favorites: favorites.length,
    completed: completed.length,
  }), [history, watchlist, favorites, completed]);

  const current = active === 'continue' ? history : active === 'watchlist' ? watchlist : active === 'favorites' ? favorites : completed;
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
  const savedMoments = history.length + watchlist.length + favorites.length + completed.length;


  return (
    <main className="kinoma-library-page">
      <div className="kinoma-library-page__ambient" aria-hidden="true" />
      <div className="kinoma-library-page__inner">
        <header className="kinoma-library-head">
          <div>
            <span className="kinoma-eyebrow">Your space</span>
            <h1>Library</h1>
            <p>Everything you want to keep close — without the clutter.</p>
          </div>
          <LibraryPandaScene savedMoments={savedMoments} />
        </header>

        <nav className="kinoma-library-tabs" aria-label="Library sections">
          {([
            ['continue', 'Continue', Clock3],
            ['watchlist', 'Watchlist', Bookmark],
            ['favorites', 'Favourites', Heart],
            ['completed', 'Completed', CheckCircle2],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" className={active === id ? 'is-active' : ''} onClick={() => { setActive(id); setQuery(''); }}>
              <Icon size={15} />
              <span>{label}</span>
              <b>{counts[id]}</b>
            </button>
          ))}
        </nav>

        <section className="panda-saved-moments" aria-label="Saved moments">
          <div className="panda-saved-moments__copy">
            <span className="kinoma-eyebrow">Inside Panda&apos;s TV</span>
            <h2>Saved Moments</h2>
            <p>Your watch history and saved titles, gathered into one little corner of Panda&apos;s world.</p>
          </div>
          <div className="panda-saved-moments__count"><strong>{savedMoments}</strong><span>moments</span></div>
        </section>

        <div className="kinoma-library-toolbar">
          <label className="kinoma-library-search">
            <Search size={15} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search your ${active}…`} />
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
                const type = mediaId.startsWith('kinoma_tmdb_movie_') ? 'movie' : 'series';
                const season = Math.max(1, Number(item.seasonNumber) || 1);
                const episode = Math.max(1, Number(item.episodeNumber) || 1);
                const watchId = type === 'movie' ? mediaId : `${mediaId}$season${season}$episode${episode}`;
                const watchUrl = '/watch/' + encodeURIComponent(watchId) + '?type=' + type + (item.playbackTimestamp > 0 ? '&t=' + Math.floor(item.playbackTimestamp) : '');
                return (
                  <ModernCard
                    key={item.episodeId || item.slug}
                    item={{ id: mediaId, title: item.title || 'Untitled', image: item.image, type }}
                    href={watchUrl}
                    subText={type === 'movie' ? 'Resume' : `S${season} E${episode} · Resume`}
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
