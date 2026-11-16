import { afterEach, describe, expect, it, vi } from "vitest";
import { CATEGORIES, categoryById, categoryPaths, parseCategoryId, railVariant, registerCategories } from "../lib/feed/catalog";
import { interleave, personalCategories } from "../lib/feed/personal";
import { SECOND_PASS, buildFeedRows, feedOrder, fetchBatch, personalOrder } from "../lib/feed/useFeed";
import { fromDetails, fromItem } from "../lib/intel/features";
import { applyInteraction, emptyState, rememberFeatures, tasteDrift, type LearnerState } from "../lib/intel/learner";
import type { PandaItem, TitleDetails } from "../lib/types";

const NOW = Date.UTC(2026, 10, 15);
const DAY = 86_400_000;
const item = (n: number, o: Partial<PandaItem> = {}): PandaItem => ({
  id: `movie:${n}`, tmdbId: n, type: "movie", title: `T${n}`, year: 2020, rating: 7, poster: "p", backdrop: null, overview: "", genres: ["Drama"], language: "en", releaseDate: "2020-01-01", ...o
} as PandaItem);
const det = (n: number, o: { dir?: [number, string]; cast?: [number, string][]; col?: [number, string]; genres?: string[] } = {}): TitleDetails => ({
  ...item(n, { genres: o.genres ?? ["Drama"] }),
  crew: o.dir ? [{ id: o.dir[0], name: o.dir[1], job: "Director" }] : [],
  cast: (o.cast ?? []).map(([id, name]) => ({ id, name, character: "X" })),
  collection: o.col ? { id: o.col[0], name: o.col[1] } : null
} as unknown as TitleDetails);
/** A profile that finished `ts` titles (in order, a day apart). */
function watched(ts: TitleDetails[], start = NOW - ts.length * DAY): LearnerState {
  const s = emptyState("p", 0);
  ts.forEach((d, k) => {
    rememberFeatures(s, fromDetails(d), start + k * DAY);
    applyInteraction(s, { id: d.id, kind: "complete", at: start + k * DAY }, start + k * DAY, Object.keys(s.features).sort());
  });
  return s;
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("v1.5.0 personal rails come from the profile's own evidence", () => {
  it("no evidence, no personal rails (new profile, kids profile, Movies/TV pages)", () => {
    expect(personalCategories(null, { kids: false, kind: "home" })).toEqual([]);
    const s = watched([det(1), det(2)]);
    expect(personalCategories(s, { kids: false, kind: "home" })).toEqual([]);
    const rich = watched(Array.from({ length: 8 }, (_, k) => det(k + 1, { dir: [77, "Denis Villeneuve"] })));
    expect(personalCategories(rich, { kids: true, kind: "home" })).toEqual([]);
    expect(personalCategories(rich, { kids: false, kind: "movies" })).toEqual([]);
  });
  it("a director of finished titles gets a 'Directed by' rail with the real titles as its reason", () => {
    const s = watched([
      det(1, { dir: [77, "Denis Villeneuve"], cast: [[5, "Amy Adams"]] }), det(2, { dir: [77, "Denis Villeneuve"] }),
      det(3), det(4), det(5), det(6)
    ]);
    const p = personalCategories(s, { kids: false, kind: "home" });
    const dir = p.find((c) => c.id === "p-dir-77");
    expect(dir?.title).toBe("Directed by Denis Villeneuve");
    expect(dir?.note).toMatch(/^Because you watched T[12]( and T[12])?$/);
    expect(dir?.source).toEqual({ kind: "person", type: "all", person: 77, role: "director" });
    // one title with an actor is not enough evidence for a "Starring" rail
    expect(p.some((c) => c.id === "p-cast-5")).toBe(false);
  });
  it("an actor in two finished titles, and a franchise in release order", () => {
    const s = watched([
      det(1, { cast: [[5, "Amy Adams"]], col: [9, "Dune Collection"] }), det(2, { cast: [[5, "Amy Adams"]] }),
      det(3), det(4), det(5)
    ]);
    const p = personalCategories(s, { kids: false, kind: "home" });
    expect(p.find((c) => c.id === "p-cast-5")?.title).toBe("Starring Amy Adams");
    const col = p.find((c) => c.id === "p-col-9")!;
    expect(col.title).toBe("Dune Collection");
    expect(col.note).toBe("In release order");
    expect(col.keepOrder).toBe(true);
    expect(railVariant(col)).toBe("franchise");
  });
  it("a genre watched much more lately than over the long term is an emerging interest", () => {
    const old = Array.from({ length: 10 }, (_, k) => det(100 + k, { genres: ["Comedy"] }));
    const recent = Array.from({ length: 6 }, (_, k) => det(200 + k, { genres: ["Thriller"] }));
    const s = emptyState("p", 0);
    const at = (k: number, recentOne: boolean) => (recentOne ? NOW - (6 - k) * DAY : NOW - 300 * DAY + k * DAY);
    [...old.map((d, k) => [d, at(k, false)] as const), ...recent.map((d, k) => [d, at(k, true)] as const)].forEach(([d, t]) => {
      rememberFeatures(s, fromDetails(d), t);
      applyInteraction(s, { id: d.id, kind: "complete", at: t }, t, Object.keys(s.features).sort());
    });
    const drift = tasteDrift(s);
    expect(drift[0]!.key).toBe("g:Thriller");
    expect(drift.find((d) => d.key === "g:Comedy")!.delta).toBeLessThan(0);
    const p = personalCategories(s, { kids: false, kind: "home" });
    expect(p.find((c) => c.id.startsWith("p-new-"))?.title).toBe("New Interest: Thriller Movies");
  });
  it("'something different' never picks a genre the profile asked for less of, or one it already likes", () => {
    const s = watched(Array.from({ length: 12 }, (_, k) => det(k + 1, { genres: ["Drama"] })));
    for (const [, g] of [[0, "Action"], [0, "Adventure"], [0, "Animation"], [0, "Comedy"], [0, "Crime"]]) s.overrides[`g:${g}`] = -1;
    const p = personalCategories(s, { kids: false, kind: "home" });
    const diff = p.find((c) => c.id.startsWith("p-diff-"))!;
    expect(diff).toBeTruthy();
    expect(["Drama", "Action", "Adventure", "Animation", "Comedy", "Crime"]).not.toContain(diff.genres[0]);
  });
});

describe("v1.5.0 feed order, rounds and rails", () => {
  it("interleaves personal rails into the ranked order, then a second pass with the next pages", () => {
    expect(interleave(["a", "b", "c", "d", "e", "f", "g"], ["P1", "P2"])).toEqual(["a", "P1", "b", "c", "d", "P2", "e", "f", "g"]);
    const order = feedOrder(CATEGORIES, []);
    expect(order.length).toBe(CATEGORIES.length + SECOND_PASS);
    expect(order.at(-1)).toMatch(/@2$/);
    expect(new Set(order).size).toBe(order.length);
  });
  it("round 2 of a rail is its next pages, titled 'More …'; person and franchise rails have no round 2", () => {
    expect(parseCategoryId("movie-horror@2")).toEqual({ base: "movie-horror", round: 2 });
    const c = categoryById("movie-horror@2")!;
    expect(c.title).toBe("More Horror Movies");
    expect(categoryPaths(c)).toEqual(["/panda/discover/movie?genre=27&page=2"]);
    const gems = categoryById("gems-ml@2")!;
    expect(categoryPaths(gems)).toEqual(["/panda/discover/movie?lang=ml&page=5", "/panda/discover/movie?lang=ml&page=6"]);
    registerCategories([{ id: "p-dir-1", title: "Directed by X", family: "personal", genres: [], prior: 1, source: { kind: "person", type: "all", person: 1, role: "director" } }]);
    expect(categoryById("p-dir-1")).toBeTruthy();
    expect(categoryById("p-dir-1@2")).toBeUndefined();
  });
  it("a franchise rail keeps every part in order (watched ones too) while something is left to watch", () => {
    registerCategories([{ id: "p-col-9", title: "Saga", family: "personal", genres: [], prior: 1, keepOrder: true, minItems: 2, variant: "franchise", source: { kind: "collection", type: "all", collection: 9 } }]);
    const parts = [item(1), item(2), item(3)];
    const notWatched = (i: PandaItem) => i.tmdbId === 3;
    const rows = buildFeedRows([[{ id: "p-col-9", items: parts }]], ["movie:1"], notWatched, undefined, () => true);
    expect(rows[0]!.items.map((i) => i.tmdbId)).toEqual([1, 2, 3]);
    expect(rows[0]!.variant).toBe("franchise");
    expect(buildFeedRows([[{ id: "p-col-9", items: parts }]], [], () => false, undefined, () => true)).toEqual([]);
  });
  it("rail variants: acclaimed rails are spotlights, new releases compact, gems and moods styled", () => {
    const rows = buildFeedRows([[{ id: "acclaimed-movie-drama", items: Array.from({ length: 8 }, (_, k) => item(k + 1)) }]], [], () => true);
    expect(rows[0]).toMatchObject({ kind: "landscape", variant: "spotlight" });
    expect(railVariant(categoryById("new-tv")!)).toBe("compact");
    expect(railVariant(categoryById("gems-movies")!)).toBe("gems");
    expect(railVariant(categoryById("mood-funny")!)).toBe("mood");
  });
  it("a failed category gives no rail; a batch where every request failed is an error, not an empty result", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    await expect(fetchBatch("/panda/feed/home?d=x&c=movie-horror,movie-drama")).rejects.toBeTruthy();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (String(url).includes("genre=27")
      ? new Response(JSON.stringify({ success: true, data: { page: 1, totalPages: 1, totalResults: 1, results: [] } }), { status: 200 })
      : Promise.reject(new TypeError("offline")))));
    const r = await fetchBatch("/panda/feed/home?d=x&c=movie-horror,movie-drama");
    expect(r[0]).toMatchObject({ id: "movie-horror" });
    expect(r[1]).toMatchObject({ id: "movie-drama", failed: true });
  }, 20_000);
  it("person rails keep only the role they are about; franchises are sorted by release date", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const u = String(url);
      const body = u.includes("/panda/person/")
        ? { id: 1, name: "X", profile: null, profileLarge: null, biography: null, birthday: null, deathday: null, placeOfBirth: null, department: "Directing", imdbId: null,
          knownFor: [{ ...item(1), role: "Director" }, { ...item(2), role: "Screenplay" }, { ...item(3), role: "Hero" }, { ...item(4), role: "Producer" }] }
        : { id: 9, name: "Saga", overview: null, poster: null, backdrop: null, parts: [item(3, { releaseDate: "2021-01-01" }), item(1, { releaseDate: "1999-05-01" }), item(2, { releaseDate: "" })] };
      return new Response(JSON.stringify({ success: true, data: body }), { status: 200 });
    }));
    registerCategories([
      { id: "p-dir-1", title: "D", family: "personal", genres: [], prior: 1, source: { kind: "person", type: "all", person: 1, role: "director" } },
      { id: "p-cast-1", title: "A", family: "personal", genres: [], prior: 1, source: { kind: "person", type: "all", person: 1, role: "actor" } },
      { id: "p-col-9", title: "S", family: "personal", genres: [], prior: 1, keepOrder: true, source: { kind: "collection", type: "all", collection: 9 } }
    ]);
    const r = await fetchBatch("/panda/feed/home?d=x&c=p-dir-1,p-cast-1,p-col-9");
    expect(r[0]!.items.map((i) => i.tmdbId)).toEqual([1]);
    expect(r[1]!.items.map((i) => i.tmdbId)).toEqual([3]);
    expect(r[2]!.items.map((i) => i.tmdbId)).toEqual([1, 3, 2]);
  });
});

describe("v1.5.0 titles inside a rail are ranked for the profile", () => {
  it("keeps the catalogue order for a new profile, and blends in the model as it learns", () => {
    const list = Array.from({ length: 10 }, (_, k) => item(k + 1, { genres: k >= 7 ? ["Horror"] : ["Drama"] }));
    expect(personalOrder(list, emptyState("p", 0)).map((i) => i.tmdbId)).toEqual(list.map((i) => i.tmdbId));
    const s = watched(Array.from({ length: 40 }, (_, k) => det(100 + k, { genres: ["Horror"] })));
    for (const it of list) rememberFeatures(s, fromItem(it), NOW);
    const out = personalOrder(list, s, 0.6, NOW).map((i) => i.tmdbId);
    expect(out.slice(0, 5)).toContain(8);
    expect(out.indexOf(8)).toBeLessThan(7);
    // not a full re-sort: the catalogue's top title stays near the top
    expect(out.indexOf(1)).toBeLessThan(5);
    expect(new Set(out).size).toBe(10);
  });
});
