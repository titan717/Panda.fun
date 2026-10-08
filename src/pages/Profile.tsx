import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft, ArrowRight, Check, Compass, Drama, Edit3, Fingerprint, Ghost, History,
  Heart, Library, Laugh, Lock, LogIn, LogOut, Mail, Plus, Rocket, Search,
  Settings, ShieldCheck, Sparkles, Trash2, UserRound, X, Zap
} from 'lucide-react';
import { Link } from 'wouter';
import { useAuth } from '../lib/AuthContext';
import { libraryManager } from '../lib/library';
import { historyUtil, type HistoryItem } from '../lib/history';
import {
  clearProfilePin,
  createProfileId,
  deleteProfile,
  getActiveProfileId,
  isValidProfilePin,
  listProfiles,
  MOVIE_GENRES,
  normalizeProfile,
  PROFILE_AVATARS,
  saveProfile,
  setActiveProfileId,
  setProfilePin,
  SERIES_GENRES,
  type PandaProfile,
  verifyProfilePin,
} from '../lib/profileStore';
import { buildWatchHref } from '../lib/mediaRoute';
import { trackEvent } from '../lib/analytics';
import { initializeProfileStorage } from '../lib/profileScope';
import '../styles/panda-profile.css';

type SetupStep = 1 | 2 | 3 | 4 | 5;

function ProfileAvatar({
  profile,
  size = 'md',
  interactive = false,
}: {
  profile: PandaProfile;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
}) {
  return (
    <div className={'panda-profile-avatar panda-profile-avatar--' + size + (interactive ? ' is-interactive' : '')}>
      <img
        src={'/profile-avatars/' + (PROFILE_AVATARS.some((avatar) => avatar.id === profile.avatar) ? profile.avatar : 'panda') + '.svg'}
        alt=""
        draggable={false}
        aria-hidden="true"
      />
      {profile.pinHash && (
        <span className="panda-profile-avatar__lock" aria-label="Profile locked">
          <Lock size={size === 'lg' ? 13 : 10} />
        </span>
      )}
    </div>
  );
}

function ProgressDots({ step }: { step: SetupStep }) {
  return (
    <div className="panda-profile-progress" aria-label={'Step ' + step + ' of 5'}>
      {([1, 2, 3, 4, 5] as SetupStep[]).map((item) => (
        <span key={item} className={item === step ? 'is-active' : item < step ? 'is-done' : ''} />
      ))}
    </div>
  );
}

function GenreIcon({ genre }: { genre: string }) {
  switch (genre) {
    case 'Comedy':
      return <Laugh size={15} strokeWidth={1.75} aria-hidden="true" />;
    case 'Action':
    case 'Action & Adventure':
      return <Zap size={15} strokeWidth={1.75} aria-hidden="true" />;
    case 'Drama':
      return <Drama size={15} strokeWidth={1.75} aria-hidden="true" />;
    case 'Horror':
      return <Ghost size={15} strokeWidth={1.75} aria-hidden="true" />;
    case 'Romance':
      return <Heart size={15} strokeWidth={1.75} aria-hidden="true" />;
    case 'Adventure':
      return <Compass size={15} strokeWidth={1.75} aria-hidden="true" />;
    case 'Science Fiction':
    case 'Sci-Fi & Fantasy':
    case 'Fantasy':
      return <Rocket size={15} strokeWidth={1.75} aria-hidden="true" />;
    case 'Mystery':
      return <Search size={15} strokeWidth={1.75} aria-hidden="true" />;
    case 'Thriller':
    case 'Crime':
      return <Fingerprint size={15} strokeWidth={1.75} aria-hidden="true" />;
    default:
      return <Sparkles size={15} strokeWidth={1.75} aria-hidden="true" />;
  }
}

function ChoiceButton({
  selected,
  children,
  onClick,
  disabled,
}: {
  selected: boolean;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  key?: React.Key;
}) {
  return (
    <button
      type="button"
      className={'panda-profile-choice' + (selected ? ' is-selected' : '')}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
    >
      <GenreIcon genre={String(children)} />
      <span>{children}</span>
      {selected && <Check size={13} />}
    </button>
  );
}

