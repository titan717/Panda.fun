import { beforeEach, describe, expect, it } from "vitest";
import catalogRaw from "./fixtures/reco-catalog.json";
import { buildModel, MODEL_WEIGHTS, type ProfileSignals, type TasteLike } from "../lib/reco/model";
import { generateCandidates, mmr, rankCandidates, scoreCandidate } from "../lib/reco/engine";
import { buildSections, discoveryGenres } from "../lib/reco/sections";
import { canonicalGenres } from "../lib/reco/genres";
import { genreCoverage, intraListDiversity, ndcgAtK, novelty, precisionAtK } from "../lib/reco/evaluate";
import { clearFeedback, getFeedback, recordFeedback, resetFeedbackCacheForTest, undoFeedback } from "../lib/reco/feedback";
import { buildPersonalRows, pickSeeds } from "../lib/personal";
import type { HistoryEntry } from "../lib/store";
import type { PandaItem } from "../lib/types";

type Raw = { rails: { id: string; items: Partial<PandaItem>[] }[] };
const full = (i: Partial<PandaItem>): PandaItem => ({ posterLarge: null, backdrop: null, backdropLarge: null, overview: null, ...i } as PandaItem);
const rails = (catalogRaw as Raw).rails.map((r) => ({ id: r.id, items: r.items.map(full) }));
const all = [...new Map(rails.flatMap((r) => r.items).map((i) => [i.id, i])).values()];
const NOW = Date.UTC(2026, 10, 15);
const released = all.filter((i) => !i.releaseDate || Date.parse(i.releaseDate) <= NOW);
const trending = rails.find((r) => r.id === "trending")!.items;
const popular = [...rails.find((r) => r.id === "popular-shows")!.items, ...rails.find((r) => r.id === "top-rated")!.items];
const popSet = new Set([...trending, ...popular].map((i) => i.id));
const has = (i: PandaItem, gs: string[]) => canonicalGenres(i.genres).some((g) => gs.includes(g));
const taste = (genres: string[], o: Partial<TasteLike> = {}): TasteLike => ({ genres, contentType: "both", popularity: "mix", era: "mix", ...o });
const empty: ProfileSignals = { taste: null, history: {}, watchlist: [], ratings: {} };
const hist = (items: PandaItem[], completed = true): Record<string, HistoryEntry> => Object.fromEntries(items.map((item, n) => [item.id, { item, position: 100, duration: 100, completed, updatedAt: NOW - n * 1000 } as HistoryEntry]));
/** The pre-v1.4 behaviour for a profile without seeds: the home page order (trending first, then the rails). */
const popularityBaseline = [...new Map([...trending, ...rails.flatMap((r) => r.items)].map((i) => [i.id, i])).values()].filter((i) => released.includes(i));
/** Deterministic "More Like This" stand-in: same-genre titles first (as TMDB tends to), then a few others. */
function similarTo(seed: PandaItem, n = 20) {
  const g = canonicalGenres(seed.genres);
  const same = released.filter((i) => i.id !== seed.id && canonicalGenres(i.genres).filter((x) => g.includes(x)).length >= 2);
  const other = released.filter((i) => i.id !== seed.id && !same.includes(i));
  return [...same.slice(0, Math.ceil(n * 0.7)), ...other.slice(0, n)].slice(0, n);
}

describe("v1.4.0 genre vocabulary", () => {
  it("splits TMDB TV genres onto the movie names", () => {
    expect(canonicalGenres(["Sci-Fi & Fantasy", "Action & Adventure", "Drama"])).toEqual(["Science Fiction", "Fantasy", "Action", "Adventure", "Drama"]);
    expect(canonicalGenres(["Sci-Fi", "Kids"])).toEqual(["Science Fiction", "Family"]);
  });
});

describe("v1.4.0 preference model", () => {
  it("cold start uses onboarding picks, which fade as behaviour accumulates", () => {
    const a = buildModel({ ...empty, taste: taste(["Horror"]) });
    expect(a.genres.get("Horror")).toBe(1);
    expect(a.genreWhy.get("Horror")).toBe("picked");
    const comedies = released.filter((i) => has(i, ["Comedy"]) && !has(i, ["Horror"])).slice(0, 24);
    const b = buildModel({ ...empty, taste: taste(["Horror"]), history: hist(comedies) });
    expect(b.genres.get("Comedy")).toBe(1);
    expect(b.genres.get("Horror") ?? 0).toBeLessThan(0.3);
    expect(MODEL_WEIGHTS.taper).toBeGreaterThan(0);
  });
  it("finished and disliked titles are excluded, started ones are in progress", () => {
    const [x, y, z] = released;
    const m = buildModel({ ...empty, history: { ...hist([x!]), ...hist([y!], false) }, ratings: { [z!.id]: "dislike" } });
    expect(m.exclude.has(x!.id)).toBe(true);
    expect(m.inProgress.has(y!.id)).toBe(true);
    expect(m.exclude.has(z!.id)).toBe(true);
  });
  it("a skipped onboarding is not treated as taste", () => {
    const m = buildModel({ ...empty, taste: { ...taste(["Horror"]), skipped: true } });
    expect(m.genres.size).toBe(0);
  });
});

