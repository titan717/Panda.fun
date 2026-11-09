/**
 * Account-free cross-device sync (v1.2.3, master mission §6, docs/DECISIONS.md D-130–D-134).
 *
 * A sync code is 12 Crockford base32 characters (XXXX-XXXX-XXXX, 60 random bits). PBKDF2 turns it into
 * an AES-GCM key that never leaves the device and a lookup id the backend files the backup under, so the
 * server only ever holds ciphertext. Every profile, list, title, rating and setting is one item with a
 * timestamp; devices merge item by item and the newest change wins.
 */
import { API_BASE } from "./api";
import { DEVICE_PREFS, getState, replaceState, subscribeStore, type HistoryEntry, type Prefs, type Profile, type ProfileData, type Rating, type State, type UserList } from "./store";
import type { PandaItem } from "./types";

/* ---------------- the code ---------------- */

/** Crockford base32: no I, L, O or U, so a code read aloud or off a TV is never ambiguous. */
export const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const CODE_LEN = 12;

export function generateCode(rand: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = rand(CODE_LEN);
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) out += ALPHABET[bytes[i]! & 31];
  return formatCode(out);
}

/** Uppercases, drops spaces and dashes, and reads O as 0, I and L as 1, U as V. Null unless 12 valid characters remain. */
export function normalizeCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s\-_.]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1").replace(/U/g, "V");
  if (s.length !== CODE_LEN || [...s].some((ch) => !ALPHABET.includes(ch))) return null;
  return s;
}

export function formatCode(raw: string): string {
  const s = raw.replace(/-/g, "");
  return [s.slice(0, 4), s.slice(4, 8), s.slice(8, 12)].filter(Boolean).join("-");
}

/** What the restore field shows while typing: valid characters only, dashes added after every 4. */
export function typingCode(input: string): string {
  const s = input.toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1").replace(/U/g, "V").replace(new RegExp(`[^${ALPHABET}]`, "g"), "").slice(0, CODE_LEN);
  return formatCode(s);
}

/* ---------------- keys and encryption ---------------- */

const SALT = "panda.fun/sync/v1";
export const PBKDF2_ROUNDS = 150_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

export interface SyncKeys { key: CryptoKey; id: string }

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

export async function deriveKeys(code: string, rounds = PBKDF2_ROUNDS): Promise<SyncKeys> {
  const norm = normalizeCode(code);
  if (!norm) throw new Error("invalid code");
  const base = await crypto.subtle.importKey("raw", enc.encode(norm), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(SALT), iterations: rounds }, base, 512));
  const key = await crypto.subtle.importKey("raw", bits.slice(0, 32), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  const id = hex(await crypto.subtle.digest("SHA-256", bits.slice(32))).slice(0, 32);
  return { key, id };
}

const b64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Response(new Blob([data as BlobPart]).stream().pipeThrough(stream as unknown as ReadableWritablePair<Uint8Array, Uint8Array>));
  return new Uint8Array(await out.arrayBuffer());
}
const canZip = () => typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";

export async function encrypt(keys: SyncKeys, doc: SyncDoc): Promise<string> {
  const raw = enc.encode(JSON.stringify(doc));
  const zip = canZip();
  const body = zip ? await pipe(raw, new CompressionStream("gzip")) : raw;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(SALT) }, keys.key, body as BufferSource));
  return JSON.stringify({ v: 1, iv: b64(iv), ct: b64(ct), z: zip ? "gzip" : "none" });
}

export async function decrypt(keys: SyncKeys, blob: string): Promise<SyncDoc> {
  const e = JSON.parse(blob) as { v: number; iv: string; ct: string; z?: string };
  if (e.v !== 1) throw new Error("unknown backup version");
  const body = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(e.iv), additionalData: enc.encode(SALT) }, keys.key, unb64(e.ct)));
  if (e.z === "gzip" && !canZip()) throw new Error("This device cannot unpack the backup");
  const raw = e.z === "gzip" ? await pipe(body, new DecompressionStream("gzip")) : body;
  const doc = JSON.parse(dec.decode(raw)) as SyncDoc;
  if (doc?.v !== 1 || typeof doc.items !== "object") throw new Error("bad backup");
  return doc;
}

/* ---------------- items ---------------- */

/** One synced value; `d: null` is a deletion (tombstone). */
export interface Item { t: number; d: unknown }
export interface SyncDoc { v: 1; at: number; items: Record<string, Item> }

