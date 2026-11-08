import { useSyncExternalStore } from "react";
import type { MediaType, PandaItem, SourceId } from "./types";

/**
 * Local-first persistence. Everything lives in localStorage under `panda:v1:*`, scoped per profile.
 * No account, no tracking, nothing leaves the device.
 */
const NS = "panda:v1";

export type AvatarKind = "kids" | "smile" | "panda" | "star" | "wave";
export interface Profile {
  id: string;
  name: string;
  avatar: AvatarKind;
  kids: boolean;
  createdAt: number;
}

export interface HistoryEntry {
  item: PandaItem;
  /** for TV: the episode being watched */
  season?: number;
  episode?: number;
  episodeTitle?: string | null;
  position: number;
  duration: number;
  updatedAt: number;
  completed: boolean;
}

export type Rating = "love" | "like" | "dislike";

export interface Prefs {
  preferredSource: SourceId;
  autoplayNext: boolean;
  trailerAutoplay: boolean;
  top10Lang: string;
  volume: number;
  kidsPin: string | null;
  layout: "auto" | "tv" | "mobile";
  notifications: boolean;
  notifiedTag: string | null;
  /** Trailers play with sound once audio is unlocked by the first remote press or tap. */
  trailerSound: boolean;
  /** Trailer volume 0..1. */
  trailerVolume: number;
  /** Seconds a title must stay focused before its trailer starts. */
  trailerDelay: number;
  /** Preferred stream quality (TV PLAYER §20.9); passed to sources that accept a hint. */
  quality: "auto" | "2160" | "1080" | "720" | "480";
  /** TV overscan compensation: the whole UI is drawn at this percentage of the screen. */
  uiScale: 90 | 95 | 100;
  /** Turn off animations, zooms and trailer fades regardless of the system setting. */
  reduceMotion: boolean;
  /** Brighter secondary text, opaque panels and a thicker focus ring. */
  highContrast: boolean;
  textSize: "default" | "large" | "larger";
}

/** Preferences shared by every profile on the device; everything else is saved per profile. */
export const DEVICE_PREFS = ["layout", "kidsPin", "notifiedTag", "notifications"] as const;
type DeviceKey = (typeof DEVICE_PREFS)[number];
const isDeviceKey = (k: string): k is DeviceKey => (DEVICE_PREFS as readonly string[]).includes(k);

interface ProfileData {
  watchlist: PandaItem[];
  history: Record<string, HistoryEntry>;
  ratings: Record<string, Rating>;
  recentSearches: string[];
}

interface State {
  profiles: Profile[];
  activeProfileId: string | null;
  prefs: Prefs;
  data: Record<string, ProfileData>;
  /** Per-profile overrides of `prefs` (all non-device keys). */
  profilePrefs: Record<string, Partial<Prefs>>;
}

const defaultPrefs: Prefs = {
  preferredSource: "cinesrc",
  autoplayNext: true,
  trailerAutoplay: true,
  top10Lang: "ml",
  volume: 1,
  kidsPin: null,
  layout: "auto",
  notifications: false,
  notifiedTag: null,
  trailerSound: true,
  trailerVolume: 0.8,
  trailerDelay: 5,
  quality: "auto",
  uiScale: 100,
  reduceMotion: false,
  highContrast: false,
  textSize: "default"
};

const emptyData = (): ProfileData => ({ watchlist: [], history: {}, ratings: {}, recentSearches: [] });

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function defaultState(): State {
  const me: Profile = { id: uid(), name: "You", avatar: "smile", kids: false, createdAt: Date.now() };
  const kids: Profile = { id: uid(), name: "Kids", avatar: "kids", kids: true, createdAt: Date.now() };
  return { profiles: [kids, me], activeProfileId: null, prefs: defaultPrefs, data: { [me.id]: emptyData(), [kids.id]: emptyData() }, profilePrefs: {} };
}

function safeStorage(): Storage | null {
  try {
    const s = window.localStorage;
    s.setItem(`${NS}:probe`, "1");
    s.removeItem(`${NS}:probe`);
    return s;
  } catch {
    return null;
  }
}

const storage = typeof window !== "undefined" ? safeStorage() : null;