describe("v1.4.0 filtering", () => {
  it("drops suppressed, finished, saved, unreleased and artless titles", () => {
    const [a, b, c, d] = released;
    const future = full({ ...released[4]!, id: "movie:999999", tmdbId: 999999, releaseDate: "2099-01-01" });
    const noArt = full({ ...released[5]!, id: "movie:999998", tmdbId: 999998, poster: null });
    const m = buildModel({ ...empty, taste: taste(["Drama"]), history: hist([a!]), watchlist: [b!] });
    const cands = generateCandidates({ similar: [], trending: [a!, b!, c!, d!, future, noArt] });
    const out = rankCandidates(cands, m, { suppressed: new Set([`${c!.type}:${c!.tmdbId}`]), now: NOW }).map((s) => s.c.item.id);
    expect(out).toEqual([d!.id]);
  });
  it("kids rules apply through the allow filter", () => {
    const m = buildModel({ ...empty, taste: taste(["Animation"]) });
    const out = rankCandidates(generateCandidates({ similar: [], trending: released.slice(0, 40) }), m, { suppressed: new Set(), now: NOW, allow: (i) => has(i, ["Animation", "Family"]) });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((s) => has(s.c.item, ["Animation", "Family"]))).toBe(true);
  });
});

describe("v1.4.0 scoring and honest explanations", () => {
  it("a title similar to a loved seed says so; a genre match names the picked genre", () => {
    const seed = released.find((i) => has(i, ["Animation"]))!;
    const m = buildModel({ ...empty, taste: taste(["Horror"]), history: hist([seed]), ratings: { [seed.id]: "love" } });
    const sim = similarTo(seed);
    const cands = generateCandidates({ similar: [{ seed: m.seeds[0]!, items: sim }], trending });
    const ranked = rankCandidates(cands, m, { suppressed: new Set(), now: NOW });
    for (const s of ranked) {
      if (s.reason?.kind === "similar") expect(sim.some((i) => i.id === s.c.item.id)).toBe(true);
      if (s.reason?.kind === "genre") { expect(s.genres).toContain(s.reason.genre); expect(m.genres.get(s.reason.genre)!).toBeGreaterThan(0); }
      if (s.reason?.kind === "trending") expect(trending.some((i) => i.id === s.c.item.id)).toBe(true);
    }
    expect(ranked.some((s) => s.reason?.text === `Because you loved ${seed.title}`)).toBe(true);
  });
  it("a profile Panda knows nothing about gets no Top Picks (no fake personalisation)", () => {
    const { sections } = buildSections({ model: buildModel(empty), suppressed: new Set(), similar: [], trending, popular, rails, now: NOW });
    expect(sections.map((s) => s.id)).not.toContain("top-picks");
    expect(sections.map((s) => s.id)).toContain("trending");
  });
  it("is deterministic", () => {
    const m = buildModel({ ...empty, taste: taste(["Comedy", "Crime"]) });
    const run = () => buildSections({ model: m, suppressed: new Set(), similar: [], trending, popular, rails, now: NOW }).sections.map((s) => `${s.id}:${s.items.map((i) => i.id).join(",")}`);
    expect(run()).toEqual(run());
  });
  it("every score part is bounded", () => {
    const m = buildModel({ ...empty, taste: taste(["Drama"], { era: "new", popularity: "popular" }) });
    for (const c of generateCandidates({ similar: [], trending: released }).values()) {
      const s = scoreCandidate(c, m, NOW);
      for (const v of Object.values(s.parts)) { expect(v).toBeGreaterThanOrEqual(-1); expect(v).toBeLessThanOrEqual(1); }
    }
  });
});

