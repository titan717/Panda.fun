import { useSyncExternalStore } from "react";
import { getState, launchedBefore, useStore } from "./store";

/**
 * v1.4.0 taste profile: what each profile told onboarding it likes. Local only (localStorage `panda:v1:taste`),
 * kept per profile, never shared between profiles. The recommendation engine imports this API; keep it stable.
 *
 * `getTaste(id)` is null until the profile answered (or skipped) onboarding. Genres are TMDB genre names.
 */
export interface TasteProfile {
  v: 1;
  genres: string[];
  contentType: "movie" | "tv" | "both";
  popularity: "popular" | "gems" | "mix";
  era: "new" | "classic" | "mix";
  length: "short" | "long" | "mix";
  pace: "fast" | "slow" | "mix";
  completedAt: number | null;
  skipped: boolean;
}

export const TASTE_KEY = "panda:v1:taste";

/** The TMDB genre names onboarding offers (as returned by the API). */
export const TASTE_GENRES = ["Action", "Adventure", "Comedy", "Drama", "Thriller", "Horror", "Science Fiction", "Fantasy", "Romance", "Animation", "Documentary", "Mystery", "Crime"] as const;
export type TasteGenre = (typeof TASTE_GENRES)[number];

/** Older or hand-written names mapped onto the TMDB names. */
const ALIASES: Record<string, TasteGenre> = { "sci-fi": "Science Fiction", "scifi": "Science Fiction", "science-fiction": "Science Fiction", "documentaries": "Documentary", "anime": "Animation", "animated": "Animation" };
const BY_LOWER = new Map(TASTE_GENRES.map((g) => [g.toLowerCase(), g] as const));

export function normalizeGenre(g: unknown): TasteGenre | null {
  if (typeof g !== "string") return null;
  const k = g.trim().toLowerCase();
  return BY_LOWER.get(k) ?? ALIASES[k] ?? null;
}

export const defaultTaste = (): TasteProfile => ({ v: 1, genres: [], contentType: "both", popularity: "mix", era: "mix", length: "mix", pace: "mix", completedAt: null, skipped: false });

const pick = <T extends string>(v: unknown, ok: readonly T[], d: T): T => (typeof v === "string" && (ok as readonly string[]).includes(v) ? (v as T) : d);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Repair and migrate one stored taste profile; null when it is not a taste profile at all. */
export function validateTaste(raw: unknown): TasteProfile | null {
  if (!isObj(raw)) return null;
  const d = defaultTaste();
  const genres = Array.isArray(raw.genres) ? raw.genres.map(normalizeGenre).filter((g): g is TasteGenre => g !== null) : [];
  // v0 (pre-release drafts) stored `type` instead of `contentType`
  const type = raw.contentType ?? raw.type;
  return {
    v: 1,
    genres: [...new Set(genres)],
    contentType: pick(type === "movies" ? "movie" : type === "shows" ? "tv" : type, ["movie", "tv", "both"] as const, d.contentType),
    popularity: pick(raw.popularity, ["popular", "gems", "mix"] as const, d.popularity),
    era: pick(raw.era, ["new", "classic", "mix"] as const, d.era),
    length: pick(raw.length, ["short", "long", "mix"] as const, d.length),
    pace: pick(raw.pace, ["fast", "slow", "mix"] as const, d.pace),
    completedAt: typeof raw.completedAt === "number" && Number.isFinite(raw.completedAt) && raw.completedAt > 0 ? raw.completedAt : null,
    skipped: raw.skipped === true
  };
}

/* ---------- storage ---------- */

export type OnboardingStep = "welcome" | "who" | "genres" | "type" | "taste" | "ready";
export interface OnboardingDraft { step: OnboardingStep; taste: TasteProfile }
interface TasteStore {
  v: 1;
  profiles: Record<string, TasteProfile>;
  /** Profiles onboarding must not open for on its own (existing users, kids, reset). */
  seen: string[];
  /** Unfinished onboarding per profile, so a restart resumes where it stopped. */
  drafts: Record<string, OnboardingDraft>;
  /** The device saw the Welcome step (or skipped it). */
  welcomed: boolean;
}

const STEPS: readonly OnboardingStep[] = ["welcome", "who", "genres", "type", "taste", "ready"];

function parseStore(raw: string | null): TasteStore | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as unknown;
    if (!isObj(p)) return null;
    const profiles: Record<string, TasteProfile> = {};
    for (const [id, t] of Object.entries(isObj(p.profiles) ? p.profiles : {})) { const v = validateTaste(t); if (v) profiles[id] = v; }
    const drafts: Record<string, OnboardingDraft> = {};
    for (const [id, d] of Object.entries(isObj(p.drafts) ? p.drafts : {})) {
      const t = isObj(d) ? validateTaste(d.taste) : null;
      if (t && isObj(d)) drafts[id] = { step: pick(d.step, STEPS, "genres"), taste: t };
    }
    const seen = Array.isArray(p.seen) ? p.seen.filter((s): s is string => typeof s === "string") : [];
    return { v: 1, profiles, drafts, seen: [...new Set(seen)], welcomed: p.welcomed === true };
  } catch { return null; }
}

