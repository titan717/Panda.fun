import { describe, expect, it } from "vitest";
import { parseIntent } from "../lib/intel/intent";
import { fromItem } from "../lib/intel/features";
import { applyInteraction, emptyState, rememberFeatures } from "../lib/intel/learner";
import type { PandaItem } from "../lib/types";

const qs = (href: string) => new URLSearchParams(href.split("?")[1] ?? "");
const item = (n: number, g: string[]): PandaItem => ({ id: `movie:${n}`, tmdbId: n, type: "movie", title: `T${n}`, year: 2020, rating: 7, poster: "p", backdrop: null, overview: "", genres: g, language: "en", releaseDate: "2020-01-01" } as PandaItem);

describe("v1.5.0 local conversational discovery", () => {
  it("reads genre, language, type and tone into a real browse", () => {
    const i = parseIntent("dark korean thriller shows");
    const c = i.chips.find((x) => x.id === "intent-browse")!;
    expect(c.href.startsWith("/browse/tv?")).toBe(true);
    expect(qs(c.href).get("lang")).toBe("ko");
    expect(qs(c.href).get("genre")).toBe("80|9648"); // TMDB TV has no Thriller genre: Crime | Mystery, like the mood rails
    expect(i.unknown).toEqual([]);
    const m = parseIntent("underrated sci-fi movies");
    const mc = m.chips[0]!;
    expect(mc.href.startsWith("/browse/movie?")).toBe(true);
    expect(qs(mc.href).get("genre")).toBe("878");
    expect(qs(mc.href).get("sort")).toBe("vote_average.desc");
    expect(mc.label).toBe("Underrated Sci-Fi Movies");
    expect(parseIntent("lighter please").chips[0]!.href).toContain("genre=35%7C10751");
  });

  it("'like X' resolves only to a title the profile knows, never an invented one", () => {
    const known = [{ id: "movie:157336", type: "movie" as const, title: "Interstellar" }];
    const a = parseIntent("something like interstellar", { known });
    expect(a.chips).toEqual([{ id: "intent-like", label: "More like Interstellar", href: "/title/movie/157336" }]);
    const b = parseIntent("something like a movie nobody has", { known });
    expect(b.chips.some((c) => c.id === "intent-like")).toBe(false);
    expect(b.unknown).toContain("nobody");
  });

  it("'something different' uses the profile's least explored genre, on the device", () => {
    const s = emptyState("p", 0);
    for (let k = 0; k < 10; k++) { const it = item(k + 1, ["Horror", "Thriller"]); rememberFeatures(s, fromItem(it), k); applyInteraction(s, { id: it.id, kind: "complete", at: k }, k, Object.keys(s.features).sort()); }
    const i = parseIntent("something different from what I usually watch", { state: s });
    const c = i.chips[0]!;
    expect(c.label.startsWith("Something different:")).toBe(true);
    expect(qs(c.href).get("genre")).not.toBe("27");
    expect(qs(c.href).get("genre")).not.toBe("53");
    // without learning there is nothing to be different from
    expect(parseIntent("something different").chips).toEqual([]);
  });

  it("kids profiles never get non-kids moods and unknown words are reported", () => {
    expect(parseIntent("something scary", { kids: true }).chips).toEqual([]);
    expect(parseIntent("zzz qqq").chips).toEqual([]);
    expect(parseIntent("zzz qqq").unknown).toEqual(["zzz", "qqq"]);
  });
});
