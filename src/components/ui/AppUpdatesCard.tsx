import React from 'react';
import { CheckCircle2, Download, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import { useAppUpdates } from '../../lib/appUpdates';
import { statusMessage } from '../../lib/appUpdateState';

export function AppUpdatesCard() {
  const { state, check, apply } = useAppUpdates();
  const busy = state.status === 'checking' || state.status === 'applying';
  const isAndroid = state.source === 'android';
  const Icon =
    state.status === 'up-to-date' ? CheckCircle2 : state.status === 'error' ? TriangleAlert : state.status === 'available' ? Download : RefreshCw;

  return (
    <section className="panda-updates" aria-labelledby="panda-updates-title">
      <div className="panda-updates__icon" aria-hidden="true">
        {busy ? <Loader2 size={18} className="panda-updates__spin" /> : <Icon size={18} />}
      </div>

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
          <button type="button" className="panda-updates__button is-primary" onClick={() => void apply()} disabled={busy}>
            <Download size={15} aria-hidden="true" />
            {isAndroid ? 'Download update' : 'Reload to update'}
          </button>
        ) : null}
        <button type="button" className="panda-updates__button" onClick={() => void check()} disabled={busy} aria-busy={busy}>
          <RefreshCw size={15} aria-hidden="true" />
          {state.status === 'error' ? 'Try again' : 'Check for updates'}
        </button>
      </div>
    </section>
  );
}
