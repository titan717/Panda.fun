/**
 * Personalised Home rows (v1.1.0, D-57). Everything is computed on the device from the active profile's
 * history, Watchlist and ratings, using the "More Like This" lists of up to five seed titles.
 * Nothing about the viewer leaves the device.
 */
import type { HistoryEntry, Rating } from "./store";
import type { PandaItem, TitleDetails } from "./types";

export const MAX_SEEDS = 5;

export interface Seed { item: PandaItem; reason: "watched" | "loved" | "saved" }

/** Seed titles: most recent history first, then loved/liked titles, then the newest Watchlist entries. Disliked titles never seed. */
export function pickSeeds(history: Record<string, HistoryEntry>, watchlist: PandaItem[], ratings: Record<string, Rating>): Seed[] {
  const out: Seed[] = [];
  const seen = new Set<string>();
  const add = (item: PandaItem, reason: Seed["reason"]) => {
    if (seen.has(item.id) || ratings[item.id] === "dislike" || out.length >= MAX_SEEDS) return;
    seen.add(item.id);
    out.push({ item, reason });
  };
  const recent = Object.values(history).sort((a, b) => b.updatedAt - a.updatedAt);
  for (const h of recent.slice(0, 3)) add(h.item, "watched");
  const byId = new Map<string, PandaItem>([...watchlist, ...recent.map((h) => h.item)].map((i) => [i.id, i]));
  for (const [id, r] of Object.entries(ratings)) if (r !== "dislike" && byId.has(id)) add(byId.get(id)!, "loved");
  for (const i of watchlist) add(i, "saved");
  for (const h of recent.slice(3)) add(h.item, "watched");
  return out;
}

export interface PersonalRows {
  topPicks: PandaItem[];
  because: { seed: PandaItem; items: PandaItem[] }[];
}

/**
 * Build "Top Picks" (titles recommended by several seeds rank first, then by rating) and up to two
 * "Because You Watched" rows. Titles already started, finished, saved or disliked are left out.
 */
export function buildPersonalRows(
  seeds: Seed[],
  details: (TitleDetails | undefined)[],
  exclude: Set<string>,
  ratings: Record<string, Rating>,
  allow: (i: PandaItem) => boolean = () => true
): PersonalRows {
  const ok = (i: PandaItem) => !exclude.has(i.id) && ratings[i.id] !== "dislike" && allow(i) && Boolean(i.poster);
  const because: PersonalRows["because"] = [];
  const used = new Set<string>();
  seeds.forEach((s, n) => {
    if (because.length >= 2 || s.reason !== "watched") return;
    const items = (details[n]?.moreLikeThis ?? []).filter(ok).slice(0, 20);
    if (items.length >= 6) { because.push({ seed: s.item, items }); items.slice(0, 8).forEach((i) => used.add(i.id)); }
  });
  const score = new Map<string, { item: PandaItem; s: number }>();
  seeds.forEach((seed, n) => {
    const weight = seed.reason === "loved" ? 1.5 : seed.reason === "watched" ? 1.2 : 1;
    (details[n]?.moreLikeThis ?? []).forEach((i, rank) => {
      if (!ok(i)) return;
      const cur = score.get(i.id) ?? { item: i, s: 0 };
      cur.s += weight * (1 - rank / 40);
      score.set(i.id, cur);
    });
  });
  const topPicks = [...score.values()]
    .map((x) => ({ ...x, s: x.s + (x.item.rating ?? 0) / 20 - (used.has(x.item.id) ? 0.6 : 0) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.item)
    .slice(0, 20);
  return { topPicks: topPicks.length >= 6 ? topPicks : [], because };
}
