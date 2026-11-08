import type { HistoryEntry } from "./store";
import type { SeasonSummary, TitleDetails } from "./types";
import { watchPath } from "./format";

export interface Cta { label: string; sub: string | null; href: string; kind: "watch" | "resume" | "next" | "first" | "latest" }

const realSeasons = (seasons: SeasonSummary[]) => seasons.filter((s) => s.number > 0 && s.episodeCount > 0).sort((a, b) => a.number - b.number);

/** The episode after (season, episode) using season episode counts, crossing season boundaries. */
export function nextEpisodeOf(seasons: SeasonSummary[], season: number, episode: number): { season: number; episode: number } | null {
  const list = realSeasons(seasons);
  const cur = list.find((s) => s.number === season);
  if (cur && episode < cur.episodeCount) return { season, episode: episode + 1 };
  const nextSeason = list.find((s) => s.number > season);
  return nextSeason ? { season: nextSeason.number, episode: 1 } : null;
}

export function prevEpisodeOf(seasons: SeasonSummary[], season: number, episode: number): { season: number; episode: number } | null {
  if (episode > 1) return { season, episode: episode - 1 };
  const list = realSeasons(seasons);
  const prev = [...list].reverse().find((s) => s.number < season);
  return prev ? { season: prev.number, episode: prev.episodeCount } : null;
}

/** Primary + optional secondary CTA for the details screens (spec 7.5, 14.4). */
export function detailsCtas(d: TitleDetails, h: HistoryEntry | null): { primary: Cta; secondary: Cta | null } {
  if (d.type === "movie") {
    if (h && !h.completed && h.position > 30) {
      return { primary: { label: "Resume", sub: null, href: `${watchPath("movie", d.tmdbId)}?t=${h.position}`, kind: "resume" }, secondary: null };
    }
    return { primary: { label: "Watch Now", sub: null, href: watchPath("movie", d.tmdbId), kind: "watch" }, secondary: null };
  }
  const seasons = realSeasons(d.seasons);
  const first = seasons[0];
  const latest = seasons[seasons.length - 1];
  let primary: Cta;
  if (h?.season && h.episode) {
    if (!h.completed && h.position > 30) {
      primary = { label: "Resume", sub: `S${h.season} E${h.episode}`, href: `${watchPath("tv", d.tmdbId, h.season, h.episode)}&t=${h.position}`, kind: "resume" };
    } else {
      const n = h.completed ? nextEpisodeOf(d.seasons, h.season, h.episode) : { season: h.season, episode: h.episode };
      primary = n
        ? { label: h.completed || h.upNext ? "Watch Next" : "Watch", sub: `S${n.season} E${n.episode}`, href: watchPath("tv", d.tmdbId, n.season, n.episode), kind: "next" }
        : { label: "Watch Again", sub: `S${first?.number ?? 1} E1`, href: watchPath("tv", d.tmdbId, first?.number ?? 1, 1), kind: "first" };
    }
  } else {
    primary = { label: "Watch First Episode", sub: `S${first?.number ?? 1} E1`, href: watchPath("tv", d.tmdbId, first?.number ?? 1, 1), kind: "first" };
  }
  const secondary = latest && first && latest.number !== first.number && !(h?.season && h.season >= latest.number)
    ? { label: "Watch Latest Season", sub: `S${latest.number} E1`, href: watchPath("tv", d.tmdbId, latest.number, 1), kind: "latest" as const }
    : null;
  return { primary, secondary };
}
