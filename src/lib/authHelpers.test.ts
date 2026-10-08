import { describe, expect, it } from 'vitest';
import { getAuthErrorMessage, getProfileName, toUserProfile } from './authHelpers';

describe('auth helpers', () => {
  it('maps common Firebase auth failures to useful user-facing messages', () => {
    expect(getAuthErrorMessage('auth/invalid-credential', 'signin')).toBe('That email or password is incorrect.');
    expect(getAuthErrorMessage('auth/email-already-in-use', 'signup')).toBe('An account with this email already exists.');
    expect(getAuthErrorMessage('auth/popup-blocked', 'signin')).toBe('Google sign-in was blocked by the browser.');
  });

  it('uses the chosen name first and falls back to account identity', () => {
    expect(getProfileName({ displayName: 'Existing', email: 'one@example.com' }, 'Chosen')).toBe('Chosen');
    expect(getProfileName({ displayName: '', email: 'one@example.com' })).toBe('one');
    expect(getProfileName({ displayName: null, email: null })).toBe('Panda');
  });

  it('creates a Firestore-safe profile payload without privileged fields', () => {
    const payload = toUserProfile(
      { uid: 'uid-1', email: 'one@example.com', displayName: 'One', photoURL: 'photo' },
      '2026-10-08T12:00:00.000Z'
    );
    expect(payload).toEqual({
      uid: 'uid-1',
      email: 'one@example.com',
      displayName: 'One',
      photoURL: 'photo',
      createdAt: '2026-10-08T12:00:00.000Z',
    });
    expect(Object.keys(payload)).not.toContain('admin');
  });
});
