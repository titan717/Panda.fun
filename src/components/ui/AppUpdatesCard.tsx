import React from 'react';
import { m } from 'motion/react';
import { Pressable, useMotionPreference } from '../../motion';
import { CheckCircle2, Download, Loader2, RefreshCw, ShieldCheck, TriangleAlert, X, PackageCheck, Smartphone } from 'lucide-react';
import { useAppUpdates } from '../../lib/appUpdates';
import { statusMessage } from '../../lib/appUpdateState';
import './AppUpdatesCard.css';

const bytes = (n?: number) => !n ? '—' : n >= 104857600 ? (n / 1048576).toFixed(0) + ' MB' : (n / 1048576).toFixed(1) + ' MB';
const checkedAt = (n?: number) => n ? new Date(n).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Not checked yet';

export function AppUpdatesCard() {
  const { state, check, apply, cancel, install, openInstallPermissionSettings, later } = useAppUpdates();
  const motion = useMotionPreference();
  const busy = state.status === 'checking' || state.status === 'applying';
  const progress = Math.max(0, Math.min(100, state.progressPercent || 0));
  return (
    <section className="panda-update-module" aria-labelledby="panda-update-title">
      <div className="panda-update-module__top">
        <span className="panda-update-module__mark" aria-hidden="true"><Smartphone size={19} /></span>
        <div className="panda-update-module__heading">
          <span className="panda-update-module__eyebrow">PANDA.FUN / SOFTWARE</span>
          <h2 id="panda-update-title">App updates</h2>
          <p>{state.source === 'android' ? 'Installed version' : 'Web app version'} <strong>{state.currentVersion || 'Unknown'}</strong></p>
        </div>
        <span className="panda-update-module__version">PANDA.FUN</span>
      </div>
      <m.div key={state.status} className="panda-update-module__status" role="status" aria-live="polite"
        initial={false} animate={state.status === 'error' && motion === 'full' ? { x: [0, -4, 4, 0] } : { x: 0 }} transition={{ duration: .28 }}>
        {state.status === 'checking' || state.status === 'applying' ? <Loader2 className="is-spinning" size={18} /> :
          state.status === 'up-to-date' ? <CheckCircle2 size={18} /> :
          state.status === 'error' ? <TriangleAlert size={18} /> :
          state.status === 'ready-to-install' ? <PackageCheck size={18} /> :
          state.status === 'permission-required' ? <ShieldCheck size={18} /> : <Download size={18} />}
        <div>
          <strong>{state.status === 'checking' ? 'Checking' : state.status === 'up-to-date' ? 'You’re up to date' : state.status === 'available' ? 'Update available' : state.status === 'downloading' ? 'Downloading update' : state.status === 'ready-to-install' ? 'Ready to install' : state.status === 'permission-required' ? 'Permission needed' : state.status === 'error' ? 'Update failed' : state.status === 'applying' ? 'Applying update' : 'Stay current'}</strong>
          <p>{statusMessage(state)}</p>
          {state.status === 'up-to-date' && <small>Last checked {checkedAt(state.lastChecked)}</small>}
        </div>
      </m.div>
      {state.status === 'available' && <div className="panda-update-module__details">
        <div className="panda-update-module__version-line"><span>New version</span><strong>{state.availableVersion || 'Latest release'}</strong></div>
        {state.sizeBytes ? <div className="panda-update-module__version-line"><span>Download size</span><strong>{bytes(state.sizeBytes)}</strong></div> : null}
        {state.releaseNotes && <p className="panda-update-module__notes">{state.releaseNotes}</p>}
      </div>}
      {state.status === 'downloading' && <div className="panda-update-module__progress">
        <div className="panda-update-module__progress-label"><span>{progress}%</span><span>{bytes(state.downloadedBytes)} / {bytes(state.totalBytes)}</span></div>
        <div className="panda-update-module__track" role="progressbar" aria-label="Update download progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: progress + '%' }} /></div>
      </div>}
      {state.status === 'ready-to-install' && state.verifiedSha256 && <div className="panda-update-module__verified"><ShieldCheck size={16} /><div><strong>SHA-256 verified</strong><code>{state.verifiedSha256}</code></div></div>}
      {state.status === 'permission-required' && <p className="panda-update-module__permission">Enable “Allow from this source” in Android settings, then return here and tap Install.</p>}
      {state.status === 'error' && state.message && <p className="panda-update-module__error">{state.message}</p>}
      <div className="panda-update-module__actions">
        {state.status === 'available' && <><Pressable className="panda-update-module__button is-primary" onClick={() => void apply()}><Download size={16} /> Update now</Pressable><Pressable className="panda-update-module__button" onClick={later}>Later</Pressable></>}
        {state.status === 'downloading' && <Pressable className="panda-update-module__button" onClick={cancel}><X size={16} /> Cancel download</Pressable>}
        {state.status === 'ready-to-install' && <Pressable className="panda-update-module__button is-primary" onClick={install}><PackageCheck size={16} /> Install update</Pressable>}
        {state.status === 'permission-required' && <Pressable className="panda-update-module__button is-primary" onClick={openInstallPermissionSettings}>Allow installs from this source</Pressable>}
        {state.status === 'error' && <Pressable className="panda-update-module__button is-primary" onClick={() => void check()}><RefreshCw size={16} /> Retry</Pressable>}
        {(state.status === 'idle' || state.status === 'up-to-date' || state.status === 'checking') && <Pressable className="panda-update-module__button" onClick={() => void check()} disabled={busy} aria-busy={busy}><RefreshCw size={16} /> Check for updates</Pressable>}
      </div>
    </section>
  );
}
