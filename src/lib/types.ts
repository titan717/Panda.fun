export type MediaType = "movie" | "tv";

/** List item returned by every movieapi /panda endpoint. */
export interface PandaItem {
  id: string;
  tmdbId: number;
  type: MediaType;
  title: string;
  year: number | null;
  rating: number | null;
  poster: string | null;
  posterLarge: string | null;
  backdrop: string | null;
  backdropLarge: string | null;
  overview: string | null;
  genres: string[];
  language: string | null;
  releaseDate: string | null;
  logo?: string | null;
}

export type RailStyle = "poster" | "landscape";

export interface Rail {
  id: string;
  title: string;
  style: RailStyle;
  link: string | null;
  items: PandaItem[];
}

export type PageKind = "home" | "movies" | "tv" | "kids" | "new";

export interface PagePayload {
  kind: PageKind;
  hero: PandaItem[];
  rails: Rail[];
}

export interface CastMember {
  id: number;
  name: string;
  character: string | null;
  profile: string | null;
}

export interface SeasonSummary {
  number: number;
  name: string;
  episodeCount: number;
  airDate: string | null;
  poster: string | null;
}

export interface EpisodeRef {
  season: number;
  episode: number;
  name: string | null;
  airDate: string | null;
}

export interface Video {
  key: string;
  name: string;
  type: string;
  official: boolean;
  thumbnail: string;
  publishedAt?: string | null;
}

export interface TitleDetails extends PandaItem {
  tagline: string | null;
  certification: string | null;
  runtime: number | null;
  status: string | null;
  originalLanguage: string | null;
  languages: string[];
  imdbId: string | null;
  studio: string | null;
  cast: CastMember[];
  creators: string[];
  directors: string[];
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  seasons: SeasonSummary[];
  lastEpisode: EpisodeRef | null;
  nextEpisode: EpisodeRef | null;
  videos: Video[];
  moreLikeThis: PandaItem[];
  /** TMDB vote count behind `rating` (v1.1.2). */
  voteCount: number | null;
  /** Key crew with ids, most important job first (v1.1.2). */
  crew: CrewMember[];
  /** The movie's collection, parts in release order (v1.1.2). */
  collection: Collection | null;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  profile: string | null;
}

export interface Collection {
  id: number;
  name: string;
  overview: string | null;
  poster: string | null;
  backdrop: string | null;
  parts: PandaItem[];
}

export interface PersonCredit extends PandaItem {
  role: string | null;
}

export interface PersonDetails {
  id: number;
  name: string;
  profile: string | null;
  profileLarge: string | null;
  biography: string | null;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  department: string | null;
  imdbId: string | null;
  knownFor: PersonCredit[];
}

export interface Episode {
  id: number;
  season: number;
  number: number;
  title: string;
  overview: string | null;
  airDate: string | null;
  runtime: number | null;
  still: string | null;
  stillLarge: string | null;
  rating: number | null;
}

export interface SeasonDetails {
  tmdbId: number;
  number: number;
  name: string;
  overview: string | null;
  episodes: Episode[];
}

export interface SearchPayload {
  query: string;
  page: number;
  totalPages: number;
  results: PandaItem[];
  /** Plain-language query understood as a browse request, e.g. "Hindi Movies". */
  interpreted?: string;
  /** Title the backend matched when the typed query had no results (typo correction). */
  corrected?: string;
  /** People whose best-known titles are included in the results. */
  people?: string[];
}

export interface ListPayload {
  page: number;
  totalPages?: number;
  results: PandaItem[];
}

export interface Top10Payload {
  lang: string;
  label: string;
  results: PandaItem[];
}

export interface CategoriesPayload {
  genres: { id: number; name: string; image: string | null }[];
  languages: { code: string; name: string; image: string | null }[];
}

export interface GenresPayload {
  movie: { id: number; name: string }[];
  tv: { id: number; name: string }[];
  languages: { code: string; name: string }[];
}

export type SourceId = "cinesrc" | "vidy";

export interface PlaybackSource {
  id: SourceId;
  provider: string;
  label: string;
  url: string;
  origin: string;
  events: "cinesrc" | "vidy" | "none";
  supportsStart: boolean;
}

export interface PlaybackPayload {
  type: MediaType;
  tmdbId: number;
  season?: number;
  episode?: number;
  sources: PlaybackSource[];
}

export interface SourceHealth {
  id: SourceId;
  label: string;
  state: "healthy" | "degraded" | "down";
  status: number | null;
  latencyMs: number | null;
  checkedAt: string;
}

export interface SourceHealthPayload {
  sources: SourceHealth[];
}

/** Poster wall behind "Who's watching?" (GET /panda/wall). */
export interface WallPoster { id: string; title: string; poster: string }
export interface WallPayload { posters: WallPoster[] }
