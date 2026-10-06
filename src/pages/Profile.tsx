import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Clock3, Heart, History, Library, LogIn, LogOut, Settings, Sparkles, UserRound } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { libraryManager } from '../lib/library';
import { historyUtil, HistoryItem } from '../lib/history';
import { preferencesUtil } from '../lib/preferences';
import { buildWatchHref } from '../lib/mediaRoute';
import '../styles/panda-profile.css';

export function Profile() {
  const { user, loading, openAuthModal, signOut } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [genrePreferences, setGenrePreferences] = useState<string[]>([]);

  const refreshProfile = () => {
    setHistory(historyUtil.getHistory());
    setWatchlistCount(libraryManager.getWatchlist().length);
    setFavoriteCount(libraryManager.getFavorites().length);
    setGenrePreferences(preferencesUtil.getTopUserGenres(5));
  };

  useEffect(() => {
    refreshProfile();
    const onUpdate = () => refreshProfile();
    window.addEventListener('kinoma_progress_update', onUpdate);
    window.addEventListener('storage', onUpdate);
    return () => {
      window.removeEventListener('kinoma_progress_update', onUpdate);
      window.removeEventListener('storage', onUpdate);
    };
  }, [user?.uid]);

  if (loading) {
    return (
      <main className="panda-profile-v2">
        <div className="panda-profile-v2__inner">
          <div className="panda-profile-v2__hero" aria-busy="true">
            <div style={{ width: 180, height: 12, borderRadius: 99, background: 'rgba(255,255,255,.08)' }} />
            <div style={{ width: 310, height: 38, borderRadius: 12, background: 'rgba(255,255,255,.08)', marginTop: 15 }} />
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="panda-profile-v2">
        <div className="panda-profile-v2__inner">
          <section className="panda-profile-v2__hero panda-profile-v2__signed-out">
            <div className="panda-profile-v2__mark"><UserRound size={30} /></div>
            <span className="panda-profile-v2__eyebrow"><Sparkles size={13} /> Panda profile</span>
            <h1>Your Panda space is waiting.</h1>
            <p>Sign in to keep your library, watch progress and favourites connected to your Panda account.</p>
            <div className="panda-profile-v2__actions" style={{ justifyContent: 'center' }}>
              <button type="button" className="panda-profile-v2__button panda-profile-v2__button--primary" onClick={() => openAuthModal('signin')}>
                <LogIn size={15} /> Sign in
              </button>
              <button type="button" className="panda-profile-v2__button" onClick={() => openAuthModal('signup')}>
                Create account <ArrowRight size={15} />
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const displayName = user.displayName?.trim() || user.email?.split('@')[0] || 'Panda';
  const recent = history.slice(0, 3);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // AuthContext surfaces the failure; keep the current page stable.
    }
  };

  return (
    <main className="panda-profile-v2">
      <div className="panda-profile-v2__inner">
        <section className="panda-profile-v2__hero">
          <div className="panda-profile-v2__identity">
            <div className="panda-profile-v2__avatar">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
              ) : (
                <div className="panda-profile-v2__avatar-fallback"><UserRound size={30} /></div>
              )}
            </div>
            <div>
              <span className="panda-profile-v2__eyebrow"><Sparkles size={13} /> My Panda</span>
              <h1 className="panda-profile-v2__name">{displayName}</h1>
              <span className="panda-profile-v2__email">{user.email || 'Panda account'}</span>
            </div>
          </div>

          <div className="panda-profile-v2__actions">
            <Link href="/settings" className="panda-profile-v2__button panda-profile-v2__button--primary"><Settings size={15} /> Settings</Link>
            <Link href="/library" className="panda-profile-v2__button"><Library size={15} /> My List</Link>
            <button type="button" className="panda-profile-v2__button panda-profile-v2__button--danger" onClick={handleSignOut}><LogOut size={15} /> Sign out</button>
          </div>
        </section>

        <div className="panda-profile-v2__grid">
          <section className="panda-profile-v2__panel">
            <div className="panda-profile-v2__panel-head">
              <h2>Your Panda stats</h2>
              <span>At a glance</span>
            </div>
            <div className="panda-profile-v2__stats">
              <div className="panda-profile-v2__stat"><strong>{watchlistCount}</strong><span>My List</span></div>
              <div className="panda-profile-v2__stat"><strong>{history.length}</strong><span>Watching</span></div>
              <div className="panda-profile-v2__stat"><strong>{favoriteCount}</strong><span>Favourites</span></div>
            </div>

            <div className="panda-profile-v2__panel-head" style={{ marginTop: 26 }}>
              <h2>Quick links</h2>
              <span>Jump in</span>
            </div>
            <div className="panda-profile-v2__links">
              <Link href="/library" className="panda-profile-v2__link"><span><Library size={14} /> My List</span><ArrowRight size={14} /></Link>
              <Link href="/history" className="panda-profile-v2__link"><span><History size={14} /> Watch history</span><ArrowRight size={14} /></Link>
              <Link href="/settings" className="panda-profile-v2__link"><span><Settings size={14} /> Preferences</span><ArrowRight size={14} /></Link>
            </div>
          </section>

          <section className="panda-profile-v2__panel">
            <div className="panda-profile-v2__panel-head">
              <h2>Recent watching</h2>
              <Link href="/history" className="panda-profile-v2__see-all" style={{ color: 'rgba(255,255,255,.48)', fontSize: 10, textDecoration: 'none' }}>View all <ArrowRight size={12} /></Link>
            </div>
            {recent.length > 0 ? (
              <div className="panda-profile-v2__links">
                {recent.map(item => {
                  const mediaId = item.animeId || item.slug;
                  const type = mediaId.startsWith('tmdb_movie_') ? 'movie' : 'series';
                  return (
                  <Link
                    key={item.slug}
                    href={buildWatchHref(mediaId, type, item.seasonNumber, Number(item.episodeNumber), item.playbackTimestamp)}
                    className="panda-profile-v2__link"
                  >
                    <span>
                      <Clock3 size={14} />
                      {item.title}
                      <small style={{ display: 'block', marginTop: 4, color: 'rgba(255,255,255,.36)', fontSize: 9 }}>
                        S{item.seasonNumber || 1} · E{item.episodeNumber || 1} · {Math.round(item.completionPercentage || 0)}%
                      </small>
                    </span>
                    <ArrowRight size={14} />
                  </Link>
                  );
                })}
              </div>
            ) : (
              <p className="panda-profile-v2__hint">Nothing here yet. Start a movie or series and your recent watching will appear here automatically.</p>
            )}

            <div className="panda-profile-v2__panel-head" style={{ marginTop: 26 }}>
              <h2>Your taste</h2>
              <span>Local signals</span>
            </div>
            {genrePreferences.length > 0 ? (
              <div className="panda-profile-v2__genres">
                {genrePreferences.map(genre => <span key={genre} className="panda-profile-v2__genre">{genre}</span>)}
              </div>
            ) : (
              <p className="panda-profile-v2__hint">Browse a few titles and Panda.fun will build lightweight genre signals on this device.</p>
            )}
          </section>
        </div>

        <section className="panda-profile-v2__panel" style={{ marginTop: 15 }}>
          <div className="panda-profile-v2__panel-head">
            <h2>Keep Panda close</h2>
            <span>Coming together</span>
          </div>
          <p className="panda-profile-v2__hint">
            Your account is already connected to your saved library and watch progress. Personal onboarding and the full Panda Lounge will be activated in the next product phase, without changing this profile foundation.
          </p>
        </section>
      </div>
    </main>
  );
}
