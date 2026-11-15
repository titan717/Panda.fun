import type { MediaType } from "../types";

/**
 * v1.5.0 mood discovery and the Smart Watch Session Assistant.
 *
 * A mood is a set of TMDB genres (joined with "|", which the Panda API treats as OR) plus the words people use for
 * it. `parseMood` only recognises a mood in a search; the titles always come from the API, never from this file.
 * `sessionMoods` reads the device's local clock (no location, no permissions, nothing sent) and suggests the moods
 * that fit the moment, which the Home feed uses as a small boost.
 */
export interface Mood {
  id: string;
  label: string;
  /** rail title on Home */
  rail: string;
  movie: string;
  tv: string;
  genres: string[];
  words: string[];
  kids?: boolean;
}

export const MOODS: readonly Mood[] = [
  { id: "feel-good", label: "Feel-good", rail: "Feel-Good Picks", movie: "35|10751|10402", tv: "35|10751", genres: ["Comedy", "Family", "Music"], words: ["feel good", "feel-good", "happy", "uplifting", "cheerful", "wholesome", "light", "cozy", "cosy", "comfort"] },
  { id: "funny", label: "Laugh out loud", rail: "Laugh Out Loud", movie: "35", tv: "35", genres: ["Comedy"], words: ["funny", "hilarious", "laugh", "comedy", "comedies"] },
  { id: "scary", label: "Scary", rail: "Something Scary", movie: "27|53", tv: "9648|10765", genres: ["Horror", "Thriller"], words: ["scary", "spooky", "creepy", "frightening", "horror", "terrifying", "haunted"] },
  { id: "edge", label: "Edge of your seat", rail: "Edge-of-Your-Seat", movie: "53|80|28", tv: "80|10759", genres: ["Thriller", "Crime", "Action"], words: ["thrilling", "intense", "suspense", "suspenseful", "gripping", "edge of my seat", "adrenaline"] },
  { id: "mind-bending", label: "Mind-bending", rail: "Mind-Bending", movie: "878|9648", tv: "10765|9648", genres: ["Science Fiction", "Mystery"], words: ["mind bending", "mind-bending", "twist", "twisty", "puzzle", "trippy", "cerebral", "make me think"] },
  { id: "romantic", label: "Romantic", rail: "Date Night", movie: "10749", tv: "10749|18", genres: ["Romance"], words: ["romantic", "romance", "love story", "date night", "date-night"] },
  { id: "tearjerker", label: "A good cry", rail: "A Good Cry", movie: "18|10749", tv: "18", genres: ["Drama", "Romance"], words: ["sad", "emotional", "cry", "tearjerker", "tear-jerker", "heartbreaking", "moving"] },
  { id: "epic", label: "Epic adventure", rail: "Epic Adventures", movie: "12|14", tv: "10759|10765", genres: ["Adventure", "Fantasy"], words: ["epic", "adventure", "quest", "fantasy world", "grand"] },
  { id: "real", label: "True stories", rail: "True Stories", movie: "99|36", tv: "99", genres: ["Documentary", "History"], words: ["true story", "true stories", "real life", "based on", "documentary", "history"] },
  { id: "family", label: "Family night", rail: "Family Night", movie: "10751|16", tv: "10751|16", genres: ["Family", "Animation"], words: ["family", "kids", "with my kids", "for children", "all ages"], kids: true }
];
export const MOOD_BY_ID: ReadonlyMap<string, Mood> = new Map(MOODS.map((m) => [m.id, m]));

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim()} `;

/** The mood a free-text search asks for ("something scary for tonight", "feel good movie"), or null. */
export function parseMood(q: string): Mood | null {
  const t = norm(q);
  if (t.trim().length < 3) return null;
  let best: Mood | null = null, bestLen = 0;
  for (const m of MOODS) for (const w of m.words) {
    if (t.includes(` ${w} `) && w.length > bestLen) { best = m; bestLen = w.length; }
  }
  return best;
}

export function moodHref(m: Mood, type: MediaType = "movie"): string {
  const p = new URLSearchParams({ genre: type === "tv" ? m.tv : m.movie, title: type === "tv" ? `${m.label} Shows` : `${m.label} Movies` });
  return `/browse/${type}?${p.toString()}`;
}

export type Daypart = "morning" | "afternoon" | "evening" | "late";

export function daypart(d = new Date()): Daypart {
  const h = d.getHours();
  return h >= 5 && h < 12 ? "morning" : h < 17 && h >= 12 ? "afternoon" : h >= 17 && h < 22 ? "evening" : "late";
}

/**
 * Moods that suit the local time: mornings lean feel-good, weekend evenings lean family and date night, late nights
 * lean scary and mind-bending. Returns mood ids, strongest first; used as a small Home boost, never a filter.
 */
export function sessionMoods(d = new Date(), kids = false): string[] {
  const part = daypart(d);
  const weekend = d.getDay() === 0 || d.getDay() === 6 || (d.getDay() === 5 && part !== "morning");
  let ids: string[];
  if (part === "morning") ids = ["feel-good", "real", "funny"];
  else if (part === "afternoon") ids = weekend ? ["epic", "family", "funny"] : ["funny", "feel-good", "real"];
  else if (part === "evening") ids = weekend ? ["family", "romantic", "edge"] : ["edge", "romantic", "funny"];
  else ids = ["scary", "mind-bending", "edge"];
  return kids ? ids.filter((id) => MOOD_BY_ID.get(id)?.kids) : ids;
}

export function sessionLabel(d = new Date()): string {
  const part = daypart(d);
  return part === "morning" ? "for this morning" : part === "afternoon" ? "for this afternoon" : part === "evening" ? "for tonight" : "for late night";
}
