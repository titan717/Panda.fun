import { describe, expect, it } from 'vitest';
import { initialUpdateState, parseNativeStatus, statusMessage, updateReducer } from './appUpdateState';

describe('app update state machine', () => {
  it('walks idle -> checking -> up-to-date and records the check time', () => {
    let s = initialUpdateState('web');
    s = updateReducer(s, { type: 'check-started' });
    expect(s.status).toBe('checking');
    expect(statusMessage(s)).toBe('Checking for updates…');
    s = updateReducer(s, { type: 'up-to-date', at: 42 });
    expect(s.status).toBe('up-to-date');
    expect(s.lastChecked).toBe(42);
    expect(statusMessage(s)).toContain('latest version');
  });

  it('reports an available update with version and notes, then applying', () => {
    let s = initialUpdateState('android');
    s = updateReducer(s, { type: 'available', at: 1, versionName: '0.0.9', releaseNotes: 'Fixes', mandatory: false });
    expect(s.status).toBe('available');
    expect(statusMessage(s)).toBe('Version 0.0.9 is available.');
    expect(s.releaseNotes).toBe('Fixes');
    s = updateReducer(s, { type: 'applying' });
    expect(statusMessage(s)).toBe('Downloading the update…');
  });

  it('uses web wording while applying on the web and a generic available message without a version', () => {
    let s = updateReducer(initialUpdateState('web'), { type: 'available', at: 1 });
    expect(statusMessage(s)).toBe('A new version is available.');
    s = updateReducer(s, { type: 'applying' });
    expect(statusMessage(s)).toBe('Updating Panda.fun…');
  });

  it('shows a friendly error with a default and recovers on retry', () => {
    let s = updateReducer(initialUpdateState('web'), { type: 'error', at: 1 });
    expect(s.status).toBe('error');
    expect(statusMessage(s)).toContain('Something went wrong');
    s = updateReducer(s, { type: 'error', at: 2, message: 'Offline' });
    expect(statusMessage(s)).toBe('Offline');
    s = updateReducer(s, { type: 'check-started' });
    expect(s.status).toBe('checking');
    expect(s.message).toBeUndefined();
  });

  it('keeps the idle hand-off message for older Android builds', () => {
    const s = updateReducer(initialUpdateState('android'), { type: 'handed-off', message: 'Check started.' });
    expect(s.status).toBe('idle');
    expect(statusMessage(s)).toBe('Check started.');
  });

  it('clears stale update details once the app is up to date', () => {
    let s = updateReducer(initialUpdateState('android'), { type: 'available', at: 1, versionName: '9', releaseNotes: 'x' });
    s = updateReducer(s, { type: 'up-to-date', at: 2 });
    expect(s.availableVersion).toBeUndefined();
    expect(s.releaseNotes).toBeUndefined();
    expect(s.sizeBytes).toBeUndefined();
    expect(s.verifiedSha256).toBeUndefined();
  });
});

describe('native status parsing', () => {
  it('maps every status the Android app can send', () => {
    expect(parseNativeStatus({ status: 'checking' }, 1)).toEqual({ type: 'check-started' });
    expect(parseNativeStatus({ status: 'up-to-date' }, 5)).toEqual({ type: 'up-to-date', at: 5 });
    expect(parseNativeStatus({ status: 'downloading', percent: 42, downloadedBytes: 420, totalBytes: 1000 }, 1)).toEqual({ type: 'download-progress', percent: 42, downloadedBytes: 420, totalBytes: 1000 });
    expect(parseNativeStatus({ status: 'available', versionName: '1.2.3', releaseNotes: 'n', mandatory: true, sizeBytes: 2048 }, 7)).toEqual({
      type: 'available', at: 7, versionName: '1.2.3', releaseNotes: 'n', mandatory: true, sizeBytes: 2048,
    });
    expect(parseNativeStatus({ status: 'ready-to-install', sha256: 'a'.repeat(64) }, 8)).toEqual({ type: 'ready-to-install', at: 8, sha256: 'a'.repeat(64) });
    expect(parseNativeStatus({ status: 'permission-required', message: 'Allow installs' }, 9)).toEqual({ type: 'permission-required', message: 'Allow installs' });
    expect(parseNativeStatus({ status: 'error', message: 'nope' }, 10)).toEqual({ type: 'error', at: 10, message: 'nope' });
  });

  it('ignores malformed or unknown payloads', () => {
    expect(parseNativeStatus(null, 1)).toBeNull();
    expect(parseNativeStatus('x', 1)).toBeNull();
    expect(parseNativeStatus({ status: 'weird' }, 1)).toBeNull();
    expect(parseNativeStatus({}, 1)).toBeNull();
  });
});


describe('native update download lifecycle', () => {
  it('retains byte counts and clamps progress to a valid percentage', () => {
    let state = initialUpdateState('android');
    state = updateReducer(state, { type: 'download-progress', percent: 140, downloadedBytes: 1500, totalBytes: 1000 });
    expect(state.status).toBe('downloading');
    expect(state.progressPercent).toBe(100);
    expect(state.downloadedBytes).toBe(1500);
    expect(state.totalBytes).toBe(1000);
  });

  it('requires a verified checksum before the UI can offer installation', () => {
    let state = initialUpdateState('android');
    state = updateReducer(state, { type: 'available', at: 1, versionName: '1.0.0', sha256: 'a'.repeat(64) });
    state = updateReducer(state, { type: 'ready-to-install', at: 2, sha256: 'a'.repeat(64) });
    expect(state.status).toBe('ready-to-install');
    expect(state.verifiedSha256).toBe('a'.repeat(64));
    expect(statusMessage(state)).toContain('verified');
  });

  it('surfaces the install-source permission state and retryable error', () => {
    let state = updateReducer(initialUpdateState('android'), { type: 'permission-required', message: 'Allow installs' });
    expect(state.status).toBe('permission-required');
    expect(statusMessage(state)).toBe('Allow installs');
    state = updateReducer(state, { type: 'error', at: 3, message: 'Download failed' });
    expect(state.status).toBe('error');
    expect(statusMessage(state)).toBe('Download failed');
  });
});
