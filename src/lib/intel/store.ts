import { revive, type LearnerState } from "./learner";

/**
 * Per-profile persistence for Panda Intelligence: IndexedDB database `panda-intel`, object store `models`, one record
 * per profile id (isolation: a profile never reads another profile's record). Nothing is uploaded, ever.
 *
 *  - Versioned: records carry `schema`; `revive` migrates older shapes and rejects newer/corrupt ones.
 *  - Corruption recovery: a record that fails validation is deleted and the model is rebuilt from the profile's
 *    local history, ratings, lists and feedback (the learner is a deterministic function of those).
 *  - Writes are debounced and happen off the critical path; a failed write keeps the in-memory model.
 *  - Without IndexedDB (old WebViews, private mode, tests) the model lives in memory and is rebuilt per session.
 */
const DB = "panda-intel";
const STORE = "models";
const VERSION = 1;

let dbp: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") { resolve(null); return; }
    try {
      const req = indexedDB.open(DB, VERSION);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbp;
}

function tx<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return open().then((db) => new Promise<T | null>((resolve) => {
    if (!db) { resolve(null); return; }
    try {
      const req = f(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  }));
}

export type LoadResult = { state: LearnerState | null; status: "ok" | "missing" | "corrupt" | "unavailable" };

export async function loadModel(profileId: string): Promise<LoadResult> {
  const db = await open();
  if (!db) return { state: null, status: "unavailable" };
  const raw = await tx("readonly", (s) => s.get(profileId));
  if (raw == null) return { state: null, status: "missing" };
  const state = revive(raw, profileId);
  if (!state) { await deleteModel(profileId); return { state: null, status: "corrupt" }; }
  return { state, status: "ok" };
}

export async function saveModel(s: LearnerState): Promise<boolean> {
  return (await tx("readwrite", (st) => st.put(s, s.profileId))) !== null;
}

export async function deleteModel(profileId: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(profileId));
}

/** Profiles deleted from the app: drop their models too (privacy). */
export async function pruneModels(keep: ReadonlySet<string>): Promise<void> {
  const ids = (await tx("readonly", (s) => s.getAllKeys())) ?? [];
  for (const id of ids) if (typeof id === "string" && !keep.has(id)) await deleteModel(id);
}

export function resetStoreForTest() { dbp = null; }
