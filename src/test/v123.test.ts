import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getState, replaceState, type State } from "../lib/store";
import {
  ALPHABET, createCode, decrypt, deriveKeys, emptyClock, encrypt, formatCode, generateCode, merge, normalizeCode, readLink,
  rebuild, regenerateCode, restoreFromCode, revokeCode, stopAutoSync, syncNow, track, typingCode,
} from "../lib/sync";
import type { PandaItem } from "../lib/types";

const item = (n: number): PandaItem => ({ id: `movie-${n}`, tmdbId: n, type: "movie", title: `Film ${n}`, year: 2020, rating: 7, poster: null, posterLarge: null, backdrop: null, backdropLarge: null, overview: null, genres: [] } as unknown as PandaItem);

function baseState(name = "Ana", id = "pa"): State {
  const s = getState();
  return {
    ...s,
    profiles: [{ id, name, avatar: "smile", kids: false, createdAt: 1 }],
    activeProfileId: id,
    data: { [id]: { watchlist: [], lists: [], history: {}, ratings: {}, recentSearches: [], recentTitles: [], reminders: [], alertsSeenAt: 0, alerted: [] } },
    profilePrefs: { [id]: {} },
  };
}

describe("sync code (v1.2.3)", () => {
  it("is 12 unambiguous base32 characters grouped XXXX-XXXX-XXXX", () => {
    for (let i = 0; i < 50; i++) {
      const c = generateCode();
      expect(c).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
      expect(c).not.toMatch(/[ILOU]/);
    }
    expect(ALPHABET).toHaveLength(32);
  });

  it("reads look-alike characters and any spacing the same way", () => {
    expect(normalizeCode("7kq2 m9tx 4hrb")).toBe("7KQ2M9TX4HRB");
    expect(normalizeCode("OIL0-1100-UUUU")).toBe("0110-1100-VVVV".replace(/-/g, ""));
    expect(normalizeCode("7KQ2-M9TX-4HR")).toBeNull();
    expect(normalizeCode("7KQ2-M9TX-4HR!")).toBeNull();
    expect(typingCode("7kq2m9")).toBe("7KQ2-M9");
    expect(formatCode("7KQ2M9TX4HRB")).toBe("7KQ2-M9TX-4HRB");
  });

  it("derives the same key and lookup id from the code on every device, and different ones for another code", async () => {
    const a = await deriveKeys("7KQ2-M9TX-4HRB", 1000);
    const b = await deriveKeys("7kq2 m9tx 4hrb", 1000);
    const c = await deriveKeys("7KQ2-M9TX-4HRC", 1000);
    expect(a.id).toMatch(/^[a-f0-9]{32}$/);
    expect(a.id).toBe(b.id);
    expect(c.id).not.toBe(a.id);
    // the lookup id says nothing about the code itself
    expect(a.id).not.toContain("7kq2");
  });

  it("encrypts so only the same code opens the backup", async () => {
    const k = await deriveKeys("7KQ2-M9TX-4HRB", 1000);
    const doc = { v: 1 as const, at: 5, items: { "p:x": { t: 3, d: { name: "Ana's secret list" } } } };
    const blob = await encrypt(k, doc);
    expect(blob).not.toContain("Ana");
    expect(JSON.parse(blob)).toMatchObject({ v: 1 });
    expect(await decrypt(k, blob)).toEqual(doc);
    const wrong = await deriveKeys("7KQ2-M9TX-4HRC", 1000);
    await expect(decrypt(wrong, blob)).rejects.toThrow();
  });
});

describe("per-item merge (v1.2.3)", () => {
  it("keeps the newest change of each item and counts real conflicts", () => {
    const local = { a: { t: 20, d: 1 }, b: { t: 5, d: "x" }, c: { t: 30, d: null } };
    const remote = { a: { t: 25, d: 2 }, b: { t: 9, d: "y" }, c: { t: 12, d: "kept?" }, d: { t: 1, d: "new" } };
    const r = merge(local, remote, 10);
    expect(r.items.a).toEqual({ t: 25, d: 2 }); // both changed after last sync → conflict, newest kept
    expect(r.items.b).toEqual({ t: 9, d: "y" });
    expect(r.items.c).toEqual({ t: 30, d: null }); // newer deletion wins
    expect(r.items.d).toEqual({ t: 1, d: "new" });
    expect(r.conflicts).toBe(2); // a and c changed on both sides; b changed only on the backup
  });

  it("a tie keeps the backup's value; nothing counts as a conflict on the first sync", () => {
    const r = merge({ a: { t: 5, d: 1 } }, { a: { t: 5, d: 2 } }, 0);
    expect(r.items.a!.d).toBe(2);
    expect(r.conflicts).toBe(0);
  });

  it("stamps changes, turns removals into deletions and keeps watchlist order across devices", () => {
    const clock = emptyClock();
    const s = baseState();
    s.data.pa!.watchlist = [item(3), item(2), item(1)];
    const first = track(clock, s, 1000);
    expect(first["w:pa:movie-1"]!.t).toBe(1000);
    const s2 = { ...s, data: { pa: { ...s.data.pa!, watchlist: [item(4), item(3), item(1)] } } };
    const second = track(clock, s2, 2000);
    expect(second["w:pa:movie-2"]).toEqual({ t: 2000, d: null });
    expect(second["w:pa:movie-4"]!.t).toBe(2000);
    expect(second["w:pa:movie-3"]!.t).toBe(1000);
    const rebuilt = rebuild(second, s2);
    expect(rebuilt.data.pa!.watchlist.map((i) => i.id)).toEqual(["movie-4", "movie-3", "movie-1"]);
  });

  it("watch progress keeps its own time and this device's layout never travels", () => {
    const clock = emptyClock();
    const s = baseState();
    s.prefs = { ...s.prefs, layout: "tv" } as State["prefs"];
    s.data.pa!.history = { "movie-9": { item: item(9), position: 60, duration: 100, updatedAt: 5000 } as never };
    const items = track(clock, s, 3000);
    expect(items["h:pa:movie-9"]!.t).toBe(5000);
    expect(Object.keys(items).some((k) => k === "g:layout" || k === "g:notifiedTag")).toBe(false);
  });
});