/** Settings that stay on this device: layout, notification permission state and update notices. */
const LOCAL_PREFS = new Set<string>(DEVICE_PREFS.filter((k) => k !== "kidsPin"));
const TOMB_TTL = 90 * 86400_000;

interface Ordered { i: PandaItem; o: number }

/** Flattens the store into keyed values. `orders` gives watchlist/reminder positions their stamps. */
export function flatten(s: State, orders: Record<string, number>, now: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s.prefs)) if (!LOCAL_PREFS.has(k) && v !== undefined) out[`g:${k}`] = v;
  for (const p of s.profiles) {
    out[`p:${p.id}`] = p;
    for (const [k, v] of Object.entries(s.profilePrefs[p.id] ?? {})) if (!LOCAL_PREFS.has(k) && v !== undefined) out[`pp:${p.id}:${k}`] = v;
    const d = s.data[p.id];
    if (!d) continue;
    const ordered = (prefix: string, arr: PandaItem[]) => {
      // lists are newest first; walking oldest to newest, a stamp must keep rising or the title gets a fresh one
      let prev = -Infinity;
      for (let i = arr.length - 1; i >= 0; i--) {
        const it = arr[i]!;
        const key = `${prefix}:${p.id}:${it.id}`;
        let o = orders[key];
        if (o === undefined || o <= prev) o = Math.max(prev + 1, now);
        orders[key] = o; prev = o;
        out[key] = { i: it, o } satisfies Ordered;
      }
    };
    ordered("w", d.watchlist);
    ordered("m", d.reminders);
    for (const l of d.lists) out[`l:${p.id}:${l.id}`] = l;
    for (const [id, h] of Object.entries(d.history)) out[`h:${p.id}:${id}`] = h;
    for (const [id, r] of Object.entries(d.ratings)) out[`r:${p.id}:${id}`] = r;
    if (d.recentSearches.length || d.recentTitles.length) out[`s:${p.id}`] = { q: d.recentSearches, t: d.recentTitles };
    if (d.alertsSeenAt || d.alerted.length) out[`a:${p.id}`] = { at: d.alertsSeenAt, k: d.alerted };
  }
  return out;
}

/** Small, stable hash of a value, to notice which items changed since the last look. */
export function hashOf(v: unknown): string {
  const s = JSON.stringify(v) ?? "";
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36) + s.length.toString(36);
}

export interface Clock { hashes: Record<string, string>; times: Record<string, number>; orders: Record<string, number> }
export const emptyClock = (): Clock => ({ hashes: Object.create(null) as Record<string, string>, times: Object.create(null) as Record<string, number>, orders: Object.create(null) as Record<string, number> });

/**
 * Stamps changes: new or changed values get `now` (watch progress keeps its own updatedAt when newer),
 * vanished ones become tombstones. `baseline` stamps everything that is new to the clock with 0, so on
 * restore the backup wins over what this device had (D-132).
 */
export function track(clock: Clock, s: State, now: number, baseline = false): Record<string, Item> {
  const flat = flatten(s, clock.orders, now);
  const items: Record<string, Item> = {};
  for (const [k, v] of Object.entries(flat)) {
    if (k === "__proto__" || k === "constructor" || k === "prototype") continue; // sync keys are "kind:id"; never let one name a prototype property
    const h = hashOf(v);
    if (clock.hashes[k] !== h) {
      const known = clock.hashes[k] !== undefined;
      clock.hashes[k] = h;
      const own = k.startsWith("h:") ? (v as HistoryEntry).updatedAt ?? 0 : 0;
      clock.times[k] = baseline && !known ? Math.min(own, 1) : Math.max(now, own);
    }
    items[k] = { t: clock.times[k] ?? 0, d: v };
  }
  for (const k of Object.keys(clock.hashes)) {
    if (k === "__proto__" || k === "constructor" || k === "prototype") continue; 
    if (Object.prototype.hasOwnProperty.call(flat, k)) continue;
    if (clock.hashes[k] !== "∅") { clock.hashes[k] = "∅"; clock.times[k] = now; }
    if (now - (clock.times[k] ?? 0) > TOMB_TTL) { delete clock.hashes[k]; delete clock.times[k]; delete clock.orders[k]; continue; }
    items[k] = { t: clock.times[k]!, d: null };
  }
  return items;
}

