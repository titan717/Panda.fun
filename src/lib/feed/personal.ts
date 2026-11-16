import { label } from "../intel/events";
import { affinities, DRIFT_DELTA, DRIFT_MIN, tasteDrift, type LearnerState } from "../intel/learner";
import { MOVIE_GENRES, type CategoryDef } from "./catalog";

/**
 * v1.5.0 personal Home rails, built from the profile's own on-device model. Every rail comes from catalogue
 * metadata the model has actually seen, with the evidence as its note:
 *
 *   Directed by <name>      a director of titles the profile finished or liked (the person's "Director" credits)
 *   Starring <name>         an actor in at least two such titles (the person's acting credits)
 *   <franchise>             a collection the profile has watched part of, in release order (never "chronological":
 *                           the catalogue has no in-story chronology, so the rail says "In release order")
 *   New interest: <genre>   a genre whose short-term weight has grown well past its long-term weight
 *   Something different     acclaimed titles in a genre the profile rarely watches and never asked for less of
 *   Trending, for you       this week's trending titles, ranked by the profile's model
 *
 * Nothing is invented: no rail without evidence, no names the details did not give. Kids profiles get none of these
 * (people's full credits are not filtered for children at the source).
 */
export const PERSONAL_MIN_EVENTS = 5;

const GENRE_ID = new Map(MOVIE_GENRES.map(([id, g, title]) => [g, { id, title }]));
const because = (titles: string[]) => (titles.length > 1 ? `Because you watched ${titles[0]} and ${titles[1]}` : titles.length ? `Because you watched ${titles[0]}` : undefined);

export function personalCategories(s: LearnerState | null, opts: { kids: boolean; kind: "home" | "movies" | "tv" }): CategoryDef[] {
  if (!s || opts.kids || opts.kind !== "home") return [];
  const positives = s.log.filter((e) => label(e.kind)?.y === 1).length;
  if (positives < PERSONAL_MIN_EVENTS) return [];
  const aff = affinities(s).filter((a) => a.score > 0.02 && s.overrides[a.key] !== -1);
  const out: CategoryDef[] = [];
  const base = { family: "personal" as const, genres: [] as string[], prior: 1 };

  for (const a of aff.filter((x) => x.key.startsWith("d:") && x.name && !/^\d+$/.test(x.name)).slice(0, 2)) {
    const id = Number(a.key.slice(2));
    out.push({ ...base, id: `p-dir-${id}`, title: `Directed by ${a.name}`, note: because(a.titles), variant: "landscape", source: { kind: "person", type: "all", person: id, role: "director" }, minItems: 4 });
  }
  for (const a of aff.filter((x) => x.key.startsWith("c:") && x.titles.length >= 2 && x.name && !/^\d+$/.test(x.name)).slice(0, 2)) {
    const id = Number(a.key.slice(2));
    out.push({ ...base, id: `p-cast-${id}`, title: `Starring ${a.name}`, note: because(a.titles), source: { kind: "person", type: "all", person: id, role: "actor" }, minItems: 5 });
  }
  for (const a of aff.filter((x) => x.key.startsWith("col:") && x.name && !/^\d+$/.test(x.name)).slice(0, 2)) {
    const id = Number(a.key.slice(4));
    out.push({ ...base, id: `p-col-${id}`, title: a.name, note: "In release order", variant: "franchise", keepOrder: true, source: { kind: "collection", type: "all", collection: id }, minItems: 2 });
  }

  const drift = tasteDrift(s);
  const emerging = drift.find((d) => d.key.startsWith("g:") && d.delta > DRIFT_DELTA && d.short > DRIFT_MIN && GENRE_ID.has(d.key.slice(2)));
  if (emerging) {
    const g = emerging.key.slice(2), def = GENRE_ID.get(g)!;
    out.push({ ...base, id: `p-new-${def.id}`, title: `New Interest: ${def.title}`, note: "You've been watching more of these lately", genres: [g], source: { kind: "discover", type: "movie", genre: def.id, page: 2 } });
  }

  if (s.n >= 10) {
    const liked = new Set(aff.filter((a) => a.key.startsWith("g:")).map((a) => a.key.slice(2)));
    const candidates = MOVIE_GENRES.filter(([, g]) => !liked.has(g) && s.overrides[`g:${g}`] !== -1 && g !== "Horror" && g !== "Documentary" && g !== "Music");
    if (candidates.length) {
      // a different genre each day, so "something different" does not become the same rail every visit
      const day = Math.floor(s.updatedAt / 86_400_000);
      const [id, g, title] = candidates[day % candidates.length]!;
      out.push({ ...base, id: `p-diff-${id}`, title: `Something Different: ${title}`, note: "Well reviewed, and not what you usually watch", genres: [g], variant: "spotlight", source: { kind: "discover", type: "movie", genre: id, sort: "vote_average.desc", minRating: 7 } });
    }
  }

  out.push({ ...base, id: "p-trending", title: "Trending, Picked for You", note: "This week's trending titles, in the order your taste suggests", variant: "spotlight", source: { kind: "trending", type: "all", window: "week" } });
  return out;
}

/**
 * Interleave personal rails into the ranked category order: one every `every` rails from the top, so the feed mixes
 * "about you" rails with discovery instead of stacking them.
 */
export function interleave(ranked: readonly string[], personal: readonly string[], every = 3): string[] {
  const out: string[] = [];
  let p = 0;
  for (let i = 0; i < ranked.length; i++) {
    if (i % every === 1 && p < personal.length) out.push(personal[p++]!);
    out.push(ranked[i]!);
  }
  while (p < personal.length) out.push(personal[p++]!);
  return out;
}