/* ---------- two devices talking to a fake backend that behaves like /api/v1/panda/sync ---------- */

const server = new Map<string, { version: number; blob: string; updatedAt: number } | { revoked: true }>();
function fakeFetch(url: string, init: RequestInit = {}) {
  const id = url.split("/").pop()!;
  const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  const rec = server.get(id);
  if (init.method === "GET" || !init.method) return rec && !("revoked" in rec) ? json(200, { data: rec }) : json(404, { error: { code: "SYNC_NOT_FOUND", triesLeft: 4 } });
  if (init.method === "DELETE") { if (!rec) return json(404, {}); server.set(id, { revoked: true }); return json(200, { data: { revoked: true } }); }
  const body = JSON.parse(String(init.body)) as { blob: string; base: number | null };
  const live = rec && !("revoked" in rec) ? rec : null;
  if (body.base !== null && !live) return json(410, { error: { code: "SYNC_REVOKED" } });
  if ((live?.version ?? null) !== body.base) return json(409, { data: live });
  const next = { version: (live?.version ?? 0) + 1, blob: body.blob, updatedAt: Date.now() };
  server.set(id, next);
  return json(200, { data: { version: next.version, updatedAt: next.updatedAt } });
}

describe("sync between two devices (v1.2.3)", () => {
  beforeEach(() => { server.clear(); localStorage.clear(); vi.stubGlobal("fetch", vi.fn(fakeFetch)); });
  afterEach(() => { stopAutoSync(); vi.unstubAllGlobals(); });

  it("creates a code, restores profiles and lists elsewhere, merges both ways, regenerates and revokes", async () => {
    // device A
    const a = baseState("Ana", "pa");
    a.data.pa!.watchlist = [item(1)];
    a.data.pa!.lists = [{ id: "l1", name: "Weekend", items: [item(2)], createdAt: 1, updatedAt: 1 }];
    replaceState(a);
    const code = await createCode();
    expect(readLink()!.code).toBe(code);
    expect(server.size).toBe(1);
    const linkA = localStorage.getItem("panda:v1:sync")!;

    // device B: fresh install with its untouched starter profile
    localStorage.clear();
    replaceState(baseState("You", "pb"));
    await expect(restoreFromCode("ZZZZ-ZZZZ-ZZZZ")).rejects.toThrow(/tries left/);
    const r = await restoreFromCode(code.toLowerCase().replace(/-/g, " "));
    expect(r.profiles).toBe(1);
    expect(getState().profiles.map((p) => p.name)).toEqual(["Ana"]);
    expect(getState().data.pa!.lists[0]!.name).toBe("Weekend");
    // B adds a title and syncs
    const b = getState();
    replaceState({ ...b, data: { pa: { ...b.data.pa!, watchlist: [item(7), ...b.data.pa!.watchlist] } } });
    await syncNow();
    const linkB = localStorage.getItem("panda:v1:sync")!;

    // back on A: picks up B's title
    localStorage.setItem("panda:v1:sync", linkA);
    replaceState(a);
    await syncNow();
    expect(getState().data.pa!.watchlist.map((i) => i.id)).toEqual(["movie-7", "movie-1"]);

    // A regenerates: the old code stops working and B is told on its next sync
    const fresh = await regenerateCode();
    expect(fresh).not.toBe(code);
    localStorage.setItem("panda:v1:sync", linkB);
    await expect(syncNow()).rejects.toThrow(/revoked/);
    expect(readLink()).toBeNull();

    // A revokes: the backup is gone
    localStorage.setItem("panda:v1:sync", JSON.stringify({ ...JSON.parse(linkA), code: fresh, id: (await deriveKeys(fresh)).id, version: 1 }));
    await revokeCode();
    expect(readLink()).toBeNull();
    await expect(restoreFromCode(fresh)).rejects.toThrow(/No backup/);
  }, 30_000);

  it("locks the restore field after 5 wrong codes", async () => {
    replaceState(baseState());
    for (let i = 0; i < 5; i++) await restoreFromCode("ZZZZ-ZZZZ-ZZZ" + ALPHABET[i]).catch(() => undefined);
    await expect(restoreFromCode("ZZZZ-ZZZZ-ZZZY")).rejects.toThrow(/Try again later/);
  }, 30_000);
});