function ProfileSetup({
  initialProfile,
  defaultName,
  onComplete,
  onBack,
}: {
  initialProfile?: PandaProfile | null;
  defaultName: string;
  onComplete: (profile: PandaProfile) => void;
  onBack: () => void;
}) {
  const [step, setStep] = useState<SetupStep>(1);
  const [name, setName] = useState(initialProfile?.name || defaultName);
  const [avatar, setAvatar] = useState(initialProfile?.avatar || '');
  const [pin, setPin] = useState('');
  const [removePin, setRemovePin] = useState(false);
  const [movieGenres, setMovieGenres] = useState<string[]>(initialProfile?.movieGenres || []);
  const [seriesGenres, setSeriesGenres] = useState<string[]>(initialProfile?.seriesGenres || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const flowPillProfile: PandaProfile = {
    id: initialProfile?.id || 'preview',
    name: name.trim() || defaultName || 'Panda',
    avatar: avatar || 'panda',
    pinHash: initialProfile?.pinHash,
    movieGenres,
    seriesGenres,
    createdAt: initialProfile?.createdAt || '',
    updatedAt: initialProfile?.updatedAt || '',
  };

  const title =
    step === 1
      ? 'Create your profile'
      : step === 2
        ? 'Choose your look'
        : step === 3
          ? 'Lock it with a PIN?'
          : step === 4
            ? 'What movies do you love?'
            : 'What series do you love?';

  const subtitle =
    step === 1
      ? "Give it a name — this is who's watching"
      : step === 2
        ? 'Pick an avatar that feels like this profile'
        : step === 3
          ? 'Only someone with this 4-digit PIN can use the profile. Leave it empty to skip — you can add one later.'
          : step === 4
            ? 'Pick up to 3 film genres — half of your first For You comes from these.'
            : 'Now pick up to 3 TV genres. The other half of For You is built from these.';

  const toggleGenre = (genre: string, kind: 'movie' | 'series') => {
    const selected = kind === 'movie' ? movieGenres : seriesGenres;
    const setter = kind === 'movie' ? setMovieGenres : setSeriesGenres;

    if (selected.includes(genre)) {
      setter(selected.filter((item) => item !== genre));
      return;
    }

    if (selected.length < 3) setter([...selected, genre]);
  };

  const next = async (skipCurrent = false) => {
    setError('');

    if (step === 1) {
      if (!name.trim()) {
        setError('Give this profile a name.');
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      setStep(3);
      return;
    }

    if (step === 3) {
      if (pin && !isValidProfilePin(pin)) {
        setError('PIN must be exactly 4 digits.');
        return;
      }
      if (pin === '0000') {
        setError('Choose a PIN other than 0000.');
        return;
      }
      setStep(4);
      return;
    }

    if (step === 4) {
      setStep(5);
      return;
    }

    if (step === 5 && skipCurrent) setSeriesGenres([]);

    setSaving(true);
    try {
      const selectedSeriesGenres = step === 5 && skipCurrent ? [] : seriesGenres;
      const base = normalizeProfile({
        id: initialProfile?.id || createProfileId(),
        name: name.trim(),
        avatar: avatar || 'panda',
        movieGenres,
        seriesGenres: selectedSeriesGenres,
        pinHash: initialProfile?.pinHash,
        createdAt: initialProfile?.createdAt,
        updatedAt: new Date().toISOString(),
      });

      let nextProfile = base;
      if (removePin) {
        nextProfile = clearProfilePin(base);
      } else if (pin) {
        nextProfile = await setProfilePin(base, pin);
      }

      onComplete(nextProfile);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this profile.');
    } finally {
      setSaving(false);
    }
  };

  const back = () => {
    setError('');
    if (step === 1) {
      onBack();
      return;
    }
    setStep((step - 1) as SetupStep);
  };

  return (
    <main className="panda-profile-flow">
      <div className="panda-profile-flow__ambient" aria-hidden="true" />
      <div className="panda-profile-flow__inner">
        <ProgressDots step={step} />

        {step !== 1 && (
          <div className="panda-profile-flow__user-pill">
            {step === 2 && !initialProfile ? (
              <span className="panda-profile-flow__user-initial" aria-hidden="true">
                {(name.trim().charAt(0) || defaultName?.charAt(0) || 'P').toUpperCase()}
              </span>
            ) : (
              <ProfileAvatar profile={flowPillProfile} size="sm" />
            )}
            <span>{flowPillProfile.name}</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.section
            key={step}
            className="panda-profile-flow__step"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: .2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="panda-profile-flow__copy">
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>

            {step === 1 && (
              <label className="panda-profile-name-field">
                <span className="sr-only">Profile name</span>
                <input
                  value={name}
                  maxLength={20}
                  onChange={(event) => setName(event.target.value)}
                  autoFocus
                  placeholder="Profile name"
                  aria-label="Profile name"
                />
              </label>
            )}

            {step === 2 && (
              <div className="panda-profile-avatar-browser">
                <h3>Classics</h3>
                <div className="panda-profile-avatar-grid">
                  {PROFILE_AVATARS.map((item) => {
                    const selected = avatar === item.id;
                    const avatarId = item.id === 'panda' || item.id === 'fox' || item.id === 'cat'
                      || item.id === 'bear' || item.id === 'koala' || item.id === 'rabbit'
                      || item.id === 'tiger' || item.id === 'dog'
                      ? item.id
                      : 'panda';
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={'panda-profile-avatar-choice' + (selected ? ' is-selected' : '')}
                        onClick={() => setAvatar(item.id)}
                        aria-label={item.label}
                        aria-pressed={selected}
                      >
                        <img
                          src={'/profile-avatars/' + avatarId + '.svg'}
                          alt=""
                          draggable={false}
                          aria-hidden="true"
                        />
                        {selected && <i><Check size={13} /></i>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="panda-profile-pin-wrap">
                <div className="panda-profile-pin">
                  {[0, 1, 2, 3].map((index) => (
                    <span
                      key={index}
                      className={[
                        pin[index] ? 'is-filled' : '',
                        index === pin.length && pin.length < 4 ? 'is-current' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      {pin[index] ? '•' : ''}
                    </span>
                  ))}
                </div>

                <input
                  className="panda-profile-pin-input"
                  aria-label="Four digit profile PIN"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={pin}
                  onChange={(event) => {
                    setRemovePin(false);
                    setPin(event.target.value.replace(/\\D/g, '').slice(0, 4));
                  }}
                  autoFocus
                />

                {initialProfile?.pinHash && !pin && !removePin && (
                  <div className="panda-profile-pin-links">
                    <span>Leave empty to keep the current PIN.</span>
                    <button type="button" onClick={() => setRemovePin(true)}>Remove PIN</button>
                  </div>
                )}

                {initialProfile?.pinHash && removePin && (
                  <div className="panda-profile-pin-links">
                    <span>This profile will become unlocked.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setRemovePin(false);
                        setPin('');
                      }}
                    >
                      Keep PIN
                    </button>
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="panda-profile-choices">
                {MOVIE_GENRES.map((genre) => (
                  <ChoiceButton
                    key={genre}
                    selected={movieGenres.includes(genre)}
                    disabled={!movieGenres.includes(genre) && movieGenres.length >= 3}
                    onClick={() => toggleGenre(genre, 'movie')}
                  >
                    {genre}
                  </ChoiceButton>
                ))}
              </div>
            )}

            {step === 5 && (
              <div className="panda-profile-choices">
                {SERIES_GENRES.map((genre) => (
                  <ChoiceButton
                    key={genre}
                    selected={seriesGenres.includes(genre)}
                    disabled={!seriesGenres.includes(genre) && seriesGenres.length >= 3}
                    onClick={() => toggleGenre(genre, 'series')}
                  >
                    {genre}
                  </ChoiceButton>
                ))}
              </div>
            )}

            {error && <div className="panda-profile-flow__error">{error}</div>}

            <div className="panda-profile-flow__actions">
              {(step > 1 || Boolean(initialProfile)) && (
                <button
                  type="button"
                  className="panda-profile-flow__button panda-profile-flow__button--ghost"
                  onClick={back}
                  disabled={saving}
                >
                  <ArrowLeft size={15} /> Back
                </button>
              )}

              {(step === 4 || step === 5) && (
                <button
                  type="button"
                  className="panda-profile-flow__skip"
                  onClick={() => step === 5 ? void next(true) : setStep(5)}
                  disabled={saving}
                >
                  Skip
                </button>
              )}

              <button
                type="button"
                className="panda-profile-flow__button panda-profile-flow__button--primary"
                onClick={() => void next()}
                disabled={
                  saving ||
                  (step === 1 && !name.trim()) ||
                  (step === 2 && !avatar) ||
                  (step === 3 && pin.length > 0 && pin.length < 4) ||
                  (step === 4 && movieGenres.length === 0) ||
                  (step === 5 && seriesGenres.length === 0)
                }
              >
                {saving && <span className="panda-profile-spinner" />}
                {!saving && step === 5 && 'Start watching'}
                {!saving && step !== 5 && 'Continue'}
                {!saving && <ArrowRight size={15} />}
              </button>
            </div>
          </motion.section>
        </AnimatePresence>
      </div>
    </main>
  );
}

function PinPrompt({
  profile,
  onUnlock,
  onCancel,
}: {
  profile: PandaProfile;
  onUnlock: () => void;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    if (pin.length !== 4) {
      setError('Enter the 4-digit PIN.');
      return;
    }

    const valid = await verifyProfilePin(profile, pin);
    if (!valid) {
      setError('That PIN is not right.');
      setPin('');
      return;
    }

    onUnlock();
  };

  return (
    <div className="panda-profile-overlay">
      <div className="panda-profile-overlay__backdrop" onClick={onCancel} />
      <motion.div
        className="panda-profile-pin-dialog"
        initial={{ opacity: 0, scale: .97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
      >
        <button type="button" className="panda-profile-overlay__close" onClick={onCancel} aria-label="Close">
          <X size={17} />
        </button>

        <ProfileAvatar profile={profile} size="md" />
        <span className="panda-profile-mini-label"><Lock size={11} /> Locked profile</span>
        <h2>{profile.name}</h2>
        <p>Enter the 4-digit PIN to continue.</p>

        <div className="panda-profile-pin panda-profile-pin--dialog">
          {[0, 1, 2, 3].map((index) => (
            <span key={index} className={pin[index] ? 'is-filled' : ''}>
              {pin[index] ? '•' : ''}
            </span>
          ))}
        </div>

        <input
          className="panda-profile-pin-input"
          aria-label="Profile PIN"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\\D/g, '').slice(0, 4))}
          autoFocus
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit();
          }}
        />

        {error && <div className="panda-profile-flow__error">{error}</div>}

        <button
          type="button"
          className="panda-profile-flow__button panda-profile-flow__button--primary panda-profile-pin-submit"
          onClick={() => void submit()}
          disabled={pin.length !== 4}
        >
          Unlock profile
        </button>
      </motion.div>
    </div>
  );
}

function ProfileDashboard({
  profile,
  user,
  onSwitch,
  onEdit,
  onSignOut,
}: {
  profile: PandaProfile;
  user: { email?: string | null };
  onSwitch: () => void;
  onEdit: () => void;
  onSignOut: () => void;
}) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  const refresh = () => {
    setHistory(historyUtil.getHistory());
    setWatchlistCount(libraryManager.getWatchlist().length);
    setFavoriteCount(libraryManager.getFavorites().length);
    setCompletedCount(libraryManager.getCompleted().length);
  };

  useEffect(() => {
    refresh();
    const update = () => refresh();
    window.addEventListener('kinoma_progress_update', update);
    window.addEventListener('kinoma_library_update', update);
    return () => {
      window.removeEventListener('kinoma_progress_update', update);
      window.removeEventListener('kinoma_library_update', update);
    };
  }, [profile.id]);

  const recent = useMemo(() => history.slice(0, 5), [history]);
  const tastes = [...new Set([...profile.movieGenres, ...profile.seriesGenres])].slice(0, 6);

  return (
    <main className="panda-profile-dashboard">
      <div className="panda-profile-dashboard__ambient" aria-hidden="true" />
      <div className="panda-profile-dashboard__inner">
        <header className="panda-profile-dashboard__header">
          <div className="panda-profile-dashboard__identity">
            <ProfileAvatar profile={profile} size="lg" />
            <div>
              <span className="panda-profile-mini-label"><Sparkles size={11} /> MY PANDA</span>
              <h1>{profile.name}</h1>
              <p><Mail size={12} /> {user.email || 'Firebase account'}</p>
            </div>
          </div>

          <div className="panda-profile-dashboard__actions">
            <button type="button" onClick={onSwitch}><UserRound size={14} /> Switch profile</button>
            <button type="button" onClick={onEdit}><Edit3 size={14} /> Edit</button>
            <Link href="/settings"><Settings size={14} /> Settings</Link>
            <button type="button" onClick={onSignOut} className="is-danger"><LogOut size={14} /> Sign out</button>
          </div>
        </header>

        <div className="panda-profile-dashboard__rule">
          <span />
          {profile.pinHash ? 'Private profile' : 'Personal profile'}
          <b />
          Firebase account connected
        </div>

        <section className="panda-profile-dashboard__stats" aria-label="Profile activity">
          <div><strong>{watchlistCount}</strong><span>My List</span></div>
          <div><strong>{history.length}</strong><span>Watching</span></div>
          <div><strong>{favoriteCount}</strong><span>Favourites</span></div>
          <div><strong>{completedCount}</strong><span>Completed</span></div>
        </section>

        <section className="panda-profile-dashboard__section panda-profile-dashboard__section--watching">
          <div className="panda-profile-section-head">
            <div><span>01 · KEEP WATCHING</span><h2>Recent watching</h2></div>
            <Link href="/history">View all <ArrowRight size={13} /></Link>
          </div>

          {recent.length ? (
            <div className="panda-profile-watch-list">
              {recent.map((item) => {
                const mediaId = item.animeId || item.slug;
                const type = mediaId.startsWith('tmdb_movie_') ? 'movie' : 'series';
                const season = Math.max(1, Number(item.seasonNumber) || 1);
                const episode = Math.max(1, Number(item.episodeNumber) || 1);

                return (
                  <Link
                    key={item.slug + '-' + item.episodeNumber}
                    href={buildWatchHref(mediaId, type, season, episode, item.playbackTimestamp)}
                    className="panda-profile-watch-row"
                  >
                    <div className="panda-profile-watch-row__thumb">
                      {item.image ? <img src={item.image} alt="" loading="lazy" /> : <span>🐼</span>}
                    </div>
                    <div>
                      <strong>{item.title}</strong>
                      <small>
                        {type === 'movie' ? 'Movie' : 'Season ' + season + ' · Episode ' + episode}
                        {' · '}
                        {Math.round(item.completionPercentage || 0)}%
                      </small>
                    </div>
                    <ArrowRight size={15} />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="panda-profile-empty">
              <span className="panda-profile-clock">◷</span>
              <strong>No recent watching yet.</strong>
              <p>Start something and Panda will remember your place.</p>
              <Link href="/home">Browse titles <ArrowRight size={13} /></Link>
            </div>
          )}
        </section>

        <section className="panda-profile-dashboard__split">
          <div className="panda-profile-dashboard__section">
            <div className="panda-profile-section-head">
              <div><span>02 · YOUR SPACE</span><h2>Quick links</h2></div>
            </div>
            <div className="panda-profile-quick-links">
              <Link href="/library"><Library size={15} /><span><b>My List</b><small>Saved titles & favourites</small></span><ArrowRight size={14} /></Link>
              <Link href="/history"><History size={15} /><span><b>Watch history</b><small>Everything Panda remembers</small></span><ArrowRight size={14} /></Link>
              <Link href="/settings"><Settings size={15} /><span><b>Preferences</b><small>Player & appearance settings</small></span><ArrowRight size={14} /></Link>
            </div>
          </div>

          <div className="panda-profile-dashboard__section">
            <div className="panda-profile-section-head">
              <div><span>03 · TASTE</span><h2>What you love</h2></div>
            </div>
            {tastes.length ? (
              <div className="panda-profile-tastes">
                {tastes.map((taste, index) => (
                  <span key={taste}><i>{String(index + 1).padStart(2, '0')}</i>{taste}</span>
                ))}
              </div>
            ) : (
              <p className="panda-profile-muted">Complete your taste setup and Panda will use it to shape For You.</p>
            )}
          </div>
        </section>

        <footer className="panda-profile-dashboard__footer">
          <div>
            <span>ACCOUNT</span>
            <strong>{profile.name}</strong>
            <small>Profile settings are synced to Firebase when Firestore is available.</small>
          </div>
          <Link href="/privacy-policy">Privacy <ArrowRight size={12} /></Link>
        </footer>
      </div>
    </main>
  );
}

function ProfileSelector({
  profiles,
  onSelect,
  onAdd,
  onManage,
}: {
  profiles: PandaProfile[];
  onSelect: (profile: PandaProfile) => void;
  onAdd: () => void;
  onManage: () => void;
}) {
  const atLimit = profiles.length >= 6;

  return (
    <main className="panda-profile-selector">
      <div className="panda-profile-selector__ambient" aria-hidden="true" />
      <div className="panda-profile-selector__inner">
        <h1>Who's watching?</h1>

        <div className="panda-profile-selector__grid">
          {profiles.map((profile) => (
            <button key={profile.id} type="button" className="panda-profile-tile" onClick={() => onSelect(profile)}>
              <ProfileAvatar profile={profile} size="lg" interactive />
              <span>{profile.name}</span>
            </button>
          ))}

          {!atLimit && (
            <button type="button" className="panda-profile-tile panda-profile-tile--add" onClick={onAdd}>
              <span className="panda-profile-add-avatar"><Plus size={28} /></span>
              <span>Add profile</span>
            </button>
          )}
        </div>

        <div className="panda-profile-selector__footer">
          <button type="button" onClick={onManage}>Manage profiles</button>
          <Link href="/settings">Settings</Link>
        </div>
      </div>
    </main>
  );
}

function ManageProfiles({
  profiles,
  onDone,
  onEdit,
  onDelete,
}: {
  profiles: PandaProfile[];
  onDone: () => void;
  onEdit: (profile: PandaProfile) => void;
  onDelete: (profile: PandaProfile) => void;
}) {
  return (
    <main className="panda-profile-manage">
      <div className="panda-profile-manage__inner">
        <button type="button" className="panda-profile-back" onClick={onDone}><ArrowLeft size={15} /> Back</button>
        <span className="panda-profile-mini-label"><Settings size={11} /> PROFILES</span>
        <h1>Manage profiles</h1>
        <p>Edit how each Panda looks, feels and behaves.</p>

        <div className="panda-profile-manage__list">
          {profiles.map((profile) => (
            <div className="panda-profile-manage__row" key={profile.id}>
              <ProfileAvatar profile={profile} size="md" />
              <div>
                <strong>{profile.name}</strong>
                <small>
                  {profile.pinHash ? 'PIN protected' : 'No PIN'}
                  {' · '}
                  {profile.movieGenres.length + profile.seriesGenres.length} taste signals
                </small>
              </div>
              <button type="button" onClick={() => onEdit(profile)} aria-label={'Edit ' + profile.name}><Edit3 size={14} /></button>
              <button
                type="button"
                className="is-danger"
                onClick={() => onDelete(profile)}
                disabled={profiles.length <= 1}
                aria-label={'Delete ' + profile.name}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export function Profile() {
  const { user, loading, openAuthModal, signOut } = useAuth();
  const [profiles, setProfiles] = useState<PandaProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<PandaProfile | null>(null);
  const [view, setView] = useState<'selector' | 'setup' | 'dashboard' | 'manage'>('selector');
  const [editingProfile, setEditingProfile] = useState<PandaProfile | null>(null);
  const [pinProfile, setPinProfile] = useState<PandaProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PandaProfile | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setProfiles([]);
      setActiveProfile(null);
      setView('selector');
      setReady(true);
      return;
    }

    void listProfiles(user.uid).then((loaded) => {
      if (cancelled) return;

      setProfiles(loaded);
      const activeId = getActiveProfileId(user.uid);
      const selected = loaded.find((profile) => profile.id === activeId) || null;

      if (!loaded.length) {
        setActiveProfile(null);
        setView('setup');
      } else {
        setActiveProfile(selected);
        setView('selector');
      }

      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  if (loading || !ready) {
    return (
      <main className="panda-profile-loading">
        <div className="panda-profile-loading__orb">🐼</div>
        <span>Preparing your Panda…</span>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="panda-profile-guest">
        <div className="panda-profile-guest__ambient" aria-hidden="true" />
        <div className="panda-profile-guest__inner">
          <div className="panda-profile-guest__mark">🐼</div>
          <span className="panda-profile-mini-label"><Sparkles size={11} /> MY PANDA</span>
          <h1>Your Panda space<br /><em>is waiting.</em></h1>
          <p>Create an account to keep profiles, watch progress and your taste connected across your Panda sessions.</p>
          <div className="panda-profile-guest__actions">
            <button type="button" className="is-primary" onClick={() => openAuthModal('signup')}><Plus size={15} /> Create account</button>
            <button type="button" onClick={() => openAuthModal('signin')}><LogIn size={15} /> Sign in</button>
          </div>
          <div className="panda-profile-guest__note"><ShieldCheck size={13} /> Firebase Authentication</div>
        </div>
      </main>
    );
  }

  const defaultName = user.displayName?.trim() || user.email?.split('@')[0] || 'Panda';

  const completeSetup = async (profile: PandaProfile) => {
    const isFirstProfile = profiles.length === 0 && !editingProfile;
    const saved = await saveProfile(user.uid, profile);
    initializeProfileStorage(user.uid, saved.id, isFirstProfile, [
      'kinoma_history',
      'kinoma_watchlist',
      'kinoma_completed',
      'kinoma_favorites',
      'kinoma_ep_progress',
      'kinoma_meta_cache',
      'kinoma_search_history',
    ]);
    setActiveProfile(saved);
    setActiveProfileId(user.uid, saved.id);
    void historyUtil.syncFromFirestore(user.uid);
    void libraryManager.syncFromFirestore(user.uid);
    setEditingProfile(null);
    void trackEvent({
      type: editingProfile ? 'profile_update' : 'profile_create',
      metadata: {
        profileId: saved.id,
        avatar: saved.avatar,
        movieGenres: saved.movieGenres,
        seriesGenres: saved.seriesGenres,
      },
    });
    setView('dashboard');
  };

  const selectProfile = (profile: PandaProfile) => {
    if (profile.pinHash) {
      setPinProfile(profile);
      return;
    }

    initializeProfileStorage(user.uid, profile.id, false, [
      'kinoma_history',
      'kinoma_watchlist',
      'kinoma_completed',
      'kinoma_favorites',
      'kinoma_ep_progress',
      'kinoma_meta_cache',
      'kinoma_search_history',
    ]);
    setActiveProfile(profile);
    setActiveProfileId(user.uid, profile.id);
    void historyUtil.syncFromFirestore(user.uid);
    void libraryManager.syncFromFirestore(user.uid);
    void trackEvent({ type: 'profile_select', metadata: { profileId: profile.id, locked: false } });
    setView('dashboard');
  };

  const unlockProfile = () => {
    if (!pinProfile) return;

    initializeProfileStorage(user.uid, pinProfile.id, false, [
      'kinoma_history',
      'kinoma_watchlist',
      'kinoma_completed',
      'kinoma_favorites',
      'kinoma_ep_progress',
      'kinoma_meta_cache',
      'kinoma_search_history',
    ]);
    setActiveProfile(pinProfile);
    setActiveProfileId(user.uid, pinProfile.id);
    void historyUtil.syncFromFirestore(user.uid);
    void libraryManager.syncFromFirestore(user.uid);
    void trackEvent({
      type: 'profile_select',
      metadata: { profileId: pinProfile.id, locked: true, pinUnlocked: true },
    });
    setPinProfile(null);
    setView('dashboard');
  };

  const deleteProfileItem = async (profile: PandaProfile) => {
    if (profiles.length <= 1) return;

    await deleteProfile(user.uid, profile.id);
    const remaining = profiles.filter((item) => item.id !== profile.id);
    setProfiles(remaining);
    void trackEvent({ type: 'profile_delete', metadata: { profileId: profile.id } });

    if (activeProfile?.id === profile.id) {
      setActiveProfile(null);
      setActiveProfileId(user.uid, '');
    }

    setConfirmDelete(null);
  };

  const changeProfile = () => {
    void trackEvent({
      type: 'profile_switch',
      metadata: { fromProfileId: activeProfile?.id || '' },
    });
    setView('selector');
    setActiveProfile(null);
    setActiveProfileId(user.uid, '');
  };

  const handleSignOut = async () => {
    await signOut();
    setActiveProfile(null);
  };

  const editProfile = (profile: PandaProfile) => {
    setEditingProfile(profile);
    setView('setup');
  };

  if (view === 'setup') {
    return (
      <ProfileSetup
        defaultName={defaultName}
        initialProfile={editingProfile}
        onComplete={(profile) => void completeSetup(profile)}
        onBack={() => {
          setEditingProfile(null);
          setView(activeProfile ? 'dashboard' : 'selector');
        }}
      />
    );
  }

  if (view === 'manage') {
    return (
      <>
        <ManageProfiles
          profiles={profiles}
          onDone={() => setView('selector')}
          onEdit={editProfile}
          onDelete={(profile) => setConfirmDelete(profile)}
        />
        {confirmDelete && (
          <div className="panda-profile-overlay">
            <div className="panda-profile-overlay__backdrop" onClick={() => setConfirmDelete(null)} />
            <motion.div
              className="panda-profile-pin-dialog"
              initial={{ opacity: 0, scale: .97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
            >
              <button type="button" className="panda-profile-overlay__close" onClick={() => setConfirmDelete(null)} aria-label="Close"><X size={17} /></button>
              <ProfileAvatar profile={confirmDelete} size="md" />
              <span className="panda-profile-mini-label"><Trash2 size={11} /> Delete profile</span>
              <h2>Remove {confirmDelete.name}?</h2>
              <p>This removes the profile and its personalization. This cannot be undone.</p>
              <div className="panda-profile-flow__actions" style={{ width: '100%', marginTop: 18 }}>
                <button type="button" className="panda-profile-flow__button" onClick={() => setConfirmDelete(null)}>Cancel</button>
                <button type="button" className="panda-profile-flow__button panda-profile-flow__button--primary" onClick={() => void deleteProfileItem(confirmDelete)}><Trash2 size={14} /> Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </>
    );
  }

  if (view === 'dashboard' && activeProfile) {
    return (
      <>
        <ProfileDashboard
          profile={activeProfile}
          user={user}
          onSwitch={changeProfile}
          onEdit={() => editProfile(activeProfile)}
          onSignOut={() => void handleSignOut()}
        />
        {pinProfile && <PinPrompt profile={pinProfile} onUnlock={unlockProfile} onCancel={() => setPinProfile(null)} />}
      </>
    );
  }

  return (
    <>
      <ProfileSelector
        profiles={profiles}
        onSelect={selectProfile}
        onAdd={() => {
          setEditingProfile(null);
          setView('setup');
        }}
        onManage={() => setView('manage')}
      />
      {pinProfile && <PinPrompt profile={pinProfile} onUnlock={unlockProfile} onCancel={() => setPinProfile(null)} />}
    </>
  );
}
