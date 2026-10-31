import { describe, expect, it } from 'vitest';
import { initialUpdateState, isTerminalNativeUpdateEvent, parseNativeStatus, statusMessage, updateReducer } from './appUpdateState';

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
  });
});

describe('native status parsing', () => {
  it('maps every status the Android app can send', () => {
    expect(parseNativeStatus({ status: 'checking' }, 1)).toEqual({ type: 'check-started' });
    expect(parseNativeStatus({ status: 'up-to-date' }, 5)).toEqual({ type: 'up-to-date', at: 5 });
    expect(parseNativeStatus({ status: 'downloading' }, 1)).toEqual({ type: 'applying' });
    expect(parseNativeStatus({ status: 'available', versionName: '1.2.3', releaseNotes: 'n', mandatory: true }, 7)).toEqual({
      type: 'available', at: 7, versionName: '1.2.3', releaseNotes: 'n', mandatory: true,
    });
    expect(parseNativeStatus({ status: 'error', message: 'nope' }, 9)).toEqual({ type: 'error', at: 9, message: 'nope' });
  });

  it('ignores malformed or unknown payloads', () => {
    expect(parseNativeStatus(null, 1)).toBeNull();
    expect(parseNativeStatus('x', 1)).toBeNull();
    expect(parseNativeStatus({ status: 'weird' }, 1)).toBeNull();
    expect(parseNativeStatus({}, 1)).toBeNull();
  });
});

describe('native update response lifecycle', () => {
  it('does not treat checking or downloading as a completed response', () => {
    expect(isTerminalNativeUpdateEvent(parseNativeStatus({ status: 'checking' }, 1)!)).toBe(false);
    expect(isTerminalNativeUpdateEvent(parseNativeStatus({ status: 'downloading' }, 1)!)).toBe(false);
  });

  it('clears the response wait after available, up-to-date, downloaded or error', () => {
    for (const status of ['available', 'up-to-date', 'downloaded', 'error']) {
      expect(isTerminalNativeUpdateEvent(parseNativeStatus({ status }, 1)!)).toBe(true);
    }
  });

  it('announces a downloaded update without presenting it as still waiting to download', () => {
    const event = parseNativeStatus({ status: 'downloaded', versionName: '0.0.9' }, 9);
    expect(event).toEqual({ type: 'downloaded', at: 9, versionName: '0.0.9' });
    const state = updateReducer(initialUpdateState('android'), event!);
    expect(state.status).toBe('downloaded');
    expect(statusMessage(state)).toContain('installer prompt');
  });
});