export interface MergeResult { items: Record<string, Item>; conflicts: number; fromRemote: number }

/** Last write wins per item; a tie keeps the backup's value. Both sides changing one item since the last sync counts as a conflict. */
export function merge(local: Record<string, Item>, remote: Record<string, Item>, lastSync: number): MergeResult {
  const items = Object.create(null) as Record<string, Item>;
  let conflicts = 0, fromRemote = 0;
  for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
    const a = local[k], b = remote[k];
    if (!b) { items[k] = a!; continue; }
    if (!a) { items[k] = b; fromRemote++; continue; }
    const differ = hashOf(a.d) !== hashOf(b.d);
    if (differ && a.t > lastSync && b.t > lastSync && lastSync > 0) conflicts++;
    if (a.t > b.t) items[k] = a; else { items[k] = b; if (differ) fromRemote++; }
  }
  return { items, conflicts, fromRemote };
}

/** Names that would reach Object.prototype when used as a property key (A126-15). */
const unsafeKey = (k?: string) => k === "__proto__" || k === "constructor" || k === "prototype";

const emptyData = (): ProfileData => ({ watchlist: [], lists: [], history: {}, ratings: {}, recentSearches: [], recentTitles: [], reminders: [], alertsSeenAt: 0, alerted: [] });

/** Builds a store state from merged items, keeping this device's own settings and the active profile when it still exists. */
export function rebuild(items: Record<string, Item>, current: State): State {
  const profiles: Profile[] = [];
  const prefs = { ...current.prefs } as Record<string, unknown>;
  const profilePrefs: Record<string, Partial<Prefs>> = {};
  const data: Record<string, ProfileData> = {};
  const w: Record<string, Ordered[]> = {}, m: Record<string, Ordered[]> = {};
  const at = (pid: string) => (data[pid] ??= emptyData());
  for (const [k, { d }] of Object.entries(items)) {
    if (d === null || d === undefined) continue;
    const [kind, a, ...rest] = k.split(":");
    const b = rest.join(":");
    if (unsafeKey(a) || unsafeKey(b)) continue;
    if (kind === "g" && a && !LOCAL_PREFS.has(a)) prefs[a] = d;
    else if (kind === "p" && a) profiles.push(d as Profile);
    else if (kind === "pp" && a && b && !LOCAL_PREFS.has(b)) (profilePrefs[a] ??= {} as Partial<Prefs>)[b as keyof Prefs] = d as never;
    else if (kind === "w" && a) (w[a] ??= []).push(d as Ordered);
    else if (kind === "m" && a) (m[a] ??= []).push(d as Ordered);
    else if (kind === "l" && a) at(a).lists.push(d as UserList);
    else if (kind === "h" && a && b) at(a).history[b] = d as HistoryEntry;
    else if (kind === "r" && a && b) at(a).ratings[b] = d as Rating;
    else if (kind === "s" && a) { const v = d as { q: string[]; t: PandaItem[] }; at(a).recentSearches = v.q ?? []; at(a).recentTitles = v.t ?? []; }
    else if (kind === "a" && a) { const v = d as { at: number; k: string[] }; at(a).alertsSeenAt = v.at ?? 0; at(a).alerted = v.k ?? []; }
  }
  const byStamp = (x: Ordered[] = []) => x.sort((p, q) => q.o - p.o).map((e) => e.i);
  profiles.sort((p, q) => p.createdAt - q.createdAt);
  if (!profiles.length) return current;
  for (const p of profiles) {
    const d = at(p.id);
    d.watchlist = byStamp(w[p.id]);
    d.reminders = byStamp(m[p.id]);
    d.lists.sort((x, y) => y.updatedAt - x.updatedAt);
    profilePrefs[p.id] ??= {};
  }
  for (const id of Object.keys(data)) if (!profiles.some((p) => p.id === id)) delete data[id];
  const active = current.activeProfileId && profiles.some((p) => p.id === current.activeProfileId) ? current.activeProfileId : null;
  return { profiles, activeProfileId: active, prefs: prefs as unknown as Prefs, data, profilePrefs };
}

/** A profile this device created on first launch and never used: dropped when restoring from a code. */
export function isUntouched(s: State, id: string) {
  const d = s.data[id];
  if (!d) return true;
  return !d.watchlist.length && !d.lists.length && !Object.keys(d.history).length && !Object.keys(d.ratings).length && !d.reminders.length && !Object.keys(s.profilePrefs[id] ?? {}).length;
}

