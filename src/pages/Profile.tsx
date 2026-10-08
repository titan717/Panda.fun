import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight, CheckCircle2, Clock3, Edit3, ExternalLink, Heart, History, Library,
  LogIn, LogOut, Mail, Save, Settings, ShieldCheck, Sparkles, UserRound, X
} from 'lucide-react';
import { Link } from 'wouter';
import { useAuth } from '../lib/AuthContext';
import { libraryManager } from '../lib/library';
import { historyUtil, type HistoryItem } from '../lib/history';
import { preferencesUtil } from '../lib/preferences';
import { buildWatchHref } from '../lib/mediaRoute';
import '../styles/panda-profile.css';

function getProviderLabel(user: { providerData: Array<{ providerId: string }> }): string {
  const providers = user.providerData.map((provider) => provider.providerId);
  if (providers.includes('google.com')) return 'Google';
  if (providers.includes('password')) return 'Email & password';
  return 'Firebase account';
}

function ProfileEditModal({
  name,
  onSave,
  onClose,
  saving,
}: {
  name: string;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}) {
  const [value, setValue] = useState(name);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next = value.trim();
    if (!next) {
      setError('Please enter a display name.');
      return;
    }
    setError('');
    try {
      await onSave(next);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update your profile.');
    }
  };

  return (
    <AnimatePresence>
      <div className="panda-profile-modal" role="presentation">
        <motion.div className="panda-profile-modal__backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
        <motion.div
          className="panda-profile-modal__dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="panda-profile-edit-title"
          initial={{ opacity: 0, y: 16, scale: .985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: .985 }}
        >
          <button type="button" className="panda-profile-modal__close" onClick={onClose} aria-label="Close profile editor"><X size={18} /></button>
          <span className="panda-profile-modal__eyebrow"><Edit3 size={12} /> Account</span>
          <h2 id="panda-profile-edit-title">Make your Panda yours.</h2>
          <p>Update the name shown across your Panda.fun profile.</p>
          {error && <div className="panda-profile-modal__error">{error}</div>}
          <form onSubmit={(event) => void submit(event)}>
            <label><span>Display name</span><div><UserRound size={15} /><input value={value} maxLength={60} onChange={(event) => setValue(event.target.value)} autoFocus autoComplete="name" /></div></label>
            <div className="panda-profile-modal__actions">
              <button type="button" className="panda-profile-button" onClick={onClose} disabled={saving}>Cancel</button>
              <button type="submit" className="panda-profile-button panda-profile-button--primary" disabled={saving}>{saving ? <span className="panda-profile-spinner" /> : <Save size={15} />}Save changes</button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export function Profile() {
  const { user, loading, openAuthModal, signOut, updateDisplayName } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [genrePreferences, setGenrePreferences] = useState<string[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const refreshProfile = () => {
    setHistory(historyUtil.getHistory());
    setWatchlistCount(libraryManager.getWatchlist().length);
    setFavoriteCount(libraryManager.getFavorites().length);
    setCompletedCount(libraryManager.getCompleted().length);
    setGenrePreferences(preferencesUtil.getTopUserGenres(6));
  };

  useEffect(() => {
    refreshProfile();
    const onUpdate = () => refreshProfile();
    window.addEventListener('kinoma_progress_update', onUpdate);
    window.addEventListener('kinoma_library_update', onUpdate);
    window.addEventListener('storage', onUpdate);
    return () => {
      window.removeEventListener('kinoma_progress_update', onUpdate);
      window.removeEventListener('kinoma_library_update', onUpdate);
      window.removeEventListener('storage', onUpdate);
    };
  }, [user?.uid]);

  const recent = useMemo(() => history.slice(0, 4), [history]);

  if (loading) {
    return <main className="panda-profile-v3 panda-profile-v3--loading"><div className="panda-profile-v3__inner"><div className="panda-profile-v3__loading-line" /><div className="panda-profile-v3__loading-line panda-profile-v3__loading-line--large" /><div className="panda-profile-v3__loading-grid"><span /><span /><span /></div></div></main>;
  }

  if (!user) {
    return (
      <main className="panda-profile-v3">
        <div className="panda-profile-v3__inner panda-profile-v3__guest">
          <div className="panda-profile-v3__guest-mark">🐼</div>
          <span className="panda-profile-v3__eyebrow"><Sparkles size={12} /> MY PANDA</span>
          <h1>Your Panda space<br /><em>is waiting.</em></h1>
          <p>Keep your library, watch progress and favourites connected with a free Firebase account.</p>
          <div className="panda-profile-v3__guest-actions">
            <button type="button" className="panda-profile-v3__cta panda-profile-v3__cta--primary" onClick={() => openAuthModal('signup')}><Sparkles size={16} /> Create account</button>
            <button type="button" className="panda-profile-v3__cta" onClick={() => openAuthModal('signin')}><LogIn size={16} /> Sign in</button>
          </div>
          <div className="panda-profile-v3__guest-note"><ShieldCheck size={14} /> Powered by Firebase Authentication</div>
        </div>
      </main>
    );
  }

  const displayName = user.displayName?.trim() || user.email?.split('@')[0] || 'Panda';
  const provider = getProviderLabel(user);

  const saveName = async (name: string) => {
    setSaving(true);
    try {
      await updateDisplayName(name);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('[Panda.fun] Sign out failed:', error);
    }
  };

  return (
    <main className="panda-profile-v3">
      <div className="panda-profile-v3__ambient" aria-hidden="true" />
      <div className="panda-profile-v3__inner">
        <header className="panda-profile-v3__header">
          <div className="panda-profile-v3__identity">
            <div className="panda-profile-v3__avatar">
              {user.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : <span>{displayName.slice(0, 1).toUpperCase()}</span>}
            </div>
            <div>
              <span className="panda-profile-v3__eyebrow"><Sparkles size={12} /> MY PANDA</span>
              <h1>{displayName}</h1>
              <p><Mail size={12} /> {user.email || 'Firebase account'}</p>
            </div>
          </div>
          <div className="panda-profile-v3__header-actions">
            <button type="button" onClick={() => setEditOpen(true)}><Edit3 size={14} /> Edit profile</button>
            <Link href="/settings"><Settings size={14} /> Settings</Link>
            <button type="button" onClick={() => void handleSignOut()} className="is-danger"><LogOut size={14} /> Sign out</button>
          </div>
        </header>

        <div className="panda-profile-v3__account-strip">
          <span><ShieldCheck size={14} /> Firebase account active</span>
          <span>{provider}</span>
          <span>UID · {user.uid.slice(0, 12)}…</span>
        </div>

        <section className="panda-profile-v3__stats" aria-label="Panda account stats">
          <div><strong>{watchlistCount}</strong><span>My List</span></div>
          <div><strong>{history.length}</strong><span>Watching</span></div>
          <div><strong>{favoriteCount}</strong><span>Favourites</span></div>
          <div><strong>{completedCount}</strong><span>Completed</span></div>
        </section>

        <div className="panda-profile-v3__columns">
          <section className="panda-profile-v3__section">
            <div className="panda-profile-v3__section-heading"><div><span>01 · KEEP WATCHING</span><h2>Recent watching</h2></div><Link href="/history">View all <ArrowRight size={13} /></Link></div>
            {recent.length ? (
              <div className="panda-profile-v3__watch-list">
                {recent.map((item) => {
                  const mediaId = item.animeId || item.slug;
                  const type = mediaId.startsWith('tmdb_movie_') ? 'movie' : 'series';
                  const season = Math.max(1, Number(item.seasonNumber) || 1);
                  const episode = Math.max(1, Number(item.episodeNumber) || 1);
                  return <Link key={item.slug + '-' + item.episodeNumber} href={buildWatchHref(mediaId, type, season, episode, item.playbackTimestamp)} className="panda-profile-v3__watch-item">
                    <div className="panda-profile-v3__watch-thumb">{item.image ? <img src={item.image} alt="" loading="lazy" /> : <Clock3 size={18} />}</div>
                    <div><strong>{item.title}</strong><span>{type === 'movie' ? 'Movie' : 'Season ' + season + ' · Episode ' + episode} · {Math.round(item.completionPercentage || 0)}%</span></div>
                    <ArrowRight size={15} />
                  </Link>;
                })}
              </div>
            ) : (
              <div className="panda-profile-v3__empty"><Clock3 size={19} /><strong>No recent watching yet.</strong><p>Start something and Panda will remember your place.</p><Link href="/home">Browse titles <ArrowRight size={13} /></Link></div>
            )}
          </section>

          <section className="panda-profile-v3__section">
            <div className="panda-profile-v3__section-heading"><div><span>02 · YOUR SPACE</span><h2>Quick links</h2></div></div>
            <div className="panda-profile-v3__quick-links">
              <Link href="/library"><span><Library size={15} /><b>My List</b><small>Saved titles & favourites</small></span><ArrowRight size={14} /></Link>
              <Link href="/history"><span><History size={15} /><b>Watch history</b><small>Everything Panda remembers</small></span><ArrowRight size={14} /></Link>
              <Link href="/settings"><span><Settings size={15} /><b>Preferences</b><small>Player & appearance settings</small></span><ArrowRight size={14} /></Link>
            </div>
          </section>
        </div>

        <section className="panda-profile-v3__section panda-profile-v3__section--wide">
          <div className="panda-profile-v3__section-heading"><div><span>03 · TASTE</span><h2>What Panda thinks you like.</h2></div></div>
          {genrePreferences.length ? <div className="panda-profile-v3__genres">{genrePreferences.map((genre, index) => <span key={genre}><i>{String(index + 1).padStart(2, '0')}</i>{genre}</span>)}</div> : <p className="panda-profile-v3__muted">Browse a few titles and Panda will build lightweight genre signals on this device.</p>}
        </section>

        <section className="panda-profile-v3__footer-callout">
          <div><span>ACCOUNT FOUNDATION</span><h2>Your Panda account is connected.</h2><p>Sign-in state is handled by Firebase Authentication. Your saved profile is mirrored to Firestore when available, while authentication itself remains independent from optional profile syncing.</p></div>
          <Link href="/privacy-policy">Privacy <ExternalLink size={13} /></Link>
        </section>
      </div>

      {editOpen && <ProfileEditModal name={displayName} saving={saving} onSave={saveName} onClose={() => setEditOpen(false)} />}
    </main>
  );
}
