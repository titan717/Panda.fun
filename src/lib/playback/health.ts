import type { MediaType, SourceId } from "../types";
import type { FailureReason } from "./fallback";
import type { PlaybackPlatform } from "./registry";

/**
 * v1.4.0 Playback Health Tracker. A title is suppressed from recommendations only when EVERY eligible provider
 * on this platform failed to start it (the fallback controller decides that). One provider failing while the next
 * plays is a success. Network cuts and user cancellations never count.
 *
 * Suppression is temporary: 24 h after the first verified failure, ×3 for each further verified failure in a row
 * (capped at 7 days). When the cooldown ends the title is recommendable again ("revalidating"); the next real play
 * decides — success clears the record at once, another total failure extends the cooldown.
 * Nothing personal is stored beyond the profile id of the last failure (to show it in diagnostics).
 */
export interface HealthConfig { initialMs: number; factor: number; maxMs: number; maxRecords: number; forgetAfterMs: number }
export const HEALTH_CONFIG: HealthConfig = { initialMs: 24 * 3600_000, factor: 3, maxMs: 7 * 24 * 3600_000, maxRecords: 400, forgetAfterMs: 30 * 24 * 3600_000 };

export type RecoveryStatus = "suppressed" | "revalidating" | "recovered";

export interface FailureRecord {
  v: 1;
  contentId: number;
  contentType: MediaType;
  platform: PlaybackPlatform;
  profileId: string | null;
  season?: number;
  episode?: number;
  attempted: SourceId[];
  reason: FailureReason;
  failedAt: number;
  /** Verified total failures in a row. */
  failures: number;
  lastVerified: "failed" | "playing";
  suppressedUntil: number;
  recovery: RecoveryStatus;
}

const KEY = "panda:v1:playhealth";
export const healthKey = (platform: PlaybackPlatform, type: MediaType, id: number) => `${platform}:${type}:${id}`;

type Store = Record<string, FailureRecord>;
let cache: Store | null = null;
const subs = new Set<() => void>();
let version = 0;

function valid(r: unknown): r is FailureRecord {
  if (!r || typeof r !== "object") return false;
  const x = r as Partial<FailureRecord>;
  return x.v === 1 && Number.isInteger(x.contentId) && (x.contentType === "movie" || x.contentType === "tv") && (x.platform === "tv" || x.platform === "mobile" || x.platform === "browser")
    && Array.isArray(x.attempted) && typeof x.failedAt === "number" && typeof x.suppressedUntil === "number" && typeof x.failures === "number";
}

function read(): Store {
  if (cache) return cache;
  const out: Store = {};
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") for (const [k, v] of Object.entries(parsed)) if (valid(v)) out[k] = v;
  } catch { /* corrupt: start clean, playback health is a cache */ }
  cache = out;
  return out;
}

function write(s: Store, now: number, c: HealthConfig) {
  // forget old recovered/expired records and cap the size (oldest first)
  let entries = Object.entries(s).filter(([, r]) => r.recovery !== "recovered" || now - r.failedAt < c.forgetAfterMs).filter(([, r]) => now - r.failedAt < c.forgetAfterMs || r.suppressedUntil > now);
  if (entries.length > c.maxRecords) entries = entries.sort((a, b) => b[1].failedAt - a[1].failedAt).slice(0, c.maxRecords);
  cache = Object.fromEntries(entries);
  version++;
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* storage full: keep in memory */ }
  subs.forEach((f) => f());
}

export interface TotalFailure { platform: PlaybackPlatform; type: MediaType; id: number; season?: number; episode?: number; attempted: SourceId[]; reason: FailureReason; profileId?: string | null }

/** Record that every eligible provider failed. Returns the record, or null when the failure does not count. */
export function recordTotalFailure(f: TotalFailure, now = Date.now(), c: HealthConfig = HEALTH_CONFIG): FailureRecord | null {
  if (f.reason === "network" || !f.attempted.length) return null;
  const s = { ...read() };
  const k = healthKey(f.platform, f.type, f.id);
  const prev = s[k];
  const failures = prev && prev.lastVerified === "failed" ? prev.failures + 1 : 1;
  const span = Math.min(c.maxMs, c.initialMs * Math.pow(c.factor, failures - 1));
  const rec: FailureRecord = {
    v: 1, contentId: f.id, contentType: f.type, platform: f.platform, profileId: f.profileId ?? null,
    season: f.season, episode: f.episode, attempted: [...new Set(f.attempted)], reason: f.reason,
    failedAt: now, failures, lastVerified: "failed", suppressedUntil: now + span, recovery: "suppressed"
  };
  s[k] = rec;
  write(s, now, c);
  return rec;
}

/** A provider really played the title: clear any suppression at once. */
export function recordPlaybackSuccess(platform: PlaybackPlatform, type: MediaType, id: number, now = Date.now(), c: HealthConfig = HEALTH_CONFIG) {
  const s = read();
  const k = healthKey(platform, type, id);
  const prev = s[k];
  if (!prev || prev.recovery === "recovered") return;
  write({ ...s, [k]: { ...prev, lastVerified: "playing", failures: 0, suppressedUntil: 0, recovery: "recovered" } }, now, c);
}

export function healthStatus(platform: PlaybackPlatform, type: MediaType, id: number, now = Date.now()): RecoveryStatus | null {
  const r = read()[healthKey(platform, type, id)];
  if (!r) return null;
  if (r.recovery === "recovered") return "recovered";
  return r.suppressedUntil > now ? "suppressed" : "revalidating";
}

/** True while a title must not be recommended on this platform. */
export const isSuppressed = (platform: PlaybackPlatform, type: MediaType, id: number, now = Date.now()) => healthStatus(platform, type, id, now) === "suppressed";

/** Set of "type:id" keys suppressed right now on a platform (fast filter for the recommendation engine). */
export function suppressedSet(platform: PlaybackPlatform, now = Date.now()): Set<string> {
  const out = new Set<string>();
  for (const r of Object.values(read())) if (r.platform === platform && r.recovery !== "recovered" && r.suppressedUntil > now) out.add(`${r.contentType}:${r.contentId}`);
  return out;
}

export function allHealthRecords(): FailureRecord[] { return Object.values(read()); }
export function clearHealth() { cache = {}; version++; try { localStorage.removeItem(KEY); } catch { /* ignore */ } subs.forEach((f) => f()); }
export const healthVersion = () => version;
export function subscribeHealth(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }
/** Test hook: drop the in-memory cache so the next read comes from storage. */
export function resetHealthCacheForTest() { cache = null; }
