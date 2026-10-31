import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ChevronRight, Play, Database, Sparkles, ShieldCheck, X, RotateCcw, FlaskConical, Trash2 } from 'lucide-react';
import { useAppearance } from '../lib/AppearanceContext';
import { updateSEO } from '../lib/seo';
import { KinomaLogo } from '../components/ui/KinomaLogo';
import { AppUpdatesCard } from '../components/ui/AppUpdatesCard';

export function Settings() {
  const { openSettingsModal } = useAppearance();
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const pandaBufferRef = React.useRef('');
  const pandaCountRef = React.useRef(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;
      if (event.key.length !== 1 || /\\s/.test(event.key)) return;
      const char = event.key.toLowerCase();
      pandaBufferRef.current = (pandaBufferRef.current + char).slice(-5);
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

  React.useEffect(() => {
    updateSEO({ title: 'Settings', description: 'Manage your Panda.fun preferences.', type: 'website' });
  }, []);

  const cards = [
    { tab: 'appearance' as const, icon: Sparkles, eyebrow: 'LOOK & FEEL', title: 'Appearance', description: 'Tune the Panda.fun interface and replay the cinematic intro.' },
    { tab: 'player' as const, icon: Play, eyebrow: 'WATCHING', title: 'Player', description: 'Control autoplay, next episode, skip behaviour and audio preferences.' },
    { tab: 'library' as const, icon: Database, eyebrow: 'YOUR DATA', title: 'Library & Storage', description: 'Manage your saved titles, watch history and local data.' },
  ];

  return (
    <main className="panda-settings-page">
      <div className="panda-settings-page__glow" aria-hidden="true" />
      <div className="panda-settings-page__inner">
        <header className="panda-settings-page__header">
          <div className="panda-settings-page__identity">
            <KinomaLogo variant="mark" size="lg" className="panda-settings-page__mark" />
            <div>
              <span className="panda-settings-page__eyebrow">MAKE IT YOURS</span>
              <h1>Settings</h1>
              <p>Small preferences, a more comfortable way to watch.</p>
            </div>
          </div>
          <Link href="/home" className="panda-settings-page__back">Back to Home <ChevronRight size={15} /></Link>
        </header>

        <section className="panda-settings-page__grid" aria-label="Settings categories">
          {cards.map(({ tab, icon: Icon, eyebrow, title, description }) => (
            <button key={tab} type="button" onClick={() => openSettingsModal(tab)} className="panda-settings-card">
              <span className="panda-settings-card__top">
                <span className="panda-settings-card__icon"><Icon size={19} /></span>
                <ChevronRight size={17} className="panda-settings-card__arrow" />
              </span>
              <span className="panda-settings-card__copy">
                <span className="panda-settings-card__eyebrow">{eyebrow}</span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
              <span className="panda-settings-card__hint">Open preferences</span>
            </button>
          ))}
        </section>

        <AppUpdatesCard />

        <section className="panda-settings-footer">
          <div className="panda-settings-footer__icon"><ShieldCheck size={17} /></div>
          <div>
            <strong>Your preferences stay on your device</strong>
            <p>Playback preferences and library controls are stored locally in your browser unless a connected account feature explicitly syncs them.</p>
          </div>
          <span className="panda-settings-footer__paw" aria-hidden="true">🐾</span>
        </section>

        {devToolsOpen && (
          <div className="panda-devtools" role="dialog" aria-modal="true" aria-labelledby="panda-devtools-title">
            <button className="panda-devtools__backdrop" aria-label="Close developer tools" onClick={() => setDevToolsOpen(false)} />
            <section className="panda-devtools__panel">
              <header className="panda-devtools__head">
                <div>
                  <span className="panda-settings-page__eyebrow">SECRET TEST LAB</span>
                  <h2 id="panda-devtools-title">Panda Dev Tools</h2>
                  <p>Replay and inspect the onboarding flow without changing the normal Settings surface.</p>
                </div>
                <button className="panda-devtools__close" type="button" onClick={() => setDevToolsOpen(false)} aria-label="Close"><X size={18} /></button>
              </header>

              <div className="panda-devtools__actions">
                <button type="button" onClick={() => window.dispatchEvent(new Event('panda_dev_replay_onboarding'))}>
                  <RotateCcw size={17} /><span><strong>Replay onboarding</strong><small>Open it with the current saved preferences.</small></span>
                </button>
                <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('panda_dev_onboarding_stage', { detail: { step: 0 } }))}>
                  <FlaskConical size={17} /><span><strong>Start / arrival</strong><small>Jump straight to Panda's entrance.</small></span>
                </button>
                <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('panda_dev_onboarding_stage', { detail: { step: 5 } }))}>
                  <Play size={17} /><span><strong>Ready stage</strong><small>Test the final transition and exit.</small></span>
                </button>
                <button type="button" className="is-danger" onClick={() => window.dispatchEvent(new Event('panda_dev_reset_onboarding'))}>
                  <Trash2 size={17} /><span><strong>Reset onboarding</strong><small>Clear the onboarding profile and replay from scratch.</small></span>
                </button>
              </div>

              <div className="panda-devtools__stages">
                <span>Jump to stage</span>
                <div>
                  {['Welcome', 'Your Panda', 'Taste', 'Language', 'Playback', 'Ready'].map((label, step) => (
                    <button key={label} type="button" onClick={() => window.dispatchEvent(new CustomEvent('panda_dev_onboarding_stage', { detail: { step } }))}>{step + 1}. {label}</button>
                  ))}
                </div>
              </div>

              <footer>Tip: type <kbd>panda</kbd> three times on Settings, or press <kbd>Ctrl/Cmd + Shift + P</kbd>.</footer>
            </section>
          </div>
        )}

        <div className="panda-settings-page__brand" aria-hidden="true">panda<span>.fun</span></div>
      </div>
    </main>
  );
}
