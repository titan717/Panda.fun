import React from 'react';
import { m } from 'motion/react';
import { AnimatedCheck, Pressable, ProgressRing, useMotionPreference } from '../../motion';
import { CheckCircle2, Download, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import { useAppUpdates } from '../../lib/appUpdates';
import { statusMessage } from '../../lib/appUpdateState';

export function AppUpdatesCard() {
  const { state, check, apply } = useAppUpdates();
  const preference = useMotionPreference();
  const busy = state.status === 'checking' || state.status === 'applying';
  const isAndroid = state.source === 'android';
  const Icon =
    state.status === 'up-to-date' ? CheckCircle2 : state.status === 'error' ? TriangleAlert : state.status === 'available' ? Download : RefreshCw;

  return (
    <section className="panda-updates" aria-labelledby="panda-updates-title">
      <m.div
        key={state.status}
        className="panda-updates__icon"
        aria-hidden="true"
        initial={false}
        animate={state.status === 'error' && preference === 'full' ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }}
        transition={{ duration: 0.34 }}
      >
        {busy ? <Loader2 size={18} className="panda-updates__spin" /> : state.status === 'up-to-date' ? <span className="panda-updates__success-ring"><ProgressRing value={100} size={34} strokeWidth={2.5} /><AnimatedCheck checked size={18} className="panda-updates__success-check" /></span> : <Icon size={18} />}
      </m.div>

      <div className="panda-updates__copy">
        <span className="panda-settings-page__eyebrow">APP UPDATES</span>
        <h2 id="panda-updates-title">Updates</h2>
        <p className="panda-updates__version">
          {isAndroid ? 'App' : 'Web app'} version {state.currentVersion || 'unknown'}
        </p>
        <p className={'panda-updates__status' + (state.status === 'error' ? ' is-error' : '')} role="status" aria-live="polite">
          {statusMessage(state)}
        </p>
        {state.status === 'available' && state.releaseNotes && (
          <p className="panda-updates__notes">{state.releaseNotes}</p>
        )}
      </div>

      <div className="panda-updates__actions">
        {state.status === 'available' ? (
          <Pressable className="panda-updates__button is-primary" onClick={() => void apply()} disabled={busy}>
            <Download size={15} aria-hidden="true" />
            {isAndroid ? 'Download update' : 'Reload to update'}
          </Pressable>
        ) : null}
        <Pressable className="panda-updates__button" onClick={() => void check()} disabled={busy} aria-busy={busy}>
          <RefreshCw size={15} aria-hidden="true" />
          {state.status === 'error' ? 'Try again' : 'Check for updates'}
        </Pressable>
      </div>
    </section>
  );
}
