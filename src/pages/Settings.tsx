import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ChevronLeft, Play, Database, Sparkles, X, RotateCcw, FlaskConical, Trash2, UserRound, Monitor, Info, Check } from 'lucide-react';
import { useAppearance } from '../lib/AppearanceContext';
import { useAuth } from '../lib/AuthContext';
import { updateSEO } from '../lib/seo';
import { KinomaLogo } from '../components/ui/KinomaLogo';
import { AppUpdatesCard } from '../components/ui/AppUpdatesCard';
import { historyUtil } from '../lib/history';
import { libraryManager } from '../lib/library';
import './settings-page.css';

declare const __APP_VERSION__: string | undefined;

function SettingSwitch({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="panda-settings-row">
      <div className="panda-settings-row__copy"><strong>{label}</strong><small>{description}</small></div>
      <button type="button" className={`panda-settings-switch${checked ? ' is-on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={onChange}>
        <span />
      </button>
    </div>
  );
}

export function Settings() {
  const { user } = useAuth();
  const { playerSettings, updatePlayerSetting, playbackPreferences, updatePlaybackPreference } = useAppearance();
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const [historyCount, setHistoryCount] = useState(() => historyUtil.getHistory().length);
  const [savedCount, setSavedCount] = useState(() => libraryManager.getWatchlist().length + libraryManager.getFavorites().length + libraryManager.getCompleted().length);
  const pandaBufferRef = React.useRef('');
  const pandaCountRef = React.useRef(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;
      if (event.key.length !== 1 || /\\s/.test(event.key)) return;
      pandaBufferRef.current = (pandaBufferRef.current + event.key.toLowerCase()).slice(-5);
      if (pandaBufferRef.current === 'panda') {
        pandaCountRef.current += 1;
        pandaBufferRef.current = '';
        if (pandaCountRef.current >= 3) {
          pandaCountRef.current = 0;
          setDevToolsOpen(true);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    updateSEO({ title: 'Settings', description: 'Manage your Panda.fun preferences.', type: 'website' });
  }, []);

  const clearHistory = () => {
    if (!window.confirm('Clear your entire watch history? This cannot be undone.')) return;
    historyUtil.clearHistory();
    setHistoryCount(0);
  };
  const clearLibrary = () => {
    if (!window.confirm('Clear your Watchlist, Completed, and Favorites lists? This cannot be undone.')) return;
    libraryManager.clearAll();
    setSavedCount(0);
  };
  const replayOnboarding = () => window.dispatchEvent(new Event('panda_dev_replay_onboarding'));

  return (
    <main className="panda-settings-v3">
      <header className="panda-settings-v3__header">
        <Link href="/home" className="panda-settings-v3__back" aria-label="Back to Home"><ChevronLeft size={19} /></Link>
        <div><span>YOUR EXPERIENCE</span><h1>Settings</h1></div>
      </header>

      <section className="panda-settings-v3__profile">
        <span className="panda-settings-v3__avatar"><KinomaLogo variant="mark" size="md" /></span>
        <div><span className="panda-settings-v3__eyebrow">PANDA ACCOUNT</span><h2>{user?.displayName || user?.email?.split('@')[0] || 'Your Panda'}</h2><p>{user ? 'Your preferences and saved titles' : 'Personalise the way you watch'}</p></div>
        <Link href="/profile" className="panda-settings-v3__profile-link" aria-label="Open profile"><UserRound size={18} /></Link>
      </section>

      <section className="panda-settings-v3__group" aria-labelledby="panda-settings-appearance">
        <div className="panda-settings-v3__group-heading"><Sparkles size={17} /><h2 id="panda-settings-appearance">Appearance</h2></div>
        <div className="panda-settings-v3__surface">
          <div className="panda-settings-row">
            <span className="panda-settings-row__icon"><Monitor size={17} /></span>
            <div className="panda-settings-row__copy"><strong>Dark cinematic theme</strong><small>Pure black surfaces with warm ivory and crimson accents</small></div>
            <span className="panda-settings-v3__active"><Check size={14} /> Active</span>
          </div>
          <button type="button" className="panda-settings-row panda-settings-row--button" onClick={replayOnboarding}>
            <span className="panda-settings-row__icon"><RotateCcw size={17} /></span>
            <span className="panda-settings-row__copy"><strong>Replay onboarding</strong><small>Review your initial Panda setup and preferences</small></span>
            <ChevronLeft className="panda-settings-row__chevron" size={17} />
          </button>
        </div>
      </section>

      <section className="panda-settings-v3__group" aria-labelledby="panda-settings-playback">
        <div className="panda-settings-v3__group-heading"><Play size={17} /><h2 id="panda-settings-playback">Playback</h2></div>
        <div className="panda-settings-v3__surface">
          <SettingSwitch label="Autoplay" description="Start playback automatically when opening a title" checked={playerSettings.autoPlay} onChange={() => updatePlayerSetting('autoPlay', !playerSettings.autoPlay)} />
          <SettingSwitch label="Next episode" description="Continue to the next episode when available" checked={playerSettings.autoNext} onChange={() => updatePlayerSetting('autoNext', !playerSettings.autoNext)} />
          <SettingSwitch label="Skip intro" description="Skip detected opening sequences" checked={playerSettings.skipIntro} onChange={() => updatePlayerSetting('skipIntro', !playerSettings.skipIntro)} />
          <SettingSwitch label="Skip outro" description="Skip detected ending sequences" checked={playerSettings.skipOutro} onChange={() => updatePlayerSetting('skipOutro', !playerSettings.skipOutro)} />
          <div className="panda-settings-row panda-settings-row--stack">
            <div className="panda-settings-row__copy"><strong>Preferred audio</strong><small>Choose your default audio preference</small></div>
            <div className="panda-settings-segment" role="group" aria-label="Preferred audio">
              <button type="button" className={playerSettings.preferredAudio === 'sub' ? 'is-active' : ''} aria-pressed={playerSettings.preferredAudio === 'sub'} onClick={() => updatePlayerSetting('preferredAudio', 'sub')}>Sub</button>
              <button type="button" className={playerSettings.preferredAudio === 'dub' ? 'is-active' : ''} aria-pressed={playerSettings.preferredAudio === 'dub'} onClick={() => updatePlayerSetting('preferredAudio', 'dub')}>Dub</button>
            </div>
          </div>
          <div className="panda-settings-row panda-settings-row--stack">
            <div className="panda-settings-row__copy"><strong>Audio language</strong><small>Preferred spoken language</small></div>
            <select className="panda-settings-select" value={playbackPreferences.audioLanguage} onChange={event => updatePlaybackPreference('audioLanguage', event.target.value as typeof playbackPreferences.audioLanguage)} aria-label="Audio language">
              <option value="auto">Auto</option><option value="en">English</option><option value="ja">Japanese</option><option value="ko">Korean</option><option value="es">Spanish</option><option value="hi">Hindi</option>
            </select>
          </div>
          <div className="panda-settings-row panda-settings-row--stack">
            <div className="panda-settings-row__copy"><strong>Subtitle language</strong><small>Preferred subtitle language</small></div>
            <select className="panda-settings-select" value={playbackPreferences.subtitleLanguage} onChange={event => updatePlaybackPreference('subtitleLanguage', event.target.value as typeof playbackPreferences.subtitleLanguage)} aria-label="Subtitle language">
              <option value="off">Off</option><option value="auto">Auto</option><option value="en">English</option><option value="ja">Japanese</option><option value="ko">Korean</option><option value="es">Spanish</option><option value="hi">Hindi</option>
            </select>
          </div>
          <div className="panda-settings-row panda-settings-row--stack">
            <div className="panda-settings-row__copy"><strong>Subtitle source</strong><small>Choose automatic selection or Nitro</small></div>
            <div className="panda-settings-segment" role="group" aria-label="Subtitle source">
              <button type="button" className={playbackPreferences.subtitleProvider === 'auto' ? 'is-active' : ''} aria-pressed={playbackPreferences.subtitleProvider === 'auto'} onClick={() => updatePlaybackPreference('subtitleProvider', 'auto')}>Auto</button>
              <button type="button" className={playbackPreferences.subtitleProvider === 'nitro' ? 'is-active' : ''} aria-pressed={playbackPreferences.subtitleProvider === 'nitro'} onClick={() => updatePlaybackPreference('subtitleProvider', 'nitro')}>Nitro</button>
            </div>
          </div>
        </div>
      </section>

      <section className="panda-settings-v3__group" aria-labelledby="panda-settings-library">
        <div className="panda-settings-v3__group-heading"><Database size={17} /><h2 id="panda-settings-library">Library & storage</h2></div>
        <div className="panda-settings-v3__surface">
          <div className="panda-settings-row"><span className="panda-settings-row__copy"><strong>Watch history</strong><small>{historyCount} recently watched titles</small></span><button type="button" className="panda-settings-v3__text-action" onClick={clearHistory} disabled={!historyCount}>Clear history</button></div>
          <div className="panda-settings-row"><span className="panda-settings-row__copy"><strong>Saved titles</strong><small>{savedCount} watchlist, favourite and completed items</small></span><button type="button" className="panda-settings-v3__text-action" onClick={clearLibrary} disabled={!savedCount}>Clear lists</button></div>
          <p className="panda-settings-v3__footnote">Your library and playback preferences stay on this device unless a connected account feature syncs them.</p>
        </div>
      </section>

      <section className="panda-settings-v3__group" aria-labelledby="panda-settings-updates">
        <div className="panda-settings-v3__group-heading"><DownloadIcon /><h2 id="panda-settings-updates">Updates</h2></div>
        <AppUpdatesCard />
      </section>

      <section className="panda-settings-v3__group" aria-labelledby="panda-settings-about">
        <div className="panda-settings-v3__group-heading"><Info size={17} /><h2 id="panda-settings-about">About</h2></div>
        <div className="panda-settings-v3__surface">
          <div className="panda-settings-row"><span className="panda-settings-row__copy"><strong>Panda.fun</strong><small>Version {typeof __APP_VERSION__ === 'string' && __APP_VERSION__ ? __APP_VERSION__ : 'Production'} · Build {import.meta.env.MODE}</small></span><span className="panda-settings-v3__wordmark">PANDA<span>.FUN</span></span></div>
          <Link href="/terms" className="panda-settings-row panda-settings-row--button"><span className="panda-settings-row__copy"><strong>Terms of service</strong></span><ChevronLeft className="panda-settings-row__chevron" size={17} /></Link>
          <Link href="/privacy-policy" className="panda-settings-row panda-settings-row--button"><span className="panda-settings-row__copy"><strong>Privacy policy</strong></span><ChevronLeft className="panda-settings-row__chevron" size={17} /></Link>
        </div>
      </section>

      {devToolsOpen && (
        <div className="panda-devtools" role="dialog" aria-modal="true" aria-labelledby="panda-devtools-title">
          <button className="panda-devtools__backdrop" aria-label="Close developer tools" onClick={() => setDevToolsOpen(false)} />
          <section className="panda-devtools__panel">
            <header className="panda-devtools__head">
              <div><span className="panda-settings-v3__eyebrow">SECRET TEST LAB</span><h2 id="panda-devtools-title">Panda Dev Tools</h2><p>Replay and inspect the onboarding flow without changing the normal Settings surface.</p></div>
              <button className="panda-devtools__close" type="button" onClick={() => setDevToolsOpen(false)} aria-label="Close"><X size={18} /></button>
            </header>
            <div className="panda-devtools__actions">
              <button type="button" onClick={() => window.dispatchEvent(new Event('panda_dev_replay_onboarding'))}><RotateCcw size={17} /><span><strong>Replay onboarding</strong><small>Open it with the current saved preferences.</small></span></button>
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('panda_dev_onboarding_stage', { detail: { step: 0 } }))}><FlaskConical size={17} /><span><strong>Start / arrival</strong><small>Jump straight to Panda's entrance.</small></span></button>
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('panda_dev_onboarding_stage', { detail: { step: 5 } }))}><Play size={17} /><span><strong>Ready stage</strong><small>Test the final transition and exit.</small></span></button>
              <button type="button" className="is-danger" onClick={() => window.dispatchEvent(new Event('panda_dev_reset_onboarding'))}><Trash2 size={17} /><span><strong>Reset onboarding</strong><small>Clear the onboarding profile and replay from scratch.</small></span></button>
            </div>
            <div className="panda-devtools__stages"><span>Jump to stage</span><div>{['Welcome', 'Your Panda', 'Taste', 'Language', 'Playback', 'Ready'].map((label, step) => <button key={label} type="button" onClick={() => window.dispatchEvent(new CustomEvent('panda_dev_onboarding_stage', { detail: { step } }))}>{step + 1}. {label}</button>)}</div></div>
            <footer>Tip: type <kbd>panda</kbd> three times on Settings, or press <kbd>Ctrl/Cmd + Shift + P</kbd>.</footer>
          </section>
        </div>
      )}
    </main>
  );
}

function DownloadIcon() {
  return <Database size={17} />;
}