/* ---------------- local link ---------------- */

const KEY = "panda:v1:sync";
const FAIL_KEY = "panda:v1:syncfail";

export interface Link { code: string; id: string; version: number; lastSync: number; conflicts: number; clock: Clock }

export function readLink(): Link | null {
  try { const l = JSON.parse(localStorage.getItem(KEY) ?? "null") as Link | null; return l && typeof l.code === "string" && typeof l.id === "string" ? { ...l, clock: l.clock ? { hashes: Object.assign(emptyClock().hashes, l.clock.hashes), times: Object.assign(emptyClock().times, l.clock.times), orders: Object.assign(emptyClock().orders, l.clock.orders) } : emptyClock() } : null; } catch { return null; }
}
function writeLink(l: Link | null) {
  try { if (l) localStorage.setItem(KEY, JSON.stringify(l)); else localStorage.removeItem(KEY); } catch { /* storage full */ }
  emit();
}

/* ---------------- status for the Settings screen ---------------- */

export interface SyncStatus { linked: boolean; code: string | null; busy: boolean; lastSync: number; conflicts: number; error: string | null; lockedUntil: number }
let busy = false;
let lastError: string | null = null;
const subs = new Set<() => void>();
let snapshot: SyncStatus | null = null;
function emit() { snapshot = null; subs.forEach((f) => f()); }
export function subscribeSync(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }
export function getSyncStatus(): SyncStatus {
  if (snapshot) return snapshot;
  const l = readLink();
  snapshot = { linked: Boolean(l), code: l?.code ?? null, busy, lastSync: l?.lastSync ?? 0, conflicts: l?.conflicts ?? 0, error: lastError, lockedUntil: lockedUntil() };
  return snapshot;
}

/* ---------------- wrong-code lockout on the device ---------------- */

export const FAIL_LIMIT = 5;
export const LOCK_MS = 15 * 60_000;
function lockedUntil(now = Date.now()) {
  try { const f = JSON.parse(localStorage.getItem(FAIL_KEY) ?? "null") as { n: number; until: number } | null; return f && f.until > now ? f.until : 0; } catch { return 0; }
}
function noteFailure(now = Date.now(), serverUntil = 0) {
  let f = { n: 0, until: 0 };
  try { f = JSON.parse(localStorage.getItem(FAIL_KEY) ?? "null") ?? f; } catch { /* reset */ }
  f.n += 1;
  if (f.n >= FAIL_LIMIT || serverUntil) { f.until = Math.max(serverUntil, now + LOCK_MS); f.n = 0; }
  try { localStorage.setItem(FAIL_KEY, JSON.stringify(f)); } catch { /* ignore */ }
  return FAIL_LIMIT - f.n;
}
const clearFailures = () => { try { localStorage.removeItem(FAIL_KEY); } catch { /* ignore */ } };

/* ---------------- network ---------------- */

export class SyncError extends Error {
  constructor(message: string, readonly kind: "notfound" | "locked" | "revoked" | "offline" | "server" | "conflict" | "toolarge" | "invalid", readonly retryAfter = 0, readonly triesLeft?: number) { super(message); this.name = "SyncError"; }
}

interface Remote { version: number; blob: string; updatedAt: number }

async function call(method: "GET" | "PUT" | "DELETE", id: string, body?: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/panda/sync/${id}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, keepalive: method === "PUT" && JSON.stringify(body).length < 60_000, signal: AbortSignal.timeout(20_000) });
  } catch { throw new SyncError("No connection. Try again when you are online.", "offline"); }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const err = json.error as { code?: string; triesLeft?: number } | undefined;
  if (res.status === 429) {
    const wait = Number(res.headers.get("retry-after")) || 60;
    throw new SyncError(err?.code === "SYNC_LOCKED" ? "Too many wrong codes. Try again later." : "Too many sync requests. Try again in a minute.", "locked", wait);
  }
  if (res.status === 410) throw new SyncError("This sync code was revoked or replaced on another device.", "revoked");
  if (res.status === 413) throw new SyncError("Your data is too large to back up.", "toolarge");
  if (res.status >= 500) throw new SyncError("Sync is not available right now. Try again soon.", "server");
  return { status: res.status, json };
}