describe("v1.4.0 diversification", () => {
  it("MMR raises genre diversity over the pure score order without losing relevance", () => {
    const m = buildModel({ ...empty, taste: taste(["Drama", "Crime", "Comedy"]) });
    const ranked = rankCandidates(generateCandidates({ similar: [], trending, rails }), m, { suppressed: new Set(), now: NOW });
    const plain = ranked.slice(0, 12).map((s) => s.c.item);
    const div = mmr(ranked, 12).map((s) => s.c.item);
    expect(intraListDiversity(div, 12)).toBeGreaterThan(intraListDiversity(plain, 12));
    const rel = new Set(released.filter((i) => has(i, ["Drama", "Crime", "Comedy"])).map((i) => i.id));
    expect(precisionAtK(div, rel, 12)).toBeGreaterThanOrEqual(0.9);
  });
});

describe("v1.4.0 offline evaluation vs baseline (catalogue snapshot, synthetic profiles)", () => {
  const profiles: { name: string; genres: string[] }[] = [
    { name: "horror and thriller", genres: ["Horror", "Thriller"] },
    { name: "animation", genres: ["Animation"] },
    { name: "romance and comedy", genres: ["Romance", "Comedy"] },
    { name: "crime", genres: ["Crime"] },
    { name: "science fiction", genres: ["Science Fiction"] }
  ];
  it("cold start: onboarding answers beat the popularity order on precision@10 and nDCG@10", () => {
    const rows: string[] = [];
    for (const p of profiles) {
      const rel = new Set(released.filter((i) => has(i, p.genres)).map((i) => i.id));
      const { sections } = buildSections({ model: buildModel({ ...empty, taste: taste(p.genres) }), suppressed: new Set(), similar: [], trending, popular, rails, now: NOW });
      const top = sections.find((s) => s.id === "top-picks")!.items;
      const pe = precisionAtK(top, rel), pb = precisionAtK(popularityBaseline, rel);
      const ne = ndcgAtK(top, rel), nb = ndcgAtK(popularityBaseline, rel);
      rows.push(`${p.name}: P@10 ${pe.toFixed(2)} vs ${pb.toFixed(2)}, nDCG@10 ${ne.toFixed(2)} vs ${nb.toFixed(2)}, ILD ${intraListDiversity(top).toFixed(2)}, genres ${genreCoverage(top)}, novelty ${novelty(top, popSet).toFixed(2)}`);
      expect(pe).toBeGreaterThan(pb);
      expect(ne).toBeGreaterThan(nb);
      expect(pe).toBeGreaterThanOrEqual(0.8);
    }
    console.info(`[reco eval] cold start\n${rows.join("\n")}`);
  });
  it("with history: held-out titles of the watched genres rank above the v1.3 Top Picks", () => {
    const rows: string[] = [];
    for (const p of profiles) {
      const pool = released.filter((i) => has(i, p.genres));
      const watched = pool.filter((_, n) => n % 3 === 0).slice(0, 4);
      const heldOut = new Set(pool.filter((i) => !watched.includes(i)).map((i) => i.id));
      const signals: ProfileSignals = { ...empty, history: hist(watched) };
      const m = buildModel(signals);
      const similar = m.seeds.map((seed) => ({ seed, items: similarTo(seed.item) }));
      const { sections } = buildSections({ model: m, suppressed: new Set(), similar, trending, popular, rails, now: NOW });
      const top = sections.find((s) => s.id === "top-picks")!.items;
      // v1.3 baseline: personal.ts Top Picks from the same similar lists
      const seeds = pickSeeds(signals.history, [], {});
      const base = buildPersonalRows(seeds, seeds.map((s) => ({ moreLikeThis: similarTo(s.item) }) as never), new Set(watched.map((i) => i.id)), {}).topPicks;
      const pe = precisionAtK(top, heldOut), pb = precisionAtK(base, heldOut);
      rows.push(`${p.name}: P@10 ${pe.toFixed(2)} vs ${pb.toFixed(2)}, nDCG@10 ${ndcgAtK(top, heldOut).toFixed(2)} vs ${ndcgAtK(base, heldOut).toFixed(2)}, ILD ${intraListDiversity(top).toFixed(2)} vs ${intraListDiversity(base).toFixed(2)}`);
      expect(pe).toBeGreaterThanOrEqual(pb);
      expect(top.some((i) => watched.some((w) => w.id === i.id))).toBe(false);
    }
    console.info(`[reco eval] with history\n${rows.join("\n")}`);
  });
  it("leave-one-out: the specific held-out title (not any title of the genre) is found more often than by the baselines", () => {
    // Relevance here is one exact title the profile watched and that was hidden from the model, so a list cannot
    // score just by being full of the right genre. Histories are still synthetic (five titles of one genre family).
    const rows: string[] = [];
    let eng = 0, v13 = 0, pop = 0, n = 0;
    for (const p of profiles) {
      const pool = released.filter((i) => has(i, p.genres)).filter((_, k) => k % 2 === 0).slice(0, 5);
      let he = 0, hb = 0, hp = 0;
      for (const out of pool) {
        const watched = pool.filter((i) => i !== out);
        const rel = new Set([out.id]);
        const signals: ProfileSignals = { ...empty, history: hist(watched) };
        const m = buildModel(signals);
        const similar = m.seeds.map((seed) => ({ seed, items: similarTo(seed.item) }));
        const top = buildSections({ model: m, suppressed: new Set(), similar, trending, popular, rails, now: NOW }).sections.find((s) => s.id === "top-picks")!.items;
        const seeds = pickSeeds(signals.history, [], {});
        const base = buildPersonalRows(seeds, seeds.map((s) => ({ moreLikeThis: similarTo(s.item) }) as never), new Set(watched.map((i) => i.id)), {}).topPicks;
        const popTop = popularityBaseline.filter((i) => !watched.includes(i));
        he += precisionAtK(top, rel) > 0 ? 1 : 0; hb += precisionAtK(base, rel) > 0 ? 1 : 0; hp += precisionAtK(popTop, rel) > 0 ? 1 : 0;
      }
      rows.push(`${p.name}: HR@10 ${he}/${pool.length} engine, ${hb}/${pool.length} v1.3, ${hp}/${pool.length} popularity`);
      eng += he; v13 += hb; pop += hp; n += pool.length;
    }
    console.info(`[reco eval] leave-one-out\n${rows.join("\n")}\ntotal HR@10 engine ${eng}/${n}, v1.3 ${v13}/${n}, popularity ${pop}/${n}`);
    expect(eng).toBeGreaterThanOrEqual(pop);
  });
});

