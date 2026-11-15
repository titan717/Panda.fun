import type { MediaType } from "../types";
import { MOODS } from "../intel/moods";

/**
 * v1.5.0 Home category feed: every rail the infinite Home feed can show, as a query on the Panda API.
 *
 * Each category is one request (`/panda/discover/{type}` or `/panda/trending`), so a rail only exists when the API
 * returned enough titles for it; the feed drops a category that comes back short instead of showing an empty or
 * two-card rail. `genres` are canonical genre names (src/lib/reco/genres.ts) and `lang` an ISO 639-1 code: the ranker
 * matches them against the profile's onboarding answers and its on-device taste model.
 */
export type CategoryFamily = "trending" | "genre" | "acclaimed" | "language" | "new" | "combo" | "series" | "mood" | "gems";

export type CategorySource =
  | { kind: "discover"; type: MediaType; genre?: number | string; lang?: string; sort?: "popularity.desc" | "vote_average.desc" | "primary_release_date.desc"; page?: number; minRating?: number }
  | { kind: "trending"; type: "all" | MediaType; window: "day" | "week" };

export interface CategoryDef {
  id: string;
  title: string;
  family: CategoryFamily;
  source: CategorySource;
  /** canonical genres this rail is about (empty for language/trending rails) */
  genres: string[];
  lang?: string;
  /** shown on kids profiles (with the per-title kid-safe filter on top) */
  kids?: boolean;
  /** a prior on how broadly appealing the rail is, before any learning */
  prior: number;
  /** mood rails: the mood id (src/lib/intel/moods.ts), boosted by the session assistant */
  mood?: string;
}