async function getRemote(id: string): Promise<Remote | null> {
  const r = await call("GET", id);
  if (r.status === 404) return null;
  if (r.status !== 200) throw new SyncError("Sync failed.", "server");
  return r.json.data as Remote;
}

/* ---------------- the operations ---------------- */

/** Merge with the backup, apply, and save the result. Retries when another device saved in between. */
async function runSync(link: Link, keys: SyncKeys, opts: { restoring?: boolean } = {}): Promise<{ added: number; conflicts: number }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const now = Date.now();
    const local = track(link.clock, getState(), now, opts.restoring);
    const remote = await getRemote(keys.id);
    if (!remote && link.version > 0) throw new SyncError("This sync code was revoked or replaced on another device.", "revoked");
    if (!remote && opts.restoring) throw new SyncError("No backup found for this code.", "notfound");
    let merged: MergeResult = { items: local, conflicts: 0, fromRemote: 0 };
    if (remote) {
      let doc: SyncDoc;
      try { doc = await decrypt(keys, remote.blob); } catch { throw new SyncError("This backup could not be opened with this code.", "invalid"); }
      merged = merge(local, doc.items, opts.restoring ? 0 : link.lastSync);
      let next = rebuild(merged.items, getState());
      if (opts.restoring) next = dropUntouched(next, getState(), doc.items);
      if (hashOf(next) !== hashOf(getState())) replaceState(next);
      // remember what we now hold so the next look does not mistake it for a local change
      const after = flatten(getState(), link.clock.orders, now);
      for (const [k, v] of Object.entries(after)) { if (k === "__proto__" || k === "constructor" || k === "prototype") continue; link.clock.hashes[k] = hashOf(v); link.clock.times[k] = merged.items[k]?.t ?? now; }
      for (const [k, it] of Object.entries(merged.items)) { if (k === "__proto__" || k === "constructor" || k === "prototype") continue; if (it.d === null) { link.clock.hashes[k] = "∅"; link.clock.times[k] = it.t; } }
    }
    const blob = await encrypt(keys, { v: 1, at: now, items: merged.items });
    const put = await call("PUT", keys.id, { blob, base: remote?.version ?? null });
    if (put.status === 409) continue;
    if (put.status !== 200) throw new SyncError("Sync failed.", "server");
    const saved = put.json.data as { version: number };
    link.version = saved.version; link.lastSync = now; link.conflicts = merged.conflicts;
    writeLink(link);
    return { added: merged.fromRemote, conflicts: merged.conflicts };
  }
  throw new SyncError("Another device keeps saving. Try again in a moment.", "conflict");
}

/** On restore, this device's never-used starter profiles (You / Kids) give way to the backup's. */
function dropUntouched(next: State, before: State, remote: Record<string, Item>): State {
  const remoteHasProfiles = Object.keys(remote).some((k) => k.startsWith("p:") && remote[k]!.d);
  if (!remoteHasProfiles) return next;
  const drop = new Set(before.profiles.filter((p) => !(`p:${p.id}` in remote) && isUntouched(before, p.id)).map((p) => p.id));
  if (!drop.size || drop.size >= next.profiles.length) return next;
  const profiles = next.profiles.filter((p) => !drop.has(p.id));
  const data = { ...next.data }, profilePrefs = { ...next.profilePrefs };
  for (const id of drop) { delete data[id]; delete profilePrefs[id]; }
  return { ...next, profiles, data, profilePrefs, activeProfileId: next.activeProfileId && drop.has(next.activeProfileId) ? null : next.activeProfileId };
}

let queue: Promise<unknown> = Promise.resolve();
/** One sync operation at a time: a tap while a background sync runs waits for it instead of failing. */
function guarded<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    busy = true; lastError = null; emit();
    try { return await fn(); } catch (e) { lastError = e instanceof Error ? e.message : String(e); throw e; } finally { busy = false; emit(); }
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

/** Creates a code for this device and uploads the first backup. */
export function createCode(): Promise<string> {
  return guarded(async () => {
    const code = generateCode();
    const keys = await deriveKeys(code);
    const link: Link = { code, id: keys.id, version: 0, lastSync: 0, conflicts: 0, clock: emptyClock() };
    await runSync(link, keys);
    startAutoSync();
    return code;
  });
}

