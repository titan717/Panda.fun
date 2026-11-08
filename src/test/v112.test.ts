import { describe, expect, it } from "vitest";
import { castAndCrew, voteLabel } from "../lib/format";
import { personFacts } from "../pages/Person";
import { title } from "../lib/validate";
import { person } from "../lib/validateLazy";

describe("details enrichment", () => {
  it("lists cast then crew, once per person", () => {
    const d = { cast: [{ id: 1, name: "A", character: "Hero", profile: null }], crew: [{ id: 1, name: "A", job: "Director", profile: null }, { id: 2, name: "B", job: "Music", profile: null }] };
    expect(castAndCrew(d).map((c) => `${c.name}:${c.role}`)).toEqual(["A:Hero", "B:Music"]);
  });
  it("formats vote counts", () => {
    expect(voteLabel(37267)).toBe("37K ratings");
    expect(voteLabel(1250)).toBe("1.3K ratings");
    expect(voteLabel(2_400_000)).toBe("2.4M ratings");
    expect(voteLabel(5)).toBeNull();
  });
  it("builds person facts with age", () => {
    expect(personFacts({ department: "Acting", birthday: "1956-07-09", deathday: null, placeOfBirth: "Concord, USA" }, new Date("2026-11-08")))
      .toEqual(["Actor", "Born 9 July 1956 in Concord, USA (age 70)"]);
    expect(personFacts({ department: "Directing", birthday: "1940-01-01", deathday: "2000-06-01", placeOfBirth: null })[1]).toBe("1 January 1940 – 1 June 2000 (aged 60)");
  });
  it("validates person and collection payloads", () => {
    const p = person("/panda/person/31", { id: 31, name: "Tom Hanks", knownFor: [{ id: "movie:13", tmdbId: 13, type: "movie", title: "Forrest Gump", genres: [], role: "Forrest" }, { bad: true }] });
    expect(p.knownFor).toHaveLength(1);
    expect(p.knownFor[0]?.role).toBe("Forrest");
    const t = title("/panda/title/movie/1", { id: "movie:1", tmdbId: 1, type: "movie", title: "X", genres: [], collection: { id: 5, name: "C", parts: [{ id: "movie:1", tmdbId: 1, type: "movie", title: "X", genres: [] }] } });
    expect(t.collection).toBeNull();
    expect(t.crew).toEqual([]);
  });
});
