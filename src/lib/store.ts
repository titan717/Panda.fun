import { useSyncExternalStore } from "react";
import type { MediaType, PandaItem, PreferredSource } from "./types";

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
  /** The previous episode was finished and this one is queued (blueprint 10.3 "Next Episode"). */
  upNext?: boolean;
  /** Continue Watching 2.0: progress of every episode watched, keyed "season:episode". */
  episodes?: Record<string, EpisodeProgress>;
  /** The finished episode's successor had not aired yet; it joins Continue Watching on its air date. */
  pending?: { season: number; episode: number; airDate: string } | null;
  /** Derived (never stored): a pending episode that has now aired. */
  newEpisode?: boolean;
}

export interface EpisodeProgress { p: number; d: number; done: boolean; at: number }
export const epKey = (season: number, episode: number) => `${season}:${episode}`;
const MAX_EPISODES = 200;

function withEpisode(prev: Record<string, EpisodeProgress> | undefined, s: number | undefined, e: number | undefined, ep: EpisodeProgress) {
  if (!s || !e) return prev;
  const next = { ...(prev ?? {}), [epKey(s, e)]: ep };
  const keys = Object.keys(next);
  if (keys.length <= MAX_EPISODES) return next;
  // keep the most recently touched episodes
  return Object.fromEntries(keys.map((k) => [k, next[k]!] as const).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_EPISODES));
}

/** Episode progress for a title, falling back to the entry's own episode for data saved before v1.1.4. */
export function episodeProgress(h: HistoryEntry | null | undefined, s: number, e: number): EpisodeProgress | null {
  if (!h) return null;
  const own = h.episodes?.[epKey(s, e)];
  if (own) return own;
  if (h.season === s && h.episode === e && !h.upNext) return { p: h.position, d: h.duration, done: h.completed, at: h.updatedAt };
  return null;
}

const aired = (date: string, now: number) => { const t = Date.parse(date); return Number.isFinite(t) && t <= now; };

export type Rating = "love" | "like" | "dislike";

export interface Prefs {
  preferredSource: PreferredSource;
  /** v1.2.0: the old CineSrc default moved to "auto" once (D-116). */
  sourceAuto?: boolean;
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
  /** Playback speed (Player 2.0); applied to sources that accept commands. */
  playbackSpeed: number;
  /** Ask the source to skip intros and recaps it detects (CineSrc `autoskip`). */
  autoSkipIntro: boolean;
  /** Settings › Data & storage › Preload titles (v1.1.6, D-83). */
  preloadMode: "smart" | "wifi" | "off";
  /** Settings › Personalize Home (v1.1.9): section order and hidden sections or rows ("rail:<id>"). */
  homeOrder: string[];
  homeHidden: string[];
  /** Card size: the blueprint's "standard", or "compact" for more titles per row. */
  density: "standard" | "compact";
  /** Play trailers behind rows as well as on the hero and Details. */
  rowTrailers: boolean;
  /** Subtitles (v1.2.1), saved per profile: when captions turn on by themselves, languages and look. */
  subtitleMode: "off" | "foreign" | "always";
  subtitleLang: string;
  subtitleLang2: string | null;
  subtitleSdh: boolean;
  subtitleSize: "small" | "medium" | "large" | "xlarge";
  subtitleStyle: "shadow" | "box" | "yellow" | "outline";
  /** v1.2.2: ask "Are you still watching?" after this many episodes in a row (0 = never). */
  stillAfter: number;
  /** v1.2.2: phone and tablet swipe gestures in the player (volume, brightness, seek, hold for 2×). */
  gestures: boolean;
  /** v1.2.2: hide stills and descriptions of episodes the profile has not watched yet. */
  hideSpoilers: boolean;
  /** v1.2.2: go to picture-in-picture when you leave the app during playback (Android phones and tablets). */
  autoPip: boolean;
}

/** Preferences shared by every profile on the device; everything else is saved per profile. */
export const DEVICE_PREFS = ["layout", "kidsPin", "notifiedTag", "notifications"] as const;
type DeviceKey = (typeof DEVICE_PREFS)[number];
const isDeviceKey = (k: string): k is DeviceKey => (DEVICE_PREFS as readonly string[]).includes(k);

/** A profile's own named list (Watchlist 2.0, v1.1.3). Items are stored newest-first, like the Watchlist. */
export interface UserList {
  id: string;
  name: string;
  items: PandaItem[];
  createdAt: number;
  updatedAt: number;
}

export const MAX_LISTS = 12;
const MAX_LIST_ITEMS = 200;

