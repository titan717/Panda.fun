import { browseHref } from "../format";
import { parseMood } from "./moods";
import { affinities, type LearnerState } from "./learner";
import type { MediaType } from "../types";

/**
 * v1.5.0 conversational discovery, entirely on the device: no AI service, no API key, nothing about the profile
 * leaves the phone or TV. A typed request ("dark korean thrillers", "something like Interstellar", "underrated
 * 90s comedies", "something different from what I usually watch") is read with a fixed vocabulary into a real
 * catalogue browse (the Panda API's discover filters) and, for "like X", a title the profile has actually seen.
 * Words the parser does not know are reported, so the UI only claims what it understood; the ordinary text search
 * still runs alongside. It never invents a title.
 */
export interface IntentChip { id: string; label: string; href: string }
export interface Intent { chips: IntentChip[]; understood: string[]; unknown: string[] }

const MOVIE_G: Record<string, number> = { action: 28, adventure: 12, animated: 16, animation: 16, cartoon: 16, comedy: 35, comedies: 35, crime: 80, documentary: 99, documentaries: 99, drama: 18, dramas: 18, family: 10751, fantasy: 14, history: 36, historical: 36, horror: 27, music: 10402, musical: 10402, mystery: 9648, mysteries: 9648, romance: 10749, romantic: 10749, "sci-fi": 878, scifi: 878, "science fiction": 878, thriller: 53, thrillers: 53, war: 10752, western: 37, westerns: 37 };
/** TMDB TV has no Thriller / Horror / Romance genres: the closest TV genres, as the mood rails already use. */
const TV_G: Record<number, number[]> = { 28: [10759], 12: [10759], 16: [16], 35: [35], 80: [80], 99: [99], 18: [18], 10751: [10751], 14: [10765], 878: [10765], 9648: [9648], 10752: [10768], 36: [10768], 53: [80, 9648], 27: [9648, 10765], 10749: [18] };
const GENRE_NAME: Record<number, string> = { 28: "Action", 12: "Adventure", 16: "Animated", 35: "Comedy", 80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "Historical", 27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 53: "Thriller", 10752: "War", 37: "Western" };
const LANG: Record<string, [string, string]> = { korean: ["ko", "Korean"], kdrama: ["ko", "Korean"], "k-drama": ["ko", "Korean"], japanese: ["ja", "Japanese"], hindi: ["hi", "Hindi"], bollywood: ["hi", "Hindi"], tamil: ["ta", "Tamil"], telugu: ["te", "Telugu"], malayalam: ["ml", "Malayalam"], kannada: ["kn", "Kannada"], spanish: ["es", "Spanish"], french: ["fr", "French"], italian: ["it", "Italian"], german: ["de", "German"], chinese: ["zh", "Chinese"], english: ["en", "English"] };
const TONE: Record<string, { genres: number[]; label: string }> = {
  dark: { genres: [53, 80, 27], label: "Darker" }, darker: { genres: [53, 80, 27], label: "Darker" }, gritty: { genres: [80, 53], label: "Gritty" },
  light: { genres: [35, 10751], label: "Lighter" }, lighter: { genres: [35, 10751], label: "Lighter" }, lighthearted: { genres: [35, 10751], label: "Lighter" }
};
const FILLER = new Set("a an the some something me i we us my our to for of with in on and or that is are be what watch watching want wanna show give find good great best really very kind sort like similar about tonight now please any more less than usual usually from movies movie films film shows show series tv anything".split(" "));
const UNDERRATED = ["underrated", "hidden gem", "hidden gems", "lesser known", "lesser-known", "overlooked", "under the radar"];
const NEWEST = ["new", "newest", "latest", "recent", "just released"];
const DIFFERENT = ["something different", "different from", "out of my comfort zone", "change of pace", "something new for me", "not what i usually"];

const norm = (s: string) => ` ${s.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim()} `;
const has = (t: string, w: string) => t.includes(` ${w} `);

export interface IntentContext {
  state?: LearnerState | null;
  /** Titles this profile has seen or saved (history, My List, model features): "like X" resolves only to these. */
  known?: readonly { id: string; type: MediaType; title: string }[];
  kids?: boolean;
}