function load(): State {
  const raw = storage?.getItem(`${NS}:state`);
  if (!raw) return defaultState();
  try {
    const parsed = JSON.parse(raw) as Partial<State>;
    if (!parsed.profiles?.length) return defaultState();
    const data: Record<string, ProfileData> = {};
    for (const p of parsed.profiles) data[p.id] = { ...emptyData(), ...(parsed.data?.[p.id] ?? {}) };
    const prefs = { ...defaultPrefs, ...(parsed.prefs ?? {}) };
    // v1.0.2: sources outside the registry (CineSrc, Vidy) fall back to CineSrc
    if (prefs.preferredSource !== "cinesrc" && prefs.preferredSource !== "vidy") prefs.preferredSource = "cinesrc";
    const profilePrefs: Record<string, Partial<Prefs>> = {};
    for (const p of parsed.profiles) {
      const own = { ...(parsed.profilePrefs?.[p.id] ?? {}) };
      if (own.preferredSource && own.preferredSource !== "cinesrc" && own.preferredSource !== "vidy") delete own.preferredSource;
      profilePrefs[p.id] = own;
    }
    return { profiles: parsed.profiles, activeProfileId: parsed.activeProfileId ?? null, prefs, data, profilePrefs };
  } catch {
    return defaultState();
  }
}

let state: State = load();
const listeners = new Set<() => void>();
let writeTimer: ReturnType<typeof setTimeout> | null = null;

function persist() {
  if (!storage) return;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try { storage.setItem(`${NS}:state`, JSON.stringify(state)); } catch { /* storage full: keep in memory */ }
  }, 120);
}

function set(next: State) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

export function flushStore() {
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
  try { storage?.setItem(`${NS}:state`, JSON.stringify(state)); } catch { /* ignore */ }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushStore);
  window.addEventListener("storage", (e) => {
    if (e.key === `${NS}:state`) { state = load(); listeners.forEach((l) => l()); }
  });
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
export const getState = () => state;

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

const activeId = () => state.activeProfileId ?? state.profiles.find((p) => !p.kids)?.id ?? state.profiles[0]!.id;
const activeData = () => state.data[activeId()] ?? emptyData();
function patchActive(fn: (d: ProfileData) => ProfileData) {
  const id = activeId();
  set({ ...state, data: { ...state.data, [id]: fn(state.data[id] ?? emptyData()) } });
}

/* ---------- selectors ---------- */
export const selectProfile = (s: State) => s.profiles.find((p) => p.id === s.activeProfileId) ?? null;
export const selectData = (s: State) => s.data[s.activeProfileId ?? ""] ?? s.data[s.profiles.find((p) => !p.kids)?.id ?? ""] ?? EMPTY;
const EMPTY = emptyData();

export function useProfile() { return useStore(selectProfile); }
/** Effective preferences for the active profile (device prefs + that profile's own choices). */
const prefsMemo = new WeakMap<Prefs, WeakMap<Partial<Prefs>, Prefs>>();
const NO_OVERRIDES: Partial<Prefs> = {};
export function selectPrefs(s: State): Prefs {
  const id = s.activeProfileId ?? s.profiles.find((p) => !p.kids)?.id ?? "";
  const own = s.profilePrefs[id] ?? NO_OVERRIDES;
  let inner = prefsMemo.get(s.prefs);
  if (!inner) { inner = new WeakMap(); prefsMemo.set(s.prefs, inner); }
  let merged = inner.get(own);
  if (!merged) { merged = { ...s.prefs, ...own }; inner.set(own, merged); }
  return merged;
}
export function usePrefs() { return useStore(selectPrefs); }
/** Non-hook read of the active profile's effective preferences. */
export const getPrefs = () => selectPrefs(state);
export function useWatchlist() { return useStore((s) => selectData(s).watchlist); }
export function useInWatchlist(id: string) { return useStore((s) => selectData(s).watchlist.some((i) => i.id === id)); }
export function useRating(id: string) { return useStore((s) => selectData(s).ratings[id] ?? null); }
export function useRecentSearches() { return useStore((s) => selectData(s).recentSearches); }
export function useHistoryMap() { return useStore((s) => selectData(s).history); }
export function useHistoryEntry(id: string) { return useStore((s) => selectData(s).history[id] ?? null); }

/** Continue Watching: unfinished entries, newest first. */
export function continueWatching(history: Record<string, HistoryEntry>) {
  return Object.values(history).filter((h) => !h.completed && h.position > 30).sort((a, b) => b.updatedAt - a.updatedAt);
}
/** Shows/movies the profile has watched (any progress), newest first. */
export function watchedTitles(history: Record<string, HistoryEntry>) {
  return Object.values(history).sort((a, b) => b.updatedAt - a.updatedAt).map((h) => h.item);
}