export interface ProfileData {
  watchlist: PandaItem[];
  lists: UserList[];
  history: Record<string, HistoryEntry>;
  ratings: Record<string, Rating>;
  recentSearches: string[];
  /** Titles opened from Search, newest first (blueprint 13.2 "Recent Searches" thumbnails). */
  recentTitles: PandaItem[];
  /** "Remind Me" titles that are not out yet (v1.1.7), newest first. */
  reminders: PandaItem[];
  /** When the profile last opened Coming Up; alerts after this count as new. */
  alertsSeenAt: number;
  /** Alert keys already shown as a system notification, so each one is sent once. */
  alerted: string[];
}

export interface State {
  profiles: Profile[];
  activeProfileId: string | null;
  prefs: Prefs;
  data: Record<string, ProfileData>;
  /** Per-profile overrides of `prefs` (all non-device keys). */
  profilePrefs: Record<string, Partial<Prefs>>;
}

/** v1.2.0: "auto" (community ranking) joins the fixed choices; anything else falls back to auto. */
const VALID_SOURCES = new Set<string>(["auto", "cinesrc", "vidy", "vidyanime", "vidlink"]);

const defaultPrefs: Prefs = {
  preferredSource: "auto",
  sourceAuto: true,
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
  textSize: "default",
  playbackSpeed: 1,
  autoSkipIntro: false,
  preloadMode: "smart",
  homeOrder: [],
  homeHidden: [],
  density: "standard",
  rowTrailers: true,
  subtitleMode: "foreign",
  subtitleLang: "en",
  subtitleLang2: null,
  subtitleSdh: false,
  subtitleSize: "medium",
  subtitleStyle: "shadow",
  stillAfter: 3,
  gestures: true,
  hideSpoilers: false,
  autoPip: true
};