export function parseIntent(q: string, ctx: IntentContext = {}): Intent {
  let t = norm(q);
  const understood: string[] = [];
  const chips: IntentChip[] = [];
  if (t.trim().length < 3) return { chips, understood, unknown: [] };
  const take = (w: string, what: string) => { t = t.replace(` ${w} `, " "); understood.push(what); };

  // "like X" / "similar to X": only a title the profile actually has
  const like = /\s(?:like|similar to|same as|in the style of)\s+(.+?)\s*$/.exec(t);
  if (like && ctx.known?.length) {
    const want = like[1]!.trim();
    const hit = ctx.known.find((k) => norm(k.title).trim() === want) ?? (want.length >= 4 ? ctx.known.find((k) => norm(k.title).trim().startsWith(want)) : undefined);
    if (hit) {
      chips.push({ id: "intent-like", label: `More like ${hit.title}`, href: `/title/${hit.type}/${hit.id.split(":")[1]}` });
      t = t.replace(like[0], " "); understood.push(`like ${hit.title}`);
    }
  }

  let type: MediaType | null = null;
  if (/\s(shows?|series|tv|kdramas?|k-dramas?|seasons?)\s/.test(t)) type = "tv";
  else if (/\s(movies?|films?)\s/.test(t)) type = "movie";
  if (type) understood.push(type === "tv" ? "shows" : "movies");

  const genres = new Set<number>();
  const labels: string[] = [];
  for (const w of Object.keys(MOVIE_G).sort((a, b) => b.length - a.length)) if (has(t, w)) { genres.add(MOVIE_G[w]!); labels.push(GENRE_NAME[MOVIE_G[w]!]!); take(w, w); }
  for (const [w, tone] of Object.entries(TONE)) if (has(t, w)) { if (!genres.size) tone.genres.forEach((g) => genres.add(g)); labels.unshift(tone.label); take(w, w); }
  const mood = genres.size ? null : parseMood(q);
  if (mood && (!ctx.kids || mood.kids)) { mood.movie.split("|").forEach((g) => genres.add(Number(g))); labels.push(mood.label); understood.push(mood.label.toLowerCase()); for (const w of mood.words) if (has(t, w)) t = t.replace(` ${w} `, " "); }

  let lang: [string, string] | null = null;
  for (const [w, l] of Object.entries(LANG)) if (has(t, w)) { lang = l; take(w, l[1]); if (w === "kdrama" || w === "k-drama") type = type ?? "tv"; break; }

  let sort: string | undefined;
  for (const w of UNDERRATED) if (has(t, w)) { sort = lang ? undefined : "vote_average.desc"; labels.unshift("Underrated"); take(w, "underrated"); break; }
  if (!sort) for (const w of NEWEST) if (has(t, w)) { sort = "new"; labels.unshift("New"); take(w, "new"); break; }

  let different = false;
  for (const w of DIFFERENT) if (has(t, w)) { different = true; take(w, "something different"); break; }
  if (different && !genres.size && ctx.state && ctx.state.n >= 6) {
    // the profile's least-explored mainstream genre (never one they told Panda they dislike)
    const aff = new Map(affinities(ctx.state).filter((a) => a.key.startsWith("g:")).map((a) => [a.key.slice(2), a.score]));
    const pool = [28, 35, 80, 99, 18, 14, 27, 9648, 10749, 878, 53, 16].filter((g) => ctx.state!.overrides[`g:${GENRE_NAME[g] === "Sci-Fi" ? "Science Fiction" : GENRE_NAME[g] === "Animated" ? "Animation" : GENRE_NAME[g]}`] !== -1)
      .filter((g) => !ctx.kids || g === 16 || g === 35 || g === 10751);
    const g = pool.sort((a, b) => (aff.get(GENRE_NAME[a]!) ?? 0) - (aff.get(GENRE_NAME[b]!) ?? 0) || a - b)[0];
    if (g !== undefined) { genres.add(g); labels.push(`Something different: ${GENRE_NAME[g]}`); }
  }

  const unknown = t.trim().split(" ").filter((w) => w && !FILLER.has(w) && !/^\d+s?$/.test(w));
  if (genres.size || lang || sort) {
    const kind: MediaType = type ?? "movie";
    const g = [...genres].flatMap((x) => (kind === "tv" ? TV_G[x] ?? [] : [x]));
    if (kind === "tv" && genres.size && !g.length) return { chips, understood, unknown };
    const what = kind === "tv" ? "Shows" : "Movies";
    const title = [...new Set(labels.filter((l) => !l.startsWith("Something different")))].join(" ");
    const diff = labels.find((l) => l.startsWith("Something different"));
    const label = diff ? `${diff} ${what.toLowerCase()}` : `${title ? `${title} ` : ""}${lang ? `${lang[1]} ` : ""}${what}`.trim();
    chips.push({ id: "intent-browse", label, href: browseHref(kind, { genre: g.length ? [...new Set(g)].join("|") : undefined, lang: lang?.[0], sort, title: label }) });
  }
  return { chips, understood, unknown };
}
