import { auth } from './firebase';
const ACTIVE_PROFILE_PREFIX = 'panda_active_profile_';
const INITIALIZED_PREFIX = 'panda_profile_initialized_';

export function getActiveProfileId(userId: string): string {
  try {
    return localStorage.getItem(ACTIVE_PROFILE_PREFIX + userId) || '';
  } catch {
    return '';
  }
}

export function setActiveProfileId(userId: string, profileId: string): void {
  try {
    const key = ACTIVE_PROFILE_PREFIX + userId;
    if (profileId) localStorage.setItem(key, profileId);
    else localStorage.removeItem(key);
    window.dispatchEvent(new CustomEvent('panda_profile_changed', { detail: { profileId } }));
  } catch {}
}

export function getActiveProfileStorageKey(baseKey: string): string {
  try {
    const userId = auth.currentUser?.uid || '';
    const profileId = userId ? getActiveProfileId(userId) : '';
    return profileId ? baseKey + '__profile_' + profileId : baseKey;
  } catch {
    return baseKey;
  }
}

export function getProfileStorageKey(userId: string, profileId: string, baseKey: string): string {
  return baseKey + '__profile_' + userId + '_' + profileId;
}

export function setProfileUserHint(userId: string): void {
  try {
    localStorage.setItem('panda_profile_user_hint', userId);
  } catch {}
}

export function initializeProfileStorage(
  userId: string,
  profileId: string,
  inheritExisting: boolean,
  baseKeys: string[],
): void {
  try {
    setProfileUserHint(userId);
    const initializedKey = INITIALIZED_PREFIX + userId + '__' + profileId;
    if (localStorage.getItem(initializedKey) === '1') return;

    for (const baseKey of baseKeys) {
      const scoped = getProfileStorageKey(userId, profileId, baseKey);
      if (localStorage.getItem(scoped) !== null) continue;

      const existing = localStorage.getItem(baseKey);
      if (inheritExisting && existing !== null) {
        localStorage.setItem(scoped, existing);
      } else if (baseKey === 'kinoma_history' || baseKey === 'animora_history') {
        localStorage.setItem(scoped, '[]');
      } else if (baseKey === 'kinoma_watchlist' || baseKey === 'kinoma_completed' || baseKey === 'kinoma_favorites') {
        localStorage.setItem(scoped, '[]');
      } else if (baseKey === 'kinoma_ep_progress') {
        localStorage.setItem(scoped, '{}');
      } else if (baseKey === 'kinoma_meta_cache') {
        localStorage.setItem(scoped, '{}');
      }
    }

    localStorage.setItem(initializedKey, '1');
  } catch {}
}

export function clearProfileUserHint(): void {
  try {
    localStorage.removeItem('panda_profile_user_hint');
  } catch {}
}