const MOVIE_GENRES: [number, string, string][] = [
  [28, "Action", "Action Movies"], [12, "Adventure", "Adventure Movies"], [16, "Animation", "Animated Movies"],
  [35, "Comedy", "Comedy Movies"], [80, "Crime", "Crime Movies"], [99, "Documentary", "Documentaries"],
  [18, "Drama", "Drama Movies"], [10751, "Family", "Family Movies"], [14, "Fantasy", "Fantasy Movies"],
  [36, "History", "Historical Movies"], [27, "Horror", "Horror Movies"], [10402, "Music", "Music Movies"],
  [9648, "Mystery", "Mystery Movies"], [10749, "Romance", "Romantic Movies"], [878, "Science Fiction", "Sci-Fi Movies"],
  [53, "Thriller", "Thriller Movies"], [10752, "War", "War Movies"], [37, "Western", "Westerns"]
];
const TV_GENRES: [number, string[], string][] = [
  [10759, ["Action", "Adventure"], "Action & Adventure Series"], [16, ["Animation"], "Animated Series"],
  [35, ["Comedy"], "Comedy Series"], [80, ["Crime"], "Crime Series"], [99, ["Documentary"], "Docuseries"],
  [18, ["Drama"], "Drama Series"], [10751, ["Family"], "Family Series"], [10762, ["Family"], "Kids Shows"],
  [9648, ["Mystery"], "Mystery Series"], [10764, ["Reality"], "Reality TV"], [10765, ["Science Fiction", "Fantasy"], "Sci-Fi & Fantasy Series"],
  [10768, ["War"], "War & Politics Series"]
];
const ACCLAIMED_MOVIES: [number, string, string][] = [
  [18, "Drama", "Critically Acclaimed Dramas"], [53, "Thriller", "Acclaimed Thrillers"], [80, "Crime", "Acclaimed Crime Movies"],
  [878, "Science Fiction", "Acclaimed Sci-Fi"], [16, "Animation", "Acclaimed Animation"], [35, "Comedy", "Comedy Classics"],
  [27, "Horror", "Acclaimed Horror"], [10749, "Romance", "Timeless Romance"], [99, "Documentary", "Acclaimed Documentaries"],
  [10752, "War", "Acclaimed War Movies"]
];
const ACCLAIMED_TV: [number, string[], string][] = [
  [18, ["Drama"], "Acclaimed Drama Series"], [80, ["Crime"], "Acclaimed Crime Series"],
  [16, ["Animation"], "Acclaimed Animated Series"], [35, ["Comedy"], "Acclaimed Comedy Series"]
];
const LANG_MOVIES: [string, string][] = [
  ["hi", "Hindi Movies"], ["ml", "Malayalam Movies"], ["ta", "Tamil Movies"], ["te", "Telugu Movies"], ["kn", "Kannada Movies"],
  ["bn", "Bengali Movies"], ["mr", "Marathi Movies"], ["ko", "Korean Movies"], ["ja", "Japanese Movies"], ["es", "Spanish Movies"],
  ["fr", "French Movies"]
];
const LANG_SERIES: [string, number | undefined, string[], string][] = [
  ["ko", 18, ["Drama"], "Korean Dramas"], ["ja", 16, ["Animation"], "Anime Series"], ["hi", undefined, [], "Hindi Series"],
  ["es", undefined, [], "Spanish Series"]
];
const NEWEST: [MediaType, string | undefined, string][] = [
  ["movie", "hi", "New Hindi Releases"], ["movie", "ml", "New Malayalam Releases"], ["movie", "ta", "New Tamil Releases"],
  ["movie", "te", "New Telugu Releases"], ["movie", "en", "New English Releases"], ["tv", undefined, "New Series"]
];
const COMBOS: [string, number, string, string][] = [
  ["hi", 53, "Thriller", "Hindi Thrillers"], ["ml", 53, "Thriller", "Malayalam Thrillers"], ["ko", 53, "Thriller", "Korean Thrillers"],
  ["ja", 16, "Animation", "Japanese Animated Movies"], ["ta", 28, "Action", "Tamil Action Movies"], ["hi", 35, "Comedy", "Hindi Comedies"]
];
const GEMS: [string, MediaType, string | undefined, string, number][] = [
  ["gems-movies", "movie", undefined, "Hidden Gems", 6], ["gems-series", "tv", undefined, "Hidden Gem Series", 4],
  ["gems-ml", "movie", "ml", "Malayalam Hidden Gems", 3], ["gems-ko", "movie", "ko", "Korean Hidden Gems", 3], ["gems-hi", "movie", "hi", "Hindi Hidden Gems", 3]
];
const KIDS_GENRES = new Set(["Animation", "Family"]);

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function build(): CategoryDef[] {
  const out: CategoryDef[] = [
    { id: "trending-today", title: "Trending Today", family: "trending", source: { kind: "trending", type: "all", window: "day" }, genres: [], prior: 0.9 },
    { id: "trending-movies-week", title: "Trending Movies This Week", family: "trending", source: { kind: "trending", type: "movie", window: "week" }, genres: [], prior: 0.8 },
    { id: "trending-series-week", title: "Trending Series This Week", family: "trending", source: { kind: "trending", type: "tv", window: "week" }, genres: [], prior: 0.8 }
  ];
  for (const [genre, g, title] of MOVIE_GENRES) out.push({ id: `movie-${slug(g)}`, title, family: "genre", source: { kind: "discover", type: "movie", genre }, genres: [g], kids: KIDS_GENRES.has(g), prior: 0.5 });
  for (const [genre, gs, title] of TV_GENRES) out.push({ id: `tv-${genre}`, title, family: "series", source: { kind: "discover", type: "tv", genre }, genres: gs, kids: gs.every((g) => KIDS_GENRES.has(g)), prior: 0.45 });
  for (const [genre, g, title] of ACCLAIMED_MOVIES) out.push({ id: `acclaimed-movie-${slug(g)}`, title, family: "acclaimed", source: { kind: "discover", type: "movie", genre, sort: "vote_average.desc" }, genres: [g], kids: KIDS_GENRES.has(g), prior: 0.4 });
  for (const [genre, gs, title] of ACCLAIMED_TV) out.push({ id: `acclaimed-tv-${genre}`, title, family: "acclaimed", source: { kind: "discover", type: "tv", genre, sort: "vote_average.desc" }, genres: gs, kids: gs.every((g) => KIDS_GENRES.has(g)), prior: 0.4 });
  for (const [lang, title] of LANG_MOVIES) out.push({ id: `lang-movie-${lang}`, title, family: "language", source: { kind: "discover", type: "movie", lang }, genres: [], lang, prior: 0.45 });
  for (const [lang, genre, gs, title] of LANG_SERIES) out.push({ id: `lang-tv-${lang}${genre ? `-${genre}` : ""}`, title, family: "language", source: { kind: "discover", type: "tv", lang, genre }, genres: gs, lang, prior: 0.45 });
  for (const [type, lang, title] of NEWEST) out.push({ id: `new-${type}${lang ? `-${lang}` : ""}`, title, family: "new", source: { kind: "discover", type, lang, sort: "primary_release_date.desc" }, genres: [], lang, prior: 0.5 });
  for (const [lang, genre, g, title] of COMBOS) out.push({ id: `combo-${lang}-${slug(g)}`, title, family: "combo", source: { kind: "discover", type: "movie", lang, genre }, genres: [g], lang, prior: 0.35 });
  // moods (10): OR-joined genres, boosted by the time of day (sessionMoods)
  for (const m of MOODS) out.push({ id: `mood-${m.id}`, title: m.rail, family: "mood", source: { kind: "discover", type: "movie", genre: m.movie }, genres: m.genres, kids: m.kids, prior: 0.42, mood: m.id });
  // hidden gems (5): well-rated titles past the first pages of "top rated", so the obvious hits are not repeated;
  // the feed also drops anything an earlier rail showed and anything rated under minRating
  for (const [id, type, lang, title, page] of GEMS) out.push({ id, title, family: "gems", source: { kind: "discover", type, lang, sort: "vote_average.desc", page, minRating: 7 }, genres: [], lang, prior: 0.4 });
  return out;
}

/** All Home feed categories (89). Ids are stable: category learning and focus memory are keyed on them. */
export const CATEGORIES: readonly CategoryDef[] = build();
export const CATEGORY_BY_ID: ReadonlyMap<string, CategoryDef> = new Map(CATEGORIES.map((c) => [c.id, c]));

/** The API path of one category page (also its SWR / persisted-cache key). */
export function categoryPath(c: CategoryDef, page = 1): string {
  const s = c.source;
  if (s.kind === "trending") return `/panda/trending?type=${s.type}&window=${s.window}&page=${page}`;
  const p = new URLSearchParams();
  if (s.genre !== undefined) p.set("genre", String(s.genre));
  if (s.lang) p.set("lang", s.lang);
  if (s.sort) p.set("sort", s.sort);
  p.set("page", String((s.page ?? 1) + page - 1));
  return `/panda/discover/${s.type}?${p.toString()}`;
}

/** Which categories a page may show: Movies and TV keep to their type; kids profiles get the kid-friendly rails only. */
export function eligible(kind: "home" | "movies" | "tv", kids: boolean): CategoryDef[] {
  return CATEGORIES.filter((c) => {
    if (kids && !c.kids) return false;
    const t = c.source.type;
    if (kind === "movies") return t === "movie";
    if (kind === "tv") return t === "tv";
    return true;
  });
}
