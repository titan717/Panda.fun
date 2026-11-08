import { describe, expect, it } from "vitest";
import { collectionFacts, nextPart } from "../pages/Collection";
import { whatsNewSection } from "../lib/updates";
import { collectionPage } from "../lib/validate";
import type { PandaItem } from "../lib/types";

const it_ = (n: number, year: number | null): PandaItem => ({ id: `movie:${n}`, tmdbId: n, type: "movie", title: `M${n}`, year, genres: [] } as unknown as PandaItem);

describe("v1.1.8 collection page", () => {
  it("summarises count and year span", () => {
    expect(collectionFacts({ parts: [it_(1, 2005), it_(2, 2008), it_(3, 2012)] })).toBe("3 movies • 2005–2012");
    expect(collectionFacts({ parts: [it_(1, 2020), it_(2, 2020)] })).toBe("2 movies • 2020");
    expect(collectionFacts({ parts: [it_(1, null), it_(2, null)] })).toBe("2 movies");
  });
  it("plays the first unfinished part", () => {
    const parts = [it_(1, 2005), it_(2, 2008), it_(3, 2012)];
    expect(nextPart(parts, {})?.tmdbId).toBe(1);
    expect(nextPart(parts, { "movie:1": { completed: true } })?.tmdbId).toBe(2);
    expect(nextPart(parts, { "movie:1": { completed: true }, "movie:2": { completed: true }, "movie:3": { completed: true } })?.tmdbId).toBe(1);
  });
  it("validates the collection payload", () => {
    expect(() => collectionPage("/panda/collection/1", { id: 1, name: "C", parts: [] })).toThrow();
  });
});

describe("v1.1.8 release notes", () => {
  it("extracts the What's New section without the changelog link", () => {
    const md = "# Panda.fun v1.1.8\n\nIntro\n\n## What's new in 1.1.8\n\n- **A**: b\n\n**Full Changelog**: x";
    expect(whatsNewSection(md, "1.1.8")).toBe("- **A**: b");
  });
});