/* ---------- actions ---------- */
export const actions = {
  selectProfile(id: string) { set({ ...state, activeProfileId: id }); },
  signOut() { set({ ...state, activeProfileId: null }); },
  addProfile(name: string, avatar: AvatarKind, kids: boolean) {
    const p: Profile = { id: uid(), name: name.trim().slice(0, 20) || "Viewer", avatar, kids, createdAt: Date.now() };
    set({ ...state, profiles: [...state.profiles, p].slice(0, 6), data: { ...state.data, [p.id]: emptyData() } });
    return p;
  },
  updateProfile(id: string, patch: Partial<Pick<Profile, "name" | "avatar" | "kids">>) {
    set({ ...state, profiles: state.profiles.map((p) => (p.id === id ? { ...p, ...patch, name: (patch.name ?? p.name).trim().slice(0, 20) || p.name } : p)) });
  },
  deleteProfile(id: string) {
    if (state.profiles.length <= 1) return;
    const data = { ...state.data };
    delete data[id];
    const profilePrefs = { ...state.profilePrefs };
    delete profilePrefs[id];
    set({ ...state, profiles: state.profiles.filter((p) => p.id !== id), data, profilePrefs, activeProfileId: state.activeProfileId === id ? null : state.activeProfileId });
  },
  toggleWatchlist(item: PandaItem) {
    const exists = activeData().watchlist.some((i) => i.id === item.id);
    patchActive((d) => ({ ...d, watchlist: exists ? d.watchlist.filter((i) => i.id !== item.id) : [slim(item), ...d.watchlist].slice(0, 200) }));
    return !exists;
  },
  rate(id: string, rating: Rating | null) {
    patchActive((d) => {
      const ratings = { ...d.ratings };
      if (rating) ratings[id] = rating; else delete ratings[id];
      return { ...d, ratings };
    });
  },
  addRecentSearch(q: string) {
    const query = q.trim();
    if (query.length < 2) return;
    patchActive((d) => ({ ...d, recentSearches: [query, ...d.recentSearches.filter((x) => x.toLowerCase() !== query.toLowerCase())].slice(0, 8) }));
  },
  clearRecentSearches() { patchActive((d) => ({ ...d, recentSearches: [] })); },
  clearHistory() { patchActive((d) => ({ ...d, history: {} })); },
  saveProgress(item: PandaItem, p: { position: number; duration: number; season?: number; episode?: number; episodeTitle?: string | null }) {
    if (!Number.isFinite(p.position) || p.position < 0) return;
    const completed = p.duration > 0 && p.position / p.duration > 0.94;
    patchActive((d) => ({
      ...d,
      history: { ...d.history, [item.id]: { item: slim(item), season: p.season, episode: p.episode, episodeTitle: p.episodeTitle ?? null, position: Math.round(p.position), duration: Math.round(p.duration), completed, updatedAt: Date.now() } }
    }));
  },
  removeHistory(id: string) {
    patchActive((d) => { const history = { ...d.history }; delete history[id]; return { ...d, history }; });
  },
  /** Device keys are saved for everyone; the rest only for the active profile. */
  setPrefs(patch: Partial<Prefs>) {
    const device: Partial<Prefs> = {}; const own: Partial<Prefs> = {};
    for (const [k, v] of Object.entries(patch)) (isDeviceKey(k) ? device : own)[k as keyof Prefs] = v as never;
    const id = activeId();
    set({
      ...state,
      prefs: Object.keys(device).length ? { ...state.prefs, ...device } : state.prefs,
      profilePrefs: Object.keys(own).length ? { ...state.profilePrefs, [id]: { ...(state.profilePrefs[id] ?? {}), ...own } } : state.profilePrefs
    });
  }
};

/** Keep stored items small: drop nothing the UI needs but never store whole detail payloads. */
function slim(i: PandaItem): PandaItem {
  return { id: i.id, tmdbId: i.tmdbId, type: i.type, title: i.title, year: i.year, rating: i.rating, poster: i.poster, posterLarge: i.posterLarge, backdrop: i.backdrop, backdropLarge: i.backdropLarge, overview: i.overview, genres: i.genres, language: i.language, releaseDate: i.releaseDate, logo: i.logo ?? null };
}

export function itemKey(type: MediaType, tmdbId: number) { return `${type}:${tmdbId}`; }
