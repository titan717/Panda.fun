import type {
  Collection, CategoriesPayload, Episode, GenresPayload, ListPayload, PagePayload, PandaItem, PlaybackPayload, PlaybackSource, Rail,
  CrewMember, SearchPayload, SeasonDetails, TitleDetails, Top10Payload, Video, WallPayload, WallPoster
} from "./types";

/**
 * Runtime validation for every movieapi payload. The API is ours, but cached payloads can come
 * from an older backend version and third-party data (TMDB) can be sparse, so each payload is
 * checked structurally and lists are sanitised item-by-item: one malformed entry is dropped
 * instead of breaking a whole screen.
 */
export class ValidationError extends Error {
  constructor(readonly path: string, message: string) {
    super(`Unexpected response from ${path}: ${message}`);
    this.name = "ValidationError";
  }
}

type Obj = Record<string, unknown>;
export const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
export const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
export const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown): string[] => arr(v).filter((x): x is string => typeof x === "string" && x.length > 0);

export function item(v: unknown): PandaItem | null {
  if (!isObj(v)) return null;
  const tmdbId = num(v.tmdbId);
  const type = v.type === "movie" || v.type === "tv" ? v.type : null;
  const title = str(v.title);
  if (!tmdbId || !type || !title) return null;
  return {
    id: str(v.id) ?? `${type}:${tmdbId}`, tmdbId, type, title,
    year: num(v.year), rating: num(v.rating),
    poster: str(v.poster), posterLarge: str(v.posterLarge), backdrop: str(v.backdrop), backdropLarge: str(v.backdropLarge),
    overview: str(v.overview), genres: strs(v.genres), language: str(v.language), releaseDate: str(v.releaseDate),
    logo: str(v.logo)
  };
}

const items = (v: unknown) => arr(v).map(item).filter((x): x is PandaItem => x !== null);

function rail(v: unknown): Rail | null {
  if (!isObj(v)) return null;
  const id = str(v.id), title = str(v.title);
  if (!id || !title) return null;
  const list = items(v.items);
  if (list.length === 0) return null;
  return { id, title, style: v.style === "landscape" ? "landscape" : "poster", link: str(v.link), items: list };
}

function video(v: unknown): Video | null {
  if (!isObj(v)) return null;
  const key = str(v.key);
  if (!key || !/^[\w-]{6,20}$/.test(key)) return null;
  return { key, name: str(v.name) ?? "", type: str(v.type) ?? "Video", official: v.official === true, thumbnail: str(v.thumbnail) ?? `https://i.ytimg.com/vi/${key}/hqdefault.jpg`, publishedAt: str(v.publishedAt) };
}

function episode(v: unknown): Episode | null {
  if (!isObj(v)) return null;
  const n = num(v.number), s = num(v.season);
  if (n === null || s === null) return null;
  return {
    id: num(v.id) ?? s * 1000 + n, season: s, number: n, title: str(v.title) ?? `Episode ${n}`, overview: str(v.overview),
    airDate: str(v.airDate), runtime: num(v.runtime), still: str(v.still), stillLarge: str(v.stillLarge), rating: num(v.rating)
  };
}

export function need(path: string, v: unknown): Obj {
  if (!isObj(v)) throw new ValidationError(path, "payload is not an object");
  return v;
}

export function page(path: string, v: unknown): PagePayload {
  const o = need(path, v);
  const kind = str(o.kind) as PagePayload["kind"] | null;
  if (!kind) throw new ValidationError(path, "missing kind");
  return { kind, hero: items(o.hero), rails: arr(o.rails).map(rail).filter((x): x is Rail => x !== null) };
}

export function title(path: string, v: unknown): TitleDetails {
  const base = item(v);
  if (!base) throw new ValidationError(path, "invalid title");
  const o = v as Obj;
  const ep = (x: unknown) => isObj(x) && num(x.season) !== null && num(x.episode) !== null
    ? { season: num(x.season)!, episode: num(x.episode)!, name: str(x.name), airDate: str(x.airDate) } : null;
  return {
    ...base,
    tagline: str(o.tagline), certification: str(o.certification), runtime: num(o.runtime), status: str(o.status),
    originalLanguage: str(o.originalLanguage), languages: strs(o.languages), imdbId: str(o.imdbId), studio: str(o.studio),
    cast: arr(o.cast).filter(isObj).filter((c) => num(c.id) !== null && str(c.name)).map((c) => ({ id: num(c.id)!, name: str(c.name)!, character: str(c.character), profile: str(c.profile) })),
    creators: strs(o.creators), directors: strs(o.directors),
    numberOfSeasons: num(o.numberOfSeasons), numberOfEpisodes: num(o.numberOfEpisodes),
    seasons: arr(o.seasons).filter(isObj).filter((s) => num(s.number) !== null).map((s) => ({ number: num(s.number)!, name: str(s.name) ?? `Season ${num(s.number)}`, episodeCount: num(s.episodeCount) ?? 0, airDate: str(s.airDate), poster: str(s.poster) })),
    lastEpisode: ep(o.lastEpisode), nextEpisode: ep(o.nextEpisode),
    videos: arr(o.videos).map(video).filter((x): x is Video => x !== null),
    moreLikeThis: items(o.moreLikeThis),
    voteCount: num(o.voteCount),
    crew: arr(o.crew).filter(isObj).filter((c) => num(c.id) !== null && str(c.name) && str(c.job))
      .map((c): CrewMember => ({ id: num(c.id)!, name: str(c.name)!, job: str(c.job)!, profile: str(c.profile) })),
    collection: collection(o.collection)
  };
}

