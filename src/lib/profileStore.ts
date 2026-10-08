import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase';

export type PandaProfile = {
  id: string;
  name: string;
  avatar: string;
  pinHash?: string;
  movieGenres: string[];
  seriesGenres: string[];
  createdAt: string;
  updatedAt: string;
};

export const PROFILE_AVATARS = [
  { id: 'panda', emoji: '🐼', label: 'Panda' },
  { id: 'fox', emoji: '🦊', label: 'Fox' },
  { id: 'cat', emoji: '🐱', label: 'Cat' },
  { id: 'bear', emoji: '🐻', label: 'Bear' },
  { id: 'koala', emoji: '🐨', label: 'Koala' },
  { id: 'rabbit', emoji: '🐰', label: 'Rabbit' },
  { id: 'tiger', emoji: '🐯', label: 'Tiger' },
  { id: 'dog', emoji: '🐶', label: 'Dog' },
] as const;

export const MOVIE_GENRES = [
  'Comedy', 'Action', 'Drama', 'Horror', 'Romance', 'Adventure',
  'Science Fiction', 'Thriller', 'Animation', 'Crime', 'Fantasy',
  'Mystery', 'Documentary', 'Family', 'History', 'Music', 'War', 'Western',
];

export const SERIES_GENRES = [
  'Comedy', 'Drama', 'Action & Adventure', 'Crime', 'Sci-Fi & Fantasy',
  'Mystery', 'Animation', 'Family', 'Documentary', 'Kids', 'War & Politics',
  'Western',
];

const PROFILE_LIMIT = 6;
const ACTIVE_PROFILE_PREFIX = 'panda_active_profile_';
const LOCAL_PROFILES_PREFIX = 'panda_profiles_';

export function createProfileId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return 'profile_' + crypto.randomUUID();
  }
  return 'profile_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function normalizeProfile(profile: Partial<PandaProfile> & Pick<PandaProfile, 'id'>): PandaProfile {
  const now = new Date().toISOString();
  return {
    id: profile.id,
    name: String(profile.name || 'Panda').trim().slice(0, 20) || 'Panda',
    avatar: String(profile.avatar || 'panda'),
    pinHash: profile.pinHash || undefined,
    movieGenres: Array.isArray(profile.movieGenres) ? profile.movieGenres.slice(0, 3) : [],
    seriesGenres: Array.isArray(profile.seriesGenres) ? profile.seriesGenres.slice(0, 3) : [],
    createdAt: profile.createdAt || now,
    updatedAt: profile.updatedAt || now,
  };
}

export function isValidProfilePin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

async function hashPin(pin: string): Promise<string> {
  if (!isValidProfilePin(pin)) throw new Error('PIN must be exactly 4 digits.');
  if (typeof crypto === 'undefined' || !crypto.subtle) throw new Error('PIN locking is unavailable in this browser.');
  const bytes = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyProfilePin(profile: PandaProfile, pin: string): Promise<boolean> {
  if (!profile.pinHash) return true;
  return (await hashPin(pin)) === profile.pinHash;
}

export async function setProfilePin(profile: PandaProfile, pin: string): Promise<PandaProfile> {
  const trimmed = pin.trim();
  return normalizeProfile({ ...profile, pinHash: await hashPin(trimmed), updatedAt: new Date().toISOString() });
}

export function clearProfilePin(profile: PandaProfile): PandaProfile {
  return normalizeProfile({ ...profile, pinHash: undefined, updatedAt: new Date().toISOString() });
}

function localKey(userId: string): string {
  return LOCAL_PROFILES_PREFIX + userId;
}

function getLocalProfiles(userId: string): PandaProfile[] {
  try {
    const raw = localStorage.getItem(localKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((profile) => normalizeProfile(profile)).slice(0, PROFILE_LIMIT) : [];
  } catch {
    return [];
  }
}

function setLocalProfiles(userId: string, profiles: PandaProfile[]): void {
  try {
    localStorage.setItem(localKey(userId), JSON.stringify(profiles.slice(0, PROFILE_LIMIT)));
  } catch {}
}

export async function listProfiles(userId: string): Promise<PandaProfile[]> {
  const local = getLocalProfiles(userId);
  try {
    const snapshot = await getDocs(collection(db, 'users', userId, 'profiles'));
    const remote = snapshot.docs.map((item) => normalizeProfile({
      id: item.id,
      ...(item.data() as Partial<PandaProfile>),
    }));
    const merged = new Map(local.map((profile) => [profile.id, profile]));
    remote.forEach((profile) => merged.set(profile.id, profile));
    const profiles = [...merged.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, PROFILE_LIMIT);
    setLocalProfiles(userId, profiles);
    return profiles;
  } catch {
    return local;
  }
}

export async function saveProfile(userId: string, profile: PandaProfile): Promise<PandaProfile> {
  const normalized = normalizeProfile(profile);
  const profiles = getLocalProfiles(userId).filter((item) => item.id !== normalized.id);
  setLocalProfiles(userId, [normalized, ...profiles]);
  try {
    await setDoc(doc(db, 'users', userId, 'profiles', normalized.id), normalized, { merge: true });
  } catch {
    // Local persistence keeps the profile usable until Firestore rules are available.
  }
  return normalized;
}

export async function deleteProfile(userId: string, profileId: string): Promise<void> {
  const profiles = getLocalProfiles(userId).filter((item) => item.id !== profileId);
  setLocalProfiles(userId, profiles);
  try {
    await deleteDoc(doc(db, 'users', userId, 'profiles', profileId));
  } catch {}
  if (getActiveProfileId(userId) === profileId) {
    setActiveProfileId(userId, profiles[0]?.id || '');
  }
}

export function getActiveProfileId(userId: string): string {
  try {
    return localStorage.getItem(ACTIVE_PROFILE_PREFIX + userId) || '';
  } catch {
    return '';
  }
}

export function setActiveProfileId(userId: string, profileId: string): void {
  try {
    if (profileId) localStorage.setItem(ACTIVE_PROFILE_PREFIX + userId, profileId);
    else localStorage.removeItem(ACTIVE_PROFILE_PREFIX + userId);
    window.dispatchEvent(new CustomEvent('panda_profile_changed', { detail: { profileId } }));
  } catch {}
}
