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
    s.forgotten = { "movie:3": 5 };
    const m = memoryEntries(s);
    expect(m.map((x) => x.title)).toEqual(["A", "B"]);
    expect(m[0]!.kind).toBe("like");
    expect(m[1]!.counts).toBe(false);
  });
});
