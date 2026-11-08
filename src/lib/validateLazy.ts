import type { CalendarEntry, CalendarEpisode, CalendarPayload, CalendarRef, AnimeCard, AnimePayload, PersonCredit, PersonDetails, PlaybackSource, SourceHealthPayload, SourceRankingPayload } from "./types";
import { arr, isObj, item, need, num, SOURCE_IDS, str, ValidationError } from "./validate";

/**
 * Validators for payloads only lazy pages read (Person, Anime, Settings › Sources, the player's
 * source pickers). They live in their own chunk so the entry stays inside its budget (docs/PERF.md);
 * `fetchJson` loads this module on demand for those paths, and the pages that use them import it
 * statically so it is already there.
 */
type Obj = Record<string, unknown>;

export function person(path: string, v: unknown): PersonDetails {
  const o = need(path, v);
  const id = num(o.id), name = str(o.name);
  if (id === null || !name) throw new ValidationError(path, "invalid person");
  const knownFor = arr(o.knownFor).map((x): PersonCredit | null => { const it = item(x); return it ? { ...it, role: str((x as Obj).role) } : null; })
    .filter((x): x is PersonCredit => x !== null);
  return {
    id, name, profile: str(o.profile), profileLarge: str(o.profileLarge), biography: str(o.biography), birthday: str(o.birthday),
    deathday: str(o.deathday), placeOfBirth: str(o.placeOfBirth), department: str(o.department), imdbId: str(o.imdbId), knownFor
  };
}

export function sourceHealth(path: string, v: unknown): SourceHealthPayload {
  const o = need(path, v);
  return {
    sources: arr(o.sources).filter(isObj).filter((s) => SOURCE_IDS.has(String(s.id))).map((s) => ({
      id: s.id as PlaybackSource["id"], label: str(s.label) ?? String(s.id),
      state: s.state === "healthy" || s.state === "degraded" ? s.state : "down",
      status: num(s.status), latencyMs: num(s.latencyMs), checkedAt: str(s.checkedAt) ?? new Date().toISOString()
    }))
  };
}

export function sourceRanking(path: string, v: unknown): SourceRankingPayload {
  const o = need(path, v);
  const state = (s: unknown): "healthy" | "degraded" | "down" | null => (s === "healthy" || s === "degraded" || s === "down" ? s : null);
  return {
    sources: arr(o.sources).filter(isObj).filter((s) => SOURCE_IDS.has(String(s.id))).map((s) => ({
      id: s.id as PlaybackSource["id"], rank: num(s.rank) ?? 99, score: num(s.score) ?? 0, reliability: num(s.reliability),
      plays: num(s.plays) ?? 0, reports: num(s.reports) ?? 0, reports24h: num(s.reports24h) ?? 0, state: state(s.state)
    })).sort((a, b) => a.rank - b.rank),
    halfLifeHours: num(o.halfLifeHours) ?? 72, shared: o.shared === true, updatedAt: str(o.updatedAt) ?? new Date().toISOString()
  };
}

export function anime(path: string, v: unknown): AnimePayload {
  const o = need(path, v);
  const card = (x: unknown): AnimeCard | null => {
    const it = item(x);
    if (!it || !isObj(x) || num(x.anilistId) === null) return null;
    const air = isObj(x.airing) && num(x.airing.episode) !== null && str(x.airing.at) ? { episode: num(x.airing.episode)!, at: str(x.airing.at)! } : null;
    const color = str(x.color);
    return { ...it, anilistId: num(x.anilistId)!, color: color && /^#[0-9a-f]{6}$/i.test(color) ? color : null, score: num(x.score), format: str(x.format), episodes: num(x.episodes), airing: air, studio: str(x.studio) };
  };
  const rows = arr(o.rows).filter(isObj).map((r) => ({ id: str(r.id) ?? "", title: str(r.title) ?? "", items: arr(r.items).map(card).filter((c): c is AnimeCard => c !== null) })).filter((r) => r.id && r.title && r.items.length);
  const season = isObj(o.season) && str(o.season.name) && num(o.season.year) ? { name: str(o.season.name)!, year: num(o.season.year)! } : { name: "", year: 0 };
  return { hero: card(o.hero), rows, season };
}

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
function calRef(v: unknown): CalendarRef | null {
  if (!isObj(v)) return null;
  const season = num(v.season), episode = num(v.episode);
  if (season === null || episode === null) return null;
  return { season, episode, name: str(v.name), airDate: isDate(v.airDate) ? v.airDate : null };
}

/** Release calendar (v1.1.7): entries with an unusable item are dropped, episodes need a real air date. */
export function calendar(path: string, v: unknown): CalendarPayload {
  const o = need(path, v);
  const entries = arr(o.entries).map((x): CalendarEntry | null => {
    if (!isObj(x)) return null;
    const it = item(x.item);
    if (!it) return null;
    const episodes = arr(x.episodes).map((e): CalendarEpisode | null => {
      if (!isObj(e) || !isDate(e.airDate)) return null;
      const season = num(e.season), episode = num(e.episode);
      if (season === null || episode === null || season < 1) return null;
      return { season, episode, name: str(e.name), airDate: e.airDate, still: str(e.still), runtime: num(e.runtime) };
    }).filter((e): e is CalendarEpisode => e !== null);
    return { item: it, status: str(x.status), lastEpisode: calRef(x.lastEpisode), nextEpisode: calRef(x.nextEpisode), episodes };
  }).filter((e): e is CalendarEntry => e !== null);
  return { entries };
}

export function lazyValidatorFor(path: string): ((path: string, v: unknown) => unknown) | null {
  if (path.startsWith("/panda/sources/health")) return sourceHealth;
  if (path.startsWith("/panda/sources/ranking")) return sourceRanking;
  if (path === "/panda/anime") return anime;
  if (path.startsWith("/panda/calendar")) return calendar;
  if (path.startsWith("/panda/person/")) return person;
  return null;
}
