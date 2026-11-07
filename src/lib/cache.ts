import type { Cache, State } from "swr";

/**
 * SWR cache persisted to localStorage so the app paints instantly from the last session
 * (important while the backend cold-starts) and then revalidates in the background.
 * Only API payloads are stored, capped at MAX entries, newest kept.
 */
const KEY = "panda:v1:swr";
const MAX = 60;

export function persistentCache(): Cache {
  const map = new Map<string, State>();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) for (const [k, data] of JSON.parse(raw) as [string, unknown][]) map.set(k, { data });
  } catch { /* corrupted cache is ignored */ }

  const save = () => {
    try {
      const entries = [...map.entries()].filter(([k, v]) => k.startsWith("/panda/") && !k.startsWith("/panda/play") && v.data !== undefined).slice(-MAX).map(([k, v]) => [k, v.data]);
      localStorage.setItem(KEY, JSON.stringify(entries));
    } catch {
      try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    }
  };
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => { if (timer) clearTimeout(timer); timer = setTimeout(save, 1500); };
  window.addEventListener("pagehide", save);

  return {
    keys: () => map.keys(),
    get: (k: string) => map.get(k),
    set: (k: string, v: State) => {
      map.delete(k); // keep insertion order = recency
      map.set(k, v);
      if (v.data !== undefined) schedule();
    },
    delete: (k: string) => { map.delete(k); schedule(); }
  };
}