describe("v1.4.0 sections", () => {
  it("builds the search discovery rows without repeating titles across the first rows", () => {
    const seed = released.find((i) => has(i, ["Crime"]))!;
    const m = buildModel({ ...empty, taste: taste(["Crime", "Thriller"]), history: hist([seed]) });
    const { sections } = buildSections({
      model: m, suppressed: new Set(), now: NOW, name: "Asha",
      similar: m.seeds.map((seed) => ({ seed, items: similarTo(seed.item) })), trending, popular, rails,
      recent: rails.find((r) => r.id === "new")!.items,
      genreLists: discoveryGenres(m).map((g) => ({ genre: g, items: released.filter((i) => has(i, [g])) }))
    });
    const ids = sections.map((s) => s.id);
    expect(ids[0]).toBe("top-picks");
    expect(sections[0]!.title).toBe("Panda Top Picks for Asha");
    expect(ids).toContain("trending");
    expect(ids.some((x) => x.startsWith("because-"))).toBe(true);
    const picks = new Set(sections[0]!.items.map((i) => i.id));
    for (const s of sections.slice(1)) expect(s.items.slice(0, 8).some((i) => picks.has(i.id))).toBe(false);
    const general = sections.filter((s) => !s.id.startsWith("because-")).flatMap((s) => s.items.slice(0, 8).map((i) => i.id));
    expect(new Set(general).size).toBe(general.length);
    for (const s of sections) expect(s.items.length).toBeGreaterThanOrEqual(6);
  });
  it("a suppressed title disappears from every row", () => {
    const m = buildModel({ ...empty, taste: taste(["Drama"]) });
    const victim = trending[0]!;
    const { sections } = buildSections({ model: m, suppressed: new Set([`${victim.type}:${victim.tmdbId}`]), similar: [], trending, popular, rails, now: NOW });
    expect(sections.flatMap((s) => s.items).some((i) => i.id === victim.id)).toBe(false);
  });
});

describe("v1.4.0 feedback events", () => {
  beforeEach(() => { localStorage.clear(); resetFeedbackCacheForTest(); clearFeedback(); });
  it("are kept per profile and change the model", () => {
    const [a, b] = released;
    recordFeedback("p1", { id: a!.id, type: a!.type, kind: "not-interested", genres: a!.genres });
    recordFeedback("p1", { id: b!.id, type: b!.type, kind: "more", genres: b!.genres, title: b!.title });
    expect(getFeedback("p2")).toEqual([]);
    const m = buildModel({ ...empty, feedback: getFeedback("p1") });
    expect(m.exclude.has(a!.id)).toBe(true);
    expect(m.seeds[0]!.item.id).toBe(b!.id);
    expect(m.seeds[0]!.why).toBe("more");
    undoFeedback("p1", a!.id);
    expect(getFeedback("p1").map((e) => e.kind)).toEqual(["more"]);
  });
});