/** Restores from a code typed on this device; afterwards this device stays linked to it. */
export function restoreFromCode(input: string): Promise<{ added: number; profiles: number }> {
  return guarded(async () => {
    const until = lockedUntil();
    if (until) throw new SyncError("Too many wrong codes. Try again later.", "locked", Math.ceil((until - Date.now()) / 1000));
    const code = normalizeCode(input);
    if (!code) throw new SyncError("A sync code has 12 letters and numbers, like 7KQ2-M9TX-4HRB.", "invalid");
    const keys = await deriveKeys(code);
    const link: Link = { code: formatCode(code), id: keys.id, version: 0, lastSync: 0, conflicts: 0, clock: readLink()?.id === keys.id ? readLink()!.clock : emptyClock() };
    try {
      const r = await runSync(link, keys, { restoring: true });
      clearFailures();
      startAutoSync();
      return { added: r.added, profiles: getState().profiles.length };
    } catch (e) {
      if (e instanceof SyncError && (e.kind === "notfound" || e.kind === "locked")) {
        const left = noteFailure(Date.now(), e.kind === "locked" ? Date.now() + e.retryAfter * 1000 : 0);
        if (e.kind === "notfound") throw new SyncError(left > 0 ? `No backup found for this code. ${left} ${left === 1 ? "try" : "tries"} left.` : "No backup found. Too many wrong codes — try again in 15 minutes.", "notfound", 0, left);
      }
      throw e;
    }
  });
}

export function syncNow(): Promise<{ added: number; conflicts: number }> {
  return guarded(async () => {
    const link = readLink();
    if (!link) throw new SyncError("Sync is off on this device.", "invalid");
    try { return await runSync(link, await deriveKeys(link.code)); } catch (e) {
      if (e instanceof SyncError && e.kind === "revoked") { writeLink(null); stopAutoSync(); }
      throw e;
    }
  });
}

/** Deletes the backup from the server and turns sync off here. Other devices learn it on their next sync. */
export function revokeCode(): Promise<void> {
  return guarded(async () => {
    const link = readLink();
    if (!link) return;
    const r = await call("DELETE", link.id);
    if (r.status !== 200 && r.status !== 404) throw new SyncError("Could not revoke the code.", "server");
    writeLink(null); stopAutoSync();
  });
}

/** New code, same data: uploads under the new code, then revokes the old one. */
export function regenerateCode(): Promise<string> {
  return guarded(async () => {
    const old = readLink();
    if (old) { try { await runSync(old, await deriveKeys(old.code)); } catch (e) { if (!(e instanceof SyncError && e.kind === "revoked")) throw e; } }
    const code = generateCode();
    const keys = await deriveKeys(code);
    const link: Link = { code, id: keys.id, version: 0, lastSync: 0, conflicts: 0, clock: old?.clock ?? emptyClock() };
    await runSync(link, keys);
    if (old) await call("DELETE", old.id).catch(() => undefined);
    return code;
  });
}

/* ---------------- automatic sync ---------------- */

export const AUTO_DEBOUNCE = 20_000;
export const AUTO_EVERY = 10 * 60_000;
let auto: null | { unsub: () => void; timer: ReturnType<typeof setTimeout> | null; every: ReturnType<typeof setInterval>; vis: () => void } = null;

const quiet = () => { if (!busy && readLink() && navigator.onLine !== false) syncNow().catch(() => undefined); };

/** While linked: sync shortly after start, 20 s after changes settle, every 10 minutes and when the app goes to the background. */
export function startAutoSync() {
  if (auto || !readLink()) return;
  const schedule = (ms: number) => { if (!auto) return; if (auto.timer) clearTimeout(auto.timer); auto.timer = setTimeout(quiet, ms); };
  const vis = () => { if (document.visibilityState === "hidden") quiet(); };
  auto = { unsub: subscribeStore(() => { if (!busy) schedule(AUTO_DEBOUNCE); }), timer: null, every: setInterval(quiet, AUTO_EVERY), vis };
  document.addEventListener("visibilitychange", vis);
  schedule(4000);
}

export function stopAutoSync() {
  if (!auto) return;
  auto.unsub(); if (auto.timer) clearTimeout(auto.timer); clearInterval(auto.every);
  document.removeEventListener("visibilitychange", auto.vis);
  auto = null;
}

// Linked devices start syncing as soon as this module arrives; Settings (which imports it) is prefetched
// on every launch when the device is idle, so the crypto never weighs on the first screen (PERF v1.2.3).
if (typeof window !== "undefined" && typeof document !== "undefined") setTimeout(startAutoSync, 0);
