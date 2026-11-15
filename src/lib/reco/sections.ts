import type { PandaItem } from "../types";
import { generateCandidates, mmr, rankCandidates, type CandidateInput, type Reason, type Scored } from "./engine";
import { canonicalGenres } from "./genres";
import type { PreferenceModel } from "./model";

/** One recommendation row. `reasons` holds the honest per-title reason where the row shows one. */
export interface RecoSection {
  id: "top-picks" | "recommended" | "trending" | "popular" | "gems" | `because-${string}` | `genre-${string}` | "recent";
  title: string;
  items: PandaItem[];
  reasons?: Record<string, string>;
  /** Why the row exists (shown under the row title). */
  note?: string;
}

export interface SectionInput extends CandidateInput {
  model: PreferenceModel;
  suppressed: Set<string>;
  allow?: (i: PandaItem) => boolean;
  now?: number;
  /** Lists for the top genres, by genre name (from /panda/discover). */
  genreLists?: { genre: string; items: readonly PandaItem[] }[];
  name?: string;
}

export const MIN_ROW = 6;
export const TOP_PICKS = 12;

const reasonMap = (list: Scored[]) => Object.fromEntries(list.filter((s) => s.reason).map((s) => [s.c.item.id, (s.reason as Reason).text]));

/** True when the model knows anything about this profile (onboarding answers or behaviour). */
export const personalised = (m: PreferenceModel) => m.signals > 0 || [...m.genres.values()].some((v) => v !== 0);

export function buildSections(inp: SectionInput): { sections: RecoSection[]; ranked: Scored[] } {
  const { model: m } = inp;
  const genreAll = (inp.genreLists ?? []).flatMap((g) => g.items);
  const cands = generateCandidates({ ...inp, genre: [...(inp.genre ?? []), ...genreAll] });
  const ranked = rankCandidates(cands, m, { suppressed: inp.suppressed, allow: inp.allow, now: inp.now });
  const okIds = new Set(ranked.map((s) => s.c.item.id));
  const keep = (list: readonly PandaItem[] | undefined) => (list ?? []).filter((i) => okIds.has(i.id));
  const used = new Set<string>();
  const sections: RecoSection[] = [];
  const push = (s: RecoSection, min = MIN_ROW) => { if (s.items.length >= min) { sections.push(s); s.items.slice(0, 8).forEach((i) => used.add(i.id)); } };
  const fresh = (list: readonly PandaItem[]) => list.filter((i) => !used.has(i.id));
  const picked = new Set<string>();
  // "Because you watched" rows only avoid the Top Picks: their point is the link to one title
  const notPicked = (list: readonly PandaItem[]) => list.filter((i) => !picked.has(i.id));
  const me = personalised(m);

  // Panda Top Picks: only when the profile told Panda something; otherwise it would just be "popular" in disguise
  if (me) {
    const top = mmr(ranked, TOP_PICKS);
    push({ id: "top-picks", title: inp.name ? `Panda Top Picks for ${inp.name}` : "Panda Top Picks", items: top.map((s) => s.c.item), reasons: reasonMap(top), note: "Picked for this profile from what it likes and watches" });
    if (sections.length) top.forEach((s) => { picked.add(s.c.item.id); used.add(s.c.item.id); });
    const rest = mmr(ranked.filter((s) => !used.has(s.c.item.id)), 20, 0.6);
    push({ id: "recommended", title: "Recommended for you", items: rest.map((s) => s.c.item), reasons: reasonMap(rest) });
  }
  push({ id: "trending", title: "Trending now", items: fresh(keep(inp.trending)).slice(0, 20) });
  push({ id: "popular", title: "Popular now", items: fresh(keep(inp.popular)).slice(0, 20) });
  // Because you watched: the two strongest watched / loved seeds with enough fresh similar titles
  let because = 0;
  for (const s of inp.similar) {
    if (because >= 2 || s.seed.why === "saved") continue;
    const items = notPicked(keep(s.items)).slice(0, 20);
    const verb = s.seed.why === "loved" ? "Because you loved" : s.seed.why === "more" ? "More like" : "Because you watched";
    const before = sections.length;
    push({ id: `because-${s.seed.item.id}`, title: `${verb} ${s.seed.item.title}`, items });
    if (sections.length > before) because++;
  }
  // Hidden gems: well rated, not on the trending / popular lists, and not against the profile's taste
  const trend = new Set([...(inp.trending ?? []), ...(inp.popular ?? [])].map((i) => i.id));
  const gems = ranked.filter((s) => !trend.has(s.c.item.id) && !used.has(s.c.item.id) && (s.c.item.rating ?? 0) >= 7.2 && s.parts.genre >= 0);
  push({ id: "gems", title: "Hidden gems", items: mmr(gems, 16, 0.65).map((s) => s.c.item), note: "Well rated, less talked about" });
  // Genre discovery: the profile's top genres (or a starter set when it is new)
  for (const g of inp.genreLists ?? []) push({ id: `genre-${g.genre.toLowerCase().replace(/[^a-z]+/g, "-")}`, title: `${g.genre} to discover`, items: fresh(keep(g.items)).slice(0, 20) });
  push({ id: "recent", title: "Recently added", items: fresh(keep(inp.recent)).slice(0, 20) });
  return { sections, ranked };
}

/** The genres the engine should fetch lists for: the profile's strongest, or a varied starter set. */
export function discoveryGenres(m: PreferenceModel, n = 2): string[] {
  const top = [...m.genres].filter(([, v]) => v > 0.2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([g]) => g);
  return (top.length ? top : ["Comedy", "Thriller"]).slice(0, n);
}

export { canonicalGenres };