/** `/panda/collection/:id` page payload (v1.1.8). */
export function collectionPage(path: string, v: unknown): Collection {
  const c = collection(need(path, v));
  if (!c) throw new ValidationError(path, "invalid collection");
  return c;
}

function collection(v: unknown) {
  if (!isObj(v) || num(v.id) === null || !str(v.name)) return null;
  const parts = items(v.parts);
  return parts.length >= 2 ? { id: num(v.id)!, name: str(v.name)!, overview: str(v.overview), poster: str(v.poster), backdrop: str(v.backdrop), parts } : null;
}

export function season(path: string, v: unknown): SeasonDetails {
  const o = need(path, v);
  const n = num(o.number), id = num(o.tmdbId);
  if (n === null || id === null) throw new ValidationError(path, "invalid season");
  return { tmdbId: id, number: n, name: str(o.name) ?? `Season ${n}`, overview: str(o.overview), episodes: arr(o.episodes).map(episode).filter((x): x is Episode => x !== null) };
}

export function search(path: string, v: unknown): SearchPayload {
  const o = need(path, v);
  const interpreted = str(o.interpreted), corrected = str(o.corrected);
  const people = arr(o.people).map(str).filter((x): x is string => !!x).slice(0, 3);
  return {
    query: str(o.query) ?? "", page: num(o.page) ?? 1, totalPages: num(o.totalPages) ?? 1, results: items(o.results),
    ...(interpreted ? { interpreted } : {}), ...(corrected ? { corrected } : {}), ...(people.length ? { people } : {})
  };
}

export function list(path: string, v: unknown): ListPayload {
  const o = need(path, v);
  return { page: num(o.page) ?? 1, totalPages: num(o.totalPages) ?? undefined, results: items(o.results) };
}

export function top10(path: string, v: unknown): Top10Payload {
  const o = need(path, v);
  return { lang: str(o.lang) ?? "", label: str(o.label) ?? "", results: items(o.results) };
}

export function categories(path: string, v: unknown): CategoriesPayload {
  const o = need(path, v);
  return {
    genres: arr(o.genres).filter(isObj).filter((g) => num(g.id) !== null && str(g.name)).map((g) => ({ id: num(g.id)!, name: str(g.name)!, image: str(g.image) })),
    languages: arr(o.languages).filter(isObj).filter((g) => str(g.code) && str(g.name)).map((g) => ({ code: str(g.code)!, name: str(g.name)!, image: str(g.image) }))
  };
}

export function genres(path: string, v: unknown): GenresPayload {
  const o = need(path, v);
  const g = (x: unknown) => arr(x).filter(isObj).filter((y) => num(y.id) !== null && str(y.name)).map((y) => ({ id: num(y.id)!, name: str(y.name)! }));
  return { movie: g(o.movie), tv: g(o.tv), languages: arr(o.languages).filter(isObj).filter((y) => str(y.code) && str(y.name)).map((y) => ({ code: str(y.code)!, name: str(y.name)! })) };
}

export const SOURCE_IDS = new Set(["cinesrc", "vidy", "vidyanime"]);
export function playback(path: string, v: unknown): PlaybackPayload {
  const o = need(path, v);
  const type = o.type === "tv" ? "tv" : "movie";
  const sources = arr(o.sources).filter(isObj).filter((s) => SOURCE_IDS.has(String(s.id)) && str(s.url)?.startsWith("https://") && str(s.origin)).map((s): PlaybackSource => ({
    id: s.id as PlaybackSource["id"], provider: str(s.provider) ?? String(s.id), label: str(s.label) ?? String(s.id),
    url: str(s.url)!, origin: str(s.origin)!, events: s.events === "cinesrc" ? "cinesrc" : s.events === "vidy" ? "vidy" : "none",
    supportsStart: s.supportsStart === true
  }));
  return { type, tmdbId: num(o.tmdbId) ?? 0, season: num(o.season) ?? undefined, episode: num(o.episode) ?? undefined, anilistId: num(o.anilistId), sources };
}

export function wall(path: string, v: unknown): WallPayload {
  const o = need(path, v);
  const seen = new Set<string>();
  const posters: WallPoster[] = [];
  for (const p of arr(o.posters).filter(isObj)) {
    const id = str(p.id); const poster = str(p.poster);
    if (!id || !poster || !poster.startsWith("https://") || seen.has(id) || seen.has(poster)) continue;
    seen.add(id); seen.add(poster);
    posters.push({ id, title: str(p.title) ?? "", poster });
  }
  return { posters };
}

/** Payloads read only by lazy pages (person, anime, calendar, source health and ranking) validate in `validateLazy.ts`. */
export const LAZY_VALIDATED = /^\/panda\/(person\/|anime$|calendar|subtitles\/tt|sources\/(health|ranking))/;

/** Validator chosen from the API path, so the generic SWR fetcher validates too. */
export function validatorFor(path: string): ((path: string, v: unknown) => unknown) | null {
  if (path.startsWith("/panda/page/")) return page;
  if (/^\/panda\/title\/tv\/\d+\/season\//.test(path)) return season;
  if (path.startsWith("/panda/title/")) return title;
  if (path.startsWith("/panda/search")) return search;
  if (path.startsWith("/panda/discover/") || path.startsWith("/panda/trending")) return list;
  if (path.startsWith("/panda/top10/")) return top10;
  if (path.startsWith("/panda/categories")) return categories;
  if (path.startsWith("/panda/genres")) return genres;
  if (path.startsWith("/panda/play/")) return playback;
  if (path.startsWith("/panda/wall")) return wall;
  if (path.startsWith("/panda/collection/")) return collectionPage;
  return null;
}
