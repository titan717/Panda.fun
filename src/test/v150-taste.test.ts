import { describe, expect, it } from "vitest";
import { emptyState } from "../lib/intel/learner";
import { memoryEntries, tasteGroups } from "../pages/TasteDna";

describe("v1.5.0 Taste DNA page model", () => {
  it("shows nothing for a fresh profile", () => {
    const s = emptyState("p1");
    expect(tasteGroups(s)).toEqual([]);
    expect(memoryEntries(s)).toEqual([]);
  });
  it("lists memory newest first, one row per title, skips forgotten and flags non-learning events", () => {
    const s = emptyState("p1");
    s.features = { "movie:1": { id: "movie:1", title: "A" } as never, "movie:2": { id: "movie:2", title: "B" } as never, "movie:3": { id: "movie:3", title: "C" } as never };
    s.log = [
      { id: "movie:1", kind: "complete", at: 1 },
      { id: "movie:2", kind: "playback-failed", at: 2 },
      { id: "movie:1", kind: "like", at: 3 },
      { id: "movie:3", kind: "love", at: 4 }
    ];
    s.forgotten = { "movie:3": 1 } as never;
    const m = memoryEntries(s);
    expect(m.map((x) => x.title)).toEqual(["A", "B"]);
    expect(m[0]!.kind).toBe("like");
    expect(m[1]!.counts).toBe(false);
  });
});

describe("v1.5.0 Smart Continue Watching", () => {
  it("puts a new episode and a half-watched movie ahead of slightly newer entries, and sinks stale samples", async () => {
    const { continueWatching } = await import("../lib/store");
    const now = Date.UTC(2026, 10, 15);
    const H = 3600_000, D = 24 * H;
    const item = (id: string, type: "movie" | "tv") => ({ id, type, title: id, genres: [] }) as never;
    const history = {
      a: { item: item("movie:a", "movie"), position: 600, duration: 6000, completed: false, updatedAt: now - 2 * H },
      b: { item: item("movie:b", "movie"), position: 4000, duration: 6000, completed: false, updatedAt: now - 6 * H },
      c: { item: item("movie:c", "movie"), position: 300, duration: 6000, completed: false, updatedAt: now - 25 * D },
      d: { item: item("movie:d", "movie"), position: 3000, duration: 6000, completed: false, updatedAt: now - 30 * D }
    } as never;
    expect(continueWatching(history, now).map((h) => h.item.id)).toEqual(["movie:b", "movie:a", "movie:d", "movie:c"]);
  });
});

describe("v1.5.0 Surprise Me", () => {
  it("picks only real, unopened, unhidden titles, and only kid-friendly ones on kids profiles", async () => {
    const { pickSurprise, surprisePath } = await import("../lib/intel/surprise");
    const s = emptyState("p1");
    const f = (id: string, genres: string[], rating = 7.5) => ({ id, type: id.split(":")[0], title: id, genres, language: "en", year: 2020, rating });
    s.features = { "movie:1": f("movie:1", ["Horror"]), "movie:2": f("movie:2", ["Animation"]), "movie:3": f("movie:3", ["Drama"], 5), "tv:4": f("tv:4", ["Drama"]) } as never;
    s.log = [{ id: "tv:4", kind: "open", at: 1 }];
    expect(pickSurprise(emptyState("p2"), { exclude: new Set(), kids: false })).toBeNull();
    const all = new Set(Array.from({ length: 30 }, (_, i) => pickSurprise(s, { exclude: new Set(), kids: false, rand: () => (i % 10) / 10 })!.id));
    expect([...all].sort()).toEqual(["movie:1", "movie:2"]);
    expect(pickSurprise(s, { exclude: new Set(["movie:2"]), kids: true })).toBeNull();
    expect(pickSurprise(s, { exclude: new Set(), kids: true })!.id).toBe("movie:2");
    expect(surprisePath(f("movie:2", []) as never)).toBe("/title/movie/2");
  });
});
