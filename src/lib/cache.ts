import type { Cache, State } from "swr";

/**
 * Persistent SWR cache (spec §8 "instant warm start").
 *
 * API payloads are stored in IndexedDB (no 5 MB localStorage ceiling, writes off the main thread).
 * Before the first render `hydrateCache()` reads every entry into memory, so screens paint from
 * the previous session in the first frame and SWR revalidates in the background.
 * localStorage is used only when IndexedDB is unavailable (old WebViews, private mode).
 */
const DB = "panda-cache";
const STORE = "swr";
const LEGACY_KEY = "panda:v1:swr";
const LS_KEY = "panda:v2:swr";
const MAX = 150;
const MAX_AGE = 7 * 24 * 3600 * 1000;

type Entry = { k: string; data: unknown; at: number };
const seed = new Map<string, Entry>();
let db: IDBDatabase | null = null;
let useLocalStorage = false;

export const persistable = (k: string) => k.startsWith("/panda/") && !k.startsWith("/panda/play") && !k.startsWith("/panda/search") && !k.startsWith("/panda/sources");

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: "k" }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("blocked"));
  });
}

function readLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) for (const e of JSON.parse(raw) as Entry[]) seed.set(e.k, e);
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      for (const [k, data] of JSON.parse(legacy) as [string, unknown][]) if (!seed.has(k)) seed.set(k, { k, data, at: Date.now() - MAX_AGE / 2 });
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch { /* corrupted cache is ignored */ }
}

/** Loads the persisted cache into memory. Resolves within `budgetMs` even if IndexedDB is slow. */
export async function hydrateCache(budgetMs = 300): Promise<void> {
  const work = (async () => {
    if (typeof indexedDB === "undefined") { useLocalStorage = true; readLocalStorage(); return; }
    try {
      db = await openDb();
      const all = await new Promise<Entry[]>((resolve, reject) => {
        const req = db!.transaction(STORE, "readonly").objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result as Entry[]);
        req.onerror = () => reject(req.error);
      });
      const now = Date.now();
      for (const e of all.sort((a, b) => a.at - b.at)) if (now - e.at < MAX_AGE && !seed.has(e.k)) seed.set(e.k, e);
      // migrate the v1 localStorage cache once
      try {
        const legacy = localStorage.getItem(LEGACY_KEY);
        if (legacy) {
          for (const [k, data] of JSON.parse(legacy) as [string, unknown][]) if (!seed.has(k)) { const e = { k, data, at: now - MAX_AGE / 2 }; seed.set(k, e); write(e); }
          localStorage.removeItem(LEGACY_KEY);
        }
      } catch { /* ignore */ }
    } catch {
      useLocalStorage = true;
      readLocalStorage();
    }
  })();
  await Promise.race([work, new Promise((r) => setTimeout(r, budgetMs))]);
}

const pending = new Map<string, Entry | null>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function write(e: Entry) { pending.set(e.k, e); scheduleFlush(); }
function remove(k: string) { pending.set(k, null); scheduleFlush(); }
function scheduleFlush() { if (!flushTimer) flushTimer = setTimeout(flush, 1200); }

export function flush() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (pending.size === 0) return;
  const batch = [...pending.entries()];
  pending.clear();
  if (db && !useLocalStorage) {
    try {
      const store = db.transaction(STORE, "readwrite").objectStore(STORE);
      for (const [k, e] of batch) { if (e) store.put(e); else store.delete(k); }
      if (seed.size > MAX) for (const k of [...seed.keys()].slice(0, seed.size - MAX)) { store.delete(k); seed.delete(k); }
      return;
    } catch { useLocalStorage = true; }
  }
  try {
    const entries = [...seed.values()].slice(-MAX);
    localStorage.setItem(LS_KEY, JSON.stringify(entries));
  } catch {
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  }
}

/** Drops every cached payload (Settings → Data & storage → Clear cache). */
export async function clearPersistentCache() {
  seed.clear();
  pending.clear();
  try { localStorage.removeItem(LS_KEY); localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
  if (db) await new Promise<void>((resolve) => { const tx = db!.transaction(STORE, "readwrite"); tx.objectStore(STORE).clear(); tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); });
}

/** Approximate bytes used by cached payloads. */
export function cacheStats() {
  let bytes = 0;
  for (const e of seed.values()) bytes += JSON.stringify(e.data).length;
  return { entries: seed.size, bytes };
}

export function persistentCache(): Cache {
  const map = new Map<string, State>();
  for (const [k, e] of seed) map.set(k, { data: e.data });
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  }
  return {
    keys: () => map.keys(),
    get: (k: string) => map.get(k),
    set: (k: string, v: State) => {
      const prev = map.get(k);
      map.set(k, v);
      if (v.data !== undefined && v.data !== prev?.data && persistable(k)) {
        const e = { k, data: v.data, at: Date.now() };
        seed.delete(k);
        seed.set(k, e);
        write(e);
      }
    },
    delete: (k: string) => { map.delete(k); if (seed.delete(k)) remove(k); }
  };
}