const emptyData = (): ProfileData => ({ watchlist: [], lists: [], history: {}, ratings: {}, recentSearches: [], recentTitles: [], reminders: [], alertsSeenAt: 0, alerted: [] });
const MAX_REMINDERS = 100;
const MAX_ALERTED = 300;

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
    for (const p of parsed.profiles) {
      const d = { ...emptyData(), ...(parsed.data?.[p.id] ?? {}) };
      d.lists = Array.isArray(d.lists) ? d.lists.filter((l) => l && typeof l.id === "string" && typeof l.name === "string" && Array.isArray(l.items)) : [];
      d.recentTitles = Array.isArray(d.recentTitles) ? d.recentTitles.filter((i) => i && typeof i.id === "string" && typeof i.tmdbId === "number").slice(0, 12) : [];
      d.reminders = Array.isArray(d.reminders) ? d.reminders.filter((i) => i && typeof i.id === "string" && typeof i.tmdbId === "number") : [];
      d.alerted = Array.isArray(d.alerted) ? d.alerted.filter((k) => typeof k === "string") : [];
      d.alertsSeenAt = typeof d.alertsSeenAt === "number" && Number.isFinite(d.alertsSeenAt) ? d.alertsSeenAt : 0;
      for (const [k, h] of Object.entries(d.history ?? {})) if (h && h.episodes && typeof h.episodes !== "object") d.history[k] = { ...h, episodes: undefined };
      data[p.id] = d;
    }
    const prefs = { ...defaultPrefs, ...(parsed.prefs ?? {}) };
    // sources outside the registry fall back to Automatic; v1.2.0 moves the old CineSrc default to Automatic once (D-116)
    if (!VALID_SOURCES.has(prefs.preferredSource)) prefs.preferredSource = "auto";
    if (!parsed.prefs?.sourceAuto) { if (prefs.preferredSource === "cinesrc") prefs.preferredSource = "auto"; prefs.sourceAuto = true; }
    const profilePrefs: Record<string, Partial<Prefs>> = {};
    for (const p of parsed.profiles) {
      const own = { ...(parsed.profilePrefs?.[p.id] ?? {}) };
      if (own.preferredSource && !VALID_SOURCES.has(own.preferredSource)) delete own.preferredSource;
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
/** v1.2.3 sync: listen to every change and swap in a merged state. */
export { subscribe as subscribeStore, set as replaceState };

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
export function useLists() { return useStore((s) => selectData(s).lists); }
export function useList(id: string | null) { return useStore((s) => (id ? selectData(s).lists.find((l) => l.id === id) ?? null : null)); }
export function useHasLists() { return useStore((s) => selectData(s).lists.length > 0); }
/** How many custom lists hold this title (the details + button shows it as saved). */
export function useListCount(id: string) { return useStore((s) => selectData(s).lists.reduce((n, l) => n + (l.items.some((i) => i.id === id) ? 1 : 0), 0)); }
export function useReminders() { return useStore((s) => selectData(s).reminders); }
export function useHasReminder(id: string) { return useStore((s) => selectData(s).reminders.some((i) => i.id === id)); }
export function useAlertsSeenAt() { return useStore((s) => selectData(s).alertsSeenAt); }
/** Non-hook read of the active profile's data (background alert checks). */
export const getActiveData = () => selectData(state);
export function useRatings() { return useStore((s) => selectData(s).ratings); }
export function useRating(id: string) { return useStore((s) => selectData(s).ratings[id] ?? null); }
export function useRecentSearches() { return useStore((s) => selectData(s).recentSearches); }
export function useRecentTitles() { return useStore((s) => selectData(s).recentTitles); }
export function useHistoryMap() { return useStore((s) => selectData(s).history); }
export function useHistoryEntry(id: string) { return useStore((s) => selectData(s).history[id] ?? null); }

/** Continue Watching: unfinished entries, newest first. */
export function continueWatching(history: Record<string, HistoryEntry>, now = Date.now()) {
  const out: HistoryEntry[] = [];
  for (const h of Object.values(history)) {
    if (!h.completed && (h.position > 30 || h.upNext)) out.push(h);
    // smart next-up: a finished show comes back when its next episode airs
    else if (h.completed && h.pending && aired(h.pending.airDate, now)) {
      out.push({ ...h, season: h.pending.season, episode: h.pending.episode, episodeTitle: null, position: 0, duration: 0, completed: false, upNext: true, newEpisode: true, pending: null, updatedAt: Math.max(h.updatedAt, Date.parse(h.pending.airDate)) });
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
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
  /** Move a Watchlist title to the front (the top of "Recently added"). */
  bumpWatchlist(id: string) {
    patchActive((d) => { const it = d.watchlist.find((i) => i.id === id); return it ? { ...d, watchlist: [it, ...d.watchlist.filter((i) => i.id !== id)] } : d; });
  },
  /** Create a list (optionally with a first title). Returns the new list, or null at the limit. */
  createList(name: string, first?: PandaItem) {
    const d = activeData();
    if (d.lists.length >= MAX_LISTS) return null;
    const clean = uniqueListName(name.trim().replace(/\s+/g, " ").slice(0, 32) || "My List", d.lists);
    const list: UserList = { id: uid(), name: clean, items: first ? [slim(first)] : [], createdAt: Date.now(), updatedAt: Date.now() };
    patchActive((x) => ({ ...x, lists: [...x.lists, list] }));
    return list;
  },
  renameList(id: string, name: string) {
    patchActive((d) => {
      const others = d.lists.filter((l) => l.id !== id);
      const clean = name.trim().replace(/\s+/g, " ").slice(0, 32);
      return clean ? { ...d, lists: d.lists.map((l) => (l.id === id ? { ...l, name: uniqueListName(clean, others), updatedAt: Date.now() } : l)) } : d;
    });
  },
  deleteList(id: string) { patchActive((d) => ({ ...d, lists: d.lists.filter((l) => l.id !== id) })); },
  /** Add the title to the list, or take it out. Returns true when it was added. */
  toggleInList(listId: string, item: PandaItem) {
    const list = activeData().lists.find((l) => l.id === listId);
    if (!list) return false;
    const exists = list.items.some((i) => i.id === item.id);
    patchActive((d) => ({
      ...d,
      lists: d.lists.map((l) => (l.id === listId ? { ...l, updatedAt: Date.now(), items: exists ? l.items.filter((i) => i.id !== item.id) : [slim(item), ...l.items].slice(0, MAX_LIST_ITEMS) } : l))
    }));
    return !exists;
  },
  /** "Mark as watched": recorded as finished (so it seeds "Because you watched"), and taken off the Watchlist. */
  markWatched(item: PandaItem) {
    patchActive((d) => ({
      ...d,
      watchlist: d.watchlist.filter((i) => i.id !== item.id),
      history: { ...d.history, [item.id]: { ...(d.history[item.id] ?? {}), item: slim(item), position: 0, duration: 0, completed: true, upNext: false, updatedAt: Date.now() } }
    }));
  },
  /** "Remind Me" on a title that is not out yet. Returns true when the reminder was set. */
  toggleReminder(item: PandaItem) {
    const exists = activeData().reminders.some((i) => i.id === item.id);
    patchActive((d) => ({ ...d, reminders: exists ? d.reminders.filter((i) => i.id !== item.id) : [slim(item), ...d.reminders].slice(0, MAX_REMINDERS) }));
    return !exists;
  },
  /** Coming Up was opened: everything up to now is no longer "new". */
  markAlertsSeen(at = Date.now()) { patchActive((d) => (d.alertsSeenAt >= at ? d : { ...d, alertsSeenAt: at })); },
  /** Remember alerts that were sent as system notifications (bounded, newest kept). */
  markAlerted(keys: string[]) {
    if (!keys.length) return;
    patchActive((d) => ({ ...d, alerted: [...keys, ...d.alerted.filter((k) => !keys.includes(k))].slice(0, MAX_ALERTED) }));
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
  addRecentTitle(item: PandaItem) {
    patchActive((d) => ({ ...d, recentTitles: [item, ...d.recentTitles.filter((x) => x.id !== item.id)].slice(0, 12) }));
  },
  clearRecentSearches() { patchActive((d) => ({ ...d, recentSearches: [], recentTitles: [] })); },
  clearHistory() { patchActive((d) => ({ ...d, history: {} })); },
  saveProgress(item: PandaItem, p: { position: number; duration: number; season?: number; episode?: number; episodeTitle?: string | null; next?: { season: number; episode: number } | null; upcoming?: { season: number; episode: number; airDate: string } | null }) {
    if (!Number.isFinite(p.position) || p.position < 0) return;
    const completed = p.duration > 0 && p.position / p.duration > 0.94;
    const now = Date.now();
    patchActive((d) => {
      const prev = d.history[item.id];
      const episodes = withEpisode(prev?.episodes, p.season, p.episode, { p: Math.round(p.position), d: Math.round(p.duration), done: completed || (prev?.episodes?.[epKey(p.season ?? 0, p.episode ?? 0)]?.done ?? false) && p.position < 30, at: now });
      let entry: HistoryEntry;
      if (completed && p.next && item.type === "tv") {
        entry = { item: slim(item), season: p.next.season, episode: p.next.episode, episodeTitle: null, position: 0, duration: 0, completed: false, upNext: true, updatedAt: now, episodes, pending: null };
      } else {
        entry = { item: slim(item), season: p.season, episode: p.episode, episodeTitle: p.episodeTitle ?? null, position: Math.round(p.position), duration: Math.round(p.duration), completed, updatedAt: now, episodes,
          pending: completed && item.type === "tv" && p.upcoming ? p.upcoming : null };
      }
      return { ...d, history: { ...d.history, [item.id]: entry } };
    });
  },
  /**
   * Mark episodes watched or unwatched from an episode list. When the episode in Continue Watching
   * becomes watched, the entry moves on to `next` (or finishes).
   */
  markEpisodes(item: PandaItem, eps: { season: number; episode: number }[], done: boolean, next?: { season: number; episode: number } | null) {
    if (!eps.length) return;
    const now = Date.now();
    patchActive((d) => {
      const prev = d.history[item.id];
      let episodes = prev?.episodes;
      for (const e of eps) episodes = withEpisode(episodes, e.season, e.episode, { p: 0, d: episodeProgress(prev, e.season, e.episode)?.d ?? 0, done, at: now });
      const last = eps[eps.length - 1]!;
      const touchesCurrent = !prev || eps.some((e) => e.season === prev.season && e.episode === prev.episode);
      let entry: HistoryEntry;
      if (done && touchesCurrent) {
        entry = next
          ? { item: slim(item), season: next.season, episode: next.episode, episodeTitle: null, position: 0, duration: 0, completed: false, upNext: true, updatedAt: now, episodes }
          : { item: slim(item), season: last.season, episode: last.episode, episodeTitle: null, position: 0, duration: 0, completed: true, updatedAt: now, episodes };
      } else {
        entry = prev ? { ...prev, episodes } : { item: slim(item), season: last.season, episode: last.episode, episodeTitle: null, position: 0, duration: 0, completed: true, updatedAt: now, episodes };
      }
      return { ...d, history: { ...d.history, [item.id]: entry } };
    });
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

/** "Weekend", "Weekend 2", … so two lists never share a name. */
export function uniqueListName(name: string, lists: Pick<UserList, "name">[]) {
  const taken = new Set(lists.map((l) => l.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let n = 2; ; n++) if (!taken.has(`${name} ${n}`.toLowerCase())) return `${name} ${n}`;
}

/** Keep stored items small: drop nothing the UI needs but never store whole detail payloads. */
function slim(i: PandaItem): PandaItem {
  return { id: i.id, tmdbId: i.tmdbId, type: i.type, title: i.title, year: i.year, rating: i.rating, poster: i.poster, posterLarge: i.posterLarge, backdrop: i.backdrop, backdropLarge: i.backdropLarge, overview: i.overview, genres: i.genres, language: i.language, releaseDate: i.releaseDate, logo: i.logo ?? null };
}

export function itemKey(type: MediaType, tmdbId: number) { return `${type}:${tmdbId}`; }
