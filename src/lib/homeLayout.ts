/**
 * Personalize Home (v1.1.9, roadmap "personalization settings", D-110).
 * Home is built from a few sections. The default order is the blueprint's (BLUEPRINT_SPEC 6.7), and a profile can
 * reorder or hide them. Editorial rows from the server can be hidden one by one ("rail:<id>").
 */
export type HomeSection = "continue" | "top-picks" | "top10" | "because" | "watched" | "rails";

export const HOME_SECTIONS: { id: HomeSection; title: string; sub: string }[] = [
  { id: "continue", title: "Continue Watching", sub: "Pick up where you left off" },
  { id: "top-picks", title: "Top Picks for You", sub: "Chosen from what you watch and rate" },
  { id: "top10", title: "Top 10 Today", sub: "The most watched titles in your Top 10 language" },
  { id: "because", title: "Because You Watched", sub: "More like the titles you finished" },
  { id: "watched", title: "Shows You Watched", sub: "Series you have started" },
  { id: "rails", title: "Panda's rows", sub: "Trending, new releases, genres and more" }
];

export const DEFAULT_HOME_ORDER: HomeSection[] = HOME_SECTIONS.map((s) => s.id);
const KNOWN = new Set<string>(DEFAULT_HOME_ORDER);

/** A saved order with unknown ids dropped and missing sections added in their default place. */
export function normalizeOrder(order: readonly string[] | undefined): HomeSection[] {
  const seen = new Set<string>();
  const out: HomeSection[] = [];
  for (const id of order ?? []) if (KNOWN.has(id) && !seen.has(id)) { seen.add(id); out.push(id as HomeSection); }
  DEFAULT_HOME_ORDER.forEach((id, i) => {
    if (seen.has(id)) return;
    // insert after the section that precedes it by default, so new sections land where the blueprint puts them
    const prev = DEFAULT_HOME_ORDER.slice(0, i).reverse().find((p) => out.includes(p));
    out.splice(prev ? out.indexOf(prev) + 1 : 0, 0, id);
  });
  return out;
}

/** Move one section up (-1) or down (+1); returns a new order. */
export function moveSection(order: readonly string[] | undefined, id: HomeSection, dir: -1 | 1): HomeSection[] {
  const o = normalizeOrder(order);
  const i = o.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= o.length) return o;
  const a = o[i]!, b = o[j]!;
  o[i] = b; o[j] = a;
  return o;
}

export const railKey = (id: string) => `rail:${id}`;

/** Join the section buckets in the profile's order, leaving out hidden sections and hidden editorial rows. */
export function arrangeHome<T extends { id: string }>(buckets: Partial<Record<HomeSection, T[]>>, order: readonly string[] | undefined, hidden: readonly string[] | undefined, railIds: ReadonlySet<string> = new Set()): T[] {
  const off = new Set(hidden ?? []);
  const out: T[] = [];
  for (const s of normalizeOrder(order)) {
    if (off.has(s)) continue;
    for (const row of buckets[s] ?? []) if (!(railIds.has(row.id) && off.has(railKey(row.id)))) out.push(row);
  }
  return out;
}

export const isCustomHome = (order: readonly string[] | undefined, hidden: readonly string[] | undefined) =>
  (hidden?.length ?? 0) > 0 || normalizeOrder(order).some((id, i) => id !== DEFAULT_HOME_ORDER[i]);
