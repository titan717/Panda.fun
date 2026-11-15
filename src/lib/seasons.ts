/**
 * Seasons & episodes presentation (v1.3.2, docs/DETAILS.md).
 *
 * The backend passes TMDB's season `name` straight through. For long-running anime TMDB names each
 * season after a story arc ("East Blue", "Wano Country Arc", "Dressrosa (2)"), and some shows name
 * them "Series 1" or "The Final Season". Panda never shows those names: a season is always
 * "Season N", and season 0 is "Specials" (only when the payload really has one with episodes).
 * Episode numbers and ids are the backend's own; nothing is renumbered, merged or invented.
 */
import type { HistoryEntry } from "./store";
import type { Episode, SeasonSummary } from "./types";
import { airsLater } from "./format";

export interface SeasonOption {
  number: number;
  label: string;
  episodeCount: number;
  airDate: string | null;
  /** Announced, but nothing has aired yet. */
  upcoming: boolean;
  specials: boolean;
}

/** "Season 3", or "Specials" for season 0. Never the backend's arc or part name. */
export function seasonLabel(n: number): string {
  return n === 0 ? "Specials" : `Season ${n}`;
}

/**
 * The seasons to offer, in order: regular seasons ascending, then Specials last. Duplicates are dropped,
 * negative or fractional numbers are ignored, and a season with no episodes is kept only when it is
 * announced for a future date (shown as upcoming). Specials need at least one episode.
 */
export function seasonOptions(seasons: SeasonSummary[] | null | undefined, now = new Date()): SeasonOption[] {
  const seen = new Set<number>();
  const out: SeasonOption[] = [];
  for (const s of seasons ?? []) {
    if (!Number.isInteger(s.number) || s.number < 0 || seen.has(s.number)) continue;
    const count = Math.max(0, s.episodeCount || 0);
    const future = airsLater(s.airDate, now);
    if (s.number === 0 ? count === 0 : count === 0 && !future) continue;
    seen.add(s.number);
    out.push({ number: s.number, label: seasonLabel(s.number), episodeCount: count, airDate: s.airDate, upcoming: future, specials: s.number === 0 });
  }
  return out.sort((a, b) => (a.specials ? 1 : 0) - (b.specials ? 1 : 0) || a.number - b.number);
}

/** The season to open: the one the profile last watched (if still offered), else the first regular season. */
export function initialSeason(options: SeasonOption[], h: HistoryEntry | null | undefined): number | null {
  if (h?.season != null && options.some((o) => o.number === h.season)) return h.season;
  return (options.find((o) => !o.specials) ?? options[0])?.number ?? null;
}

/** "N episodes" summary for a season header. */
export function episodeCountLabel(n: number) { return `${n} episode${n === 1 ? "" : "s"}`; }

/** A title the backend filled in with no information ("Episode 12") is treated as no title. */
const placeholderTitle = (title: string | null | undefined, n: number) => !title?.trim() || new RegExp(`^(episode|ep\\.?|e)\\s*0*${n}$`, "i").test(title.trim());

/** "E3 · Pilot", or "Episode 3" when there is no real title. */
export function episodeLabel(ep: Pick<Episode, "number" | "title">): string {
  return placeholderTitle(ep.title, ep.number) ? `Episode ${ep.number}` : `E${ep.number} · ${ep.title.trim()}`;
}

/**
 * The season's episodes as the backend sent them, cleaned for display only: entries from another season,
 * duplicates (same id or number) and invalid numbers are dropped, then sorted by episode number.
 * Gaps stay gaps; ids and numbers are untouched.
 */
export function seasonEpisodes(season: number, episodes: Episode[] | null | undefined): Episode[] {
  const ids = new Set<number>(), nums = new Set<number>();
  const out: Episode[] = [];
  for (const ep of episodes ?? []) {
    if (!ep || ep.season !== season || !Number.isInteger(ep.number) || ep.number < 0) continue;
    if (ids.has(ep.id) || nums.has(ep.number)) continue;
    ids.add(ep.id); nums.add(ep.number);
    out.push(ep);
  }
  return out.sort((a, b) => a.number - b.number);
}

/** Episode numbers missing between the first and last listed episode (shown as a note, never filled in). */
export function missingEpisodes(episodes: Episode[]): number[] {
  if (episodes.length < 2) return [];
  const have = new Set(episodes.map((e) => e.number));
  const first = episodes[0]!.number, last = episodes[episodes.length - 1]!.number;
  const gaps: number[] = [];
  for (let n = first + 1; n < last; n++) if (!have.has(n)) gaps.push(n);
  return gaps;
}

export interface LastWatched {
  season: number;
  episode: number;
  /** "Resume S2 E5" while unfinished, "Watch S2 E6" when the next one is queued, null when finished. */
  action: string | null;
  label: string;
}

/** The profile's place in the show, from the history entry (store.ts episodeProgress / history). */
export function lastWatched(h: HistoryEntry | null | undefined): LastWatched | null {
  if (!h?.season || !h.episode) return null;
  const tag = `S${h.season} E${h.episode}`;
  const resumable = !h.completed && !h.upNext && h.position > 30;
  return {
    season: h.season,
    episode: h.episode,
    action: resumable ? `Resume ${tag}` : h.upNext && !h.completed ? `Watch ${tag}` : null,
    label: h.upNext && !h.completed ? `Up next ${tag}` : `Last watched ${tag}`
  };
}

/** "Unaired" episodes: a future air date. Episodes with no date at all are playable (the backend lists aired ones). */
export const isUnaired = (ep: Pick<Episode, "airDate">, now = new Date()) => airsLater(ep.airDate, now);