function storage(): Storage | null {
  try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
}

let cache: TasteStore | null = null;
const subs = new Set<() => void>();

function read(): TasteStore {
  if (cache) return cache;
  const s = storage();
  let raw: string | null = null;
  try { raw = s?.getItem(TASTE_KEY) ?? null; } catch { /* unavailable */ }
  const parsed = parseStore(raw);
  if (parsed) { cache = parsed; return cache; }
  // First read on this device (or the saved copy was corrupt). A device that already had Panda data is a returning
  // user: its existing profiles never get onboarding on their own; only profiles created from now on do.
  const returning = launchedBefore || raw !== null;
  cache = { v: 1, profiles: {}, drafts: {}, seen: returning ? getState().profiles.map((p) => p.id) : [], welcomed: returning };
  persist(cache); // no notify: this can run inside a render
  return cache;
}

function persist(next: TasteStore) {
  try { storage()?.setItem(TASTE_KEY, JSON.stringify(next)); } catch { /* storage full: keep in memory */ }
}

function write(next: TasteStore) {
  cache = next;
  persist(next);
  for (const f of subs) { try { f(); } catch { /* ignore */ } }
}

function update(fn: (s: TasteStore) => TasteStore) { write(fn(read())); }

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === TASTE_KEY) { cache = null; for (const f of subs) f(); } });
}

/** Tests only: drop the in-memory copy so the next read comes from localStorage. */
export function resetTasteCache() { cache = null; }

/* ---------- public API ---------- */

/** The profile's taste, or null if it has not answered or skipped onboarding. */
export function getTaste(profileId: string | null | undefined): TasteProfile | null {
  if (!profileId) return null;
  return read().profiles[profileId] ?? null;
}

/** Save (validated) and return the stored copy. Also ends any onboarding draft of that profile. */
export function saveTaste(profileId: string, t: Partial<TasteProfile>): TasteProfile {
  const clean = validateTaste({ ...defaultTaste(), ...t }) ?? defaultTaste();
  update((s) => {
    const drafts = { ...s.drafts };
    delete drafts[profileId];
    return { ...s, profiles: { ...s.profiles, [profileId]: clean }, drafts };
  });
  return clean;
}

/** Settings › Reset personalization: forget the answers. Onboarding does not reopen by itself afterwards. */
export function clearTaste(profileId: string) {
  update((s) => {
    const profiles = { ...s.profiles }; delete profiles[profileId];
    const drafts = { ...s.drafts }; delete drafts[profileId];
    return { ...s, profiles, drafts, seen: s.seen.includes(profileId) ? s.seen : [...s.seen, profileId] };
  });
}

const subscribe = (f: () => void) => { subs.add(f); return () => subs.delete(f); };

/** The active profile's taste (null until answered). */
export function useTaste(): TasteProfile | null {
  const id = useStore((s) => s.activeProfileId);
  return useSyncExternalStore(subscribe, () => getTaste(id), () => null);
}

/* ---------- onboarding bookkeeping (used by src/onboarding and App) ---------- */

export function deviceWelcomed() { return read().welcomed; }
export function markWelcomed() { if (!read().welcomed) update((s) => ({ ...s, welcomed: true })); }
export function markOnboardingSeen(ids: string[]) {
  update((s) => ({ ...s, seen: [...new Set([...s.seen, ...ids])] }));
}
export function getDraft(profileId: string | null | undefined): OnboardingDraft | null {
  return profileId ? read().drafts[profileId] ?? null : null;
}
export function saveDraft(profileId: string, d: OnboardingDraft) {
  const taste = validateTaste(d.taste) ?? defaultTaste();
  update((s) => ({ ...s, drafts: { ...s.drafts, [profileId]: { step: pick(d.step, STEPS, "genres"), taste } } }));
}

/**
 * Onboarding opens by itself on the device's first run (Welcome) and for a profile that has never answered or
 * skipped it. Kids profiles and existing users never get it on their own; Settings can always reopen it.
 */
export function needsOnboarding(profileId: string | null | undefined) {
  const s = read();
  if (!s.welcomed) return true;
  if (!profileId) return false;
  const p = getState().profiles.find((x) => x.id === profileId);
  if (!p || p.kids) return false;
  return !s.profiles[profileId] && !s.seen.includes(profileId);
}

/** Reactive needsOnboarding for the active profile. */
export function useNeedsOnboarding() {
  const id = useStore((s) => s.activeProfileId);
  useStore((s) => s.profiles); // re-check when profiles change (kids flag, deletion)
  return useSyncExternalStore(subscribe, () => needsOnboarding(id), () => false);
}
