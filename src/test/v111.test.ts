import { describe, expect, it } from "vitest";
import { sortResults } from "../lib/useSearchState";
import type { PandaItem } from "../lib/types";

const mk = (id: string, releaseDate: string, rating: number) => ({ id, releaseDate, rating, genres: [] }) as unknown as PandaItem;
const list = [mk("a", "2001-01-01", 9), mk("b", "2024-05-01", 6), mk("c", "2015-01-01", 7.5)];

describe("search sort", () => {
  it("keeps backend order for best match", () => expect(sortResults(list, "relevance").map((i) => i.id)).toEqual(["a", "b", "c"]));
  it("sorts newest first", () => expect(sortResults(list, "newest").map((i) => i.id)).toEqual(["b", "c", "a"]));
  it("sorts by rating", () => expect(sortResults(list, "rating").map((i) => i.id)).toEqual(["a", "c", "b"]));
  it("does not mutate the input", () => { sortResults(list, "newest"); expect(list[0]?.id).toBe("a"); });
});

import { search } from "../lib/validate";
describe("search payload validation", () => {
  it("keeps smart-search hints", () => {
    const p = search("/search", { query: "tom hanks", results: [], people: ["Tom Hanks", 4], corrected: "X", interpreted: "" });
    expect(p.people).toEqual(["Tom Hanks"]);
    expect(p.corrected).toBe("X");
    expect(p.interpreted).toBeUndefined();
  });
});
