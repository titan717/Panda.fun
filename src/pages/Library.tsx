import React, { useEffect, useMemo, useState } from 'react';
import { Bookmark, CheckCircle2, Clock3, Heart, Play, Search, Trash2, X, Sparkles } from 'lucide-react';
import { slugifyTitle } from '../lib/slug';
import { ModernCard } from '../components/ui/modern/ModernCard';
import { Link, useLocation } from 'wouter';
import { historyUtil, HistoryItem, formatPlaybackTimestamp } from '../lib/history';
import { libraryManager, LibraryItem } from '../lib/library';
import { preferencesUtil } from '../lib/preferences';

type Tab = 'continue' | 'watchlist' | 'favorites' | 'completed';

const FALLBACK = [
  { id: 'library-1', title: 'Your saved titles will appear here', meta: 'Ready for MovieApi', tone: 'rose' },
  { id: 'library-2', title: 'Build your watchlist', meta: 'Movies · Series · Anime', tone: 'violet' },
  { id: 'library-3', title: 'Keep your favourites close', meta: 'Personal collection', tone: 'blue' },
];

function LibraryPandaScene({ savedMoments }: { savedMoments: number }) {
  return <div className="panda-library-scene" aria-hidden="true">
    <div className="panda-library-tv"><span className="panda-library-tv__saved"><b>{savedMoments}</b><small>saved moments</small></span></div>
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
    continue: ['Nothing to continue', 'Start watching something and your progress will appear here.'],
    watchlist: ['Your watchlist is empty', 'Save movies and series you want to watch later.'],
    favorites: ['No favourites yet', 'Keep the titles you love in one simple place.'],
    completed: ['Nothing completed yet', 'Finished titles will be collected here.'],
  }[tab];

  return (
    <div className="kinoma-library-empty">
      <div className="kinoma-library-empty__icon"><Sparkles size={22} /></div>
      <h3>{copy[0]}</h3>
      <p>{copy[1]}</p>
      <button type="button" onClick={onBrowse}>Discover something</button>
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

function ContinueCard({ item, onRemove, onWatch }: { item: HistoryItem; onRemove: () => void; onWatch: (title: string) => void }) {
  const [, setLocation] = useLocation();
  const pct = Math.min(100, Math.max(3, Math.round(item.completionPercentage || 0)));
  const mediaId = item.animeId || item.slug;
  const type = mediaId.startsWith('kinoma_tmdb_movie_') ? 'movie' : 'series';
  const season = Math.max(1, Number(item.seasonNumber) || 1);
  const episode = Math.max(1, Number(item.episodeNumber) || 1);
  const watchId = type === 'movie'
    ? mediaId
    : `${mediaId}$season${season}$episode${episode}`;
  const watchUrl = '/watch/' + encodeURIComponent(watchId) + '?type=' + type + (item.playbackTimestamp > 0 ? '&t=' + Math.floor(item.playbackTimestamp) : '');

  return (
    <article className="kinoma-library-continue">
      <Link href={watchUrl} onClick={event => { event.preventDefault(); onWatch(item.title); window.setTimeout(() => setLocation(watchUrl), 560); }} className="kinoma-library-continue__art">
        {item.image ? <img src={item.image} alt="" loading="lazy" /> : <div className="kinoma-library-card__placeholder"><Play size={22} /></div>}
        <div className="kinoma-library-card__veil" />
        <span className="kinoma-library-continue__progress">{pct}%</span>
        <span className="kinoma-library-card__play"><Play size={16} fill="currentColor" /></span>
        <div className="kinoma-library-progress"><span style={{ width: `${pct}%` }} /></div>
      </Link>
      <div className="kinoma-library-continue__copy">
        <div>
          <span>{formatPlaybackTimestamp(item.playbackTimestamp || 0)}</span>
          <h3>{item.title}</h3>
          <p>{type === 'movie' ? 'Movie' : 'S' + (item.seasonNumber || 1) + ' · E' + (item.episodeNumber || 1)}</p>
        </div>
        <div className="kinoma-library-continue__actions">
          <Link href={watchUrl}>Resume <Play size={12} fill="currentColor" /></Link>
          <button type="button" onClick={onRemove} aria-label="Remove from continue watching"><Trash2 size={14} /></button>
        </div>
      </div>
    </article>
  );
}

export function Library() {
  const [active, setActive] = useState<Tab>('continue');
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>(() => historyUtil.getHistory());
  const [watchlist, setWatchlist] = useState<LibraryItem[]>(() => libraryManager.getWatchlist());
  const [favorites, setFavorites] = useState<LibraryItem[]>(() => libraryManager.getFavorites());
  const [completed, setCompleted] = useState<LibraryItem[]>(() => libraryManager.getCompleted());
  const [watchPanda, setWatchPanda] = useState<string | null>(null);

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
  const celebrateWatch = (title: string) => {
    setWatchPanda(title);
    window.setTimeout(() => setWatchPanda(current => current === title ? null : current), 2200);
  };

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
          <LibraryPandaScene savedMoments={history.length + watchlist.length + favorites.length + completed.length} />
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

        <AdsterraNativeBanner />

        {active === 'continue' ? (
          filtered.length ? (
            <section className="kinoma-library-continue-grid">
              {(filtered as HistoryItem[]).map(item => React.createElement(ContinueCard, { key: item.episodeId || item.slug, item, onRemove: () => removeHistory(item.slug), onWatch: celebrateWatch }))}
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
            <span className="kinoma-eyebrow">Built for what comes next</span>
            <h2>Keep your little collection close.</h2>
            <p>Save something you like. Panda will keep it here.</p>
          </div>
          <div className="kinoma-library-discovery__art" aria-hidden="true">
            <span /><span /><span />
          </div>
        </section>

        {watchPanda && <div className="kinoma-library-watch-pop" role="status" aria-live="polite">
          <div className="kinoma-library-watch-pop__panda"><span /></div>
          <div className="kinoma-library-watch-pop__copy"><strong>🐼 Enjoying the watch!</strong><span>{watchPanda}</span></div>
        </div>}

        <footer className="kinoma-library-foot">
          <span>Panda.fun</span>
          <span>Keep it. Find it. Watch it.</span>
        </footer>
      </div>
    </main>
  );
}
