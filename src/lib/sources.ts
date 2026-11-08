import { ADAPTERS, SOURCE_ORDER } from "./player";
import type { PreferredSource, SourceId, SourceRank, SourceRankingPayload, TitleDetails } from "./types";

/**
 * Source adapters, part 2 (v1.2.0): the order a play starts in and the reliability labels the
 * source pickers show. The backend ranks sources by the Wilson lower bound over time-decayed
 * play outcomes from every Panda client (GET /panda/sources/ranking, docs/DECISIONS.md D-115).
 */

/** Start order: the community ranking for "auto", otherwise the chosen source first. */
export function sourceOrder(pref: PreferredSource, ranking?: SourceRankingPayload | null): SourceId[] {
  const community = (ranking?.sources ?? []).map((s) => s.id).filter((id) => SOURCE_ORDER.includes(id));
  const base = [...community, ...SOURCE_ORDER.filter((x) => !community.includes(x))];
  return pref === "auto" ? base : [pref, ...base.filter((x) => x !== pref)];
}

/** Short reliability note for a source row: "97% reliable", "Reported 4× today", "Not responding". */
export function reliabilityLabel(r: SourceRank | undefined | null): string | null {
  if (!r) return null;
  if (r.state === "down") return "Not responding";
  if (r.reports24h >= 3 && (r.reliability ?? 1) < 0.8) return `Reported ${r.reports24h}× today`;
  if (r.reliability !== null && r.plays + r.reports >= 3) return `${Math.round(r.reliability * 100)}% reliable`;
  if (r.state === "degraded") return "Slow right now";
  return r.state === "healthy" ? "Working" : null;
}

/** Tone for the reliability dot. */
export function reliabilityTone(r: SourceRank | undefined | null): "good" | "warn" | "bad" | "none" {
  if (!r) return "none";
  if (r.state === "down") return "bad";
  const rel = r.reliability;
  if (rel !== null && r.plays + r.reports >= 3) return rel >= 0.85 ? "good" : rel >= 0.6 ? "warn" : "bad";
  return r.state === "degraded" ? "warn" : r.state === "healthy" ? "good" : "none";
}

export const rankOf = (ranking: SourceRankingPayload | null | undefined, id: SourceId) => ranking?.sources.find((s) => s.id === id);

/** Japanese animation: the titles Vidy's anime catalogue (AniList) covers. */
export const isAnimeTitle = (d: Pick<TitleDetails, "language" | "genres"> | null | undefined) => Boolean(d && d.language === "ja" && d.genres.includes("Animation"));

export const sourceNote = (id: SourceId) => {
  const a = ADAPTERS[id];
  if (!a) return "";
  if (a.anime) return "Anime catalogue from AniList, with its own controls";
  return a.commands ? "Panda's own controls, quality and speed" : "Backup source with its own controls";
};

/** "Report an Issue" choices (§20.9); the three playback faults also switch to the next source. */
export const ISSUES = [
  { id: "noplay", label: "Video won't play or keeps buffering", switchSource: true },
  { id: "wrong", label: "Wrong title or episode", switchSource: true },
  { id: "sync", label: "Audio and video out of sync", switchSource: true },
  { id: "subs", label: "Subtitles missing or wrong", switchSource: false }
] as const;
