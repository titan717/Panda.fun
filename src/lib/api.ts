import type { AnimeDetails, AnimeItem, Episode, AnimeSeasonItem, MediaTrailer } from '../types';
import { slugifyTitle } from './slug';
import { trackApiFailure } from './analytics';
import { buildVidyUrl } from './vidy';

export type MovieApiMedia = {
  id: string;
  type: 'movie' | 'tv' | 'episode';
  title: string;
  originalTitle?: string | null;
  year?: number | null;
  rating?: number | null;
  poster?: string | null;
  backdrop?: string | null;
  overview?: string | null;
  genres?: string[];
  runtime?: number | null;
  releaseDate?: string | null;
  status?: string | null;
  language?: string | null;
  ids?: {
    tmdb?: number | null;
    tvmaze?: number | null;
    imdb?: string | null;
    [key: string]: unknown;
  };
  source?: string;
  trailer?: MediaTrailer | null;
  [key: string]: unknown;
};

export type MovieApiPage<T = MovieApiMedia> = {
  page: number;
  totalPages: number;
  totalResults: number;
  results: T[];
};

export type MovieApiVideo = {
  id: string;
  name: string;
  type: string;
  site: string;
  key: string;
  url: string | null;
  embedUrl: string | null;
  thumbnail: string | null;
  official: boolean;
  publishedAt: string | null;
  language?: string | null;
  country?: string | null;
};

export type MovieApiPlaybackSource = {
  id: string;
  provider: string;
  type: 'embed' | 'hls' | 'dash' | 'file';
  url: string;
  title?: string | null;
  quality?: string | null;
  language?: string | null;
  subtitles?: unknown[];
  expiresAt?: string | null;
  requiresClientPlayback?: boolean;
};

export class MovieApiError extends Error {
  status: number;
  code?: string;
  requestId?: string;

  constructor(message: string, status = 500, code?: string, requestId?: string) {
    super(message);
    this.name = 'MovieApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

const DEFAULT_BASE_URL = 'https://movieapi-3d0v.onrender.com';
const DEFAULT_FALLBACK_URL = '';
const LEGACY_VERCEL_API_HOST = 'apikinoma.vercel.app';
const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || {};

export function resolveMovieApiBaseUrl(configuredBase: unknown): string {
  const normalized = String(configuredBase || '').trim().replace(/\/+$/, '');
  if (!normalized) return DEFAULT_BASE_URL;
  try {
    const hostname = new URL(normalized).hostname.toLowerCase();
    if (hostname === LEGACY_VERCEL_API_HOST) return DEFAULT_BASE_URL;
  } catch {
    return DEFAULT_BASE_URL;
  }
  return normalized;
}

const rawBase = String(viteEnv.VITE_MOVIE_API_URL || DEFAULT_BASE_URL).trim();
export const MOVIE_API_BASE_URL = resolveMovieApiBaseUrl(rawBase);
const rawFallback = String(viteEnv.VITE_MOVIE_API_FALLBACK_URL || DEFAULT_FALLBACK_URL).trim();
export const MOVIE_API_FALLBACK_URL = resolveMovieApiBaseUrl(rawFallback);

function reportApiFailure(error: unknown, path: string) {
  try {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    if (error instanceof Error && error.name === 'AbortError') return;
    const detail = error instanceof MovieApiError ? { status: error.status, code: error.code } : { status: 0, code: 'NETWORK_ERROR' };
    trackApiFailure(path, detail.status, detail.code);
    window.dispatchEvent(new CustomEvent('panda:api-failure', { detail: { path, ...detail } }));
  } catch {}
}

const cache = new Map<string, { expires: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
const CACHE_TTL = 120_000;

function unwrap<T>(payload: any): T {
  if (payload?.success === false) {
    const error = payload.error || {};
    throw new MovieApiError(
      error.message || 'MovieApi request failed.',
      Number(error.status) || 500,
      error.code,
      error.requestId
    );
  }
  return (payload?.success === true && 'data' in payload ? payload.data : payload) as T;
}

function buildUrl(path: string, params?: Record<string, string | number | undefined | null>) {
  const url = new URL(
    path.startsWith('http') ? path : `${MOVIE_API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`,
    window.location.origin
  );
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function request<T>(
  path: string,
  params?: Record<string, string | number | undefined | null>,
  options: RequestInit = {},
  ttl = CACHE_TTL
): Promise<T> {
  const url = buildUrl(path, params);
  const cacheKey = `${options.method || 'GET'}:${url}`;
  const cached = cache.get(cacheKey);
  if (!options.method || options.method === 'GET') {
    if (cached && cached.expires > Date.now()) return cached.value as T;
    const active = inflight.get(cacheKey);
    if (active) return active as Promise<T>;
  }
  const promise = (async () => {
    const bases = [MOVIE_API_BASE_URL];
    if (MOVIE_API_FALLBACK_URL && MOVIE_API_FALLBACK_URL !== MOVIE_API_BASE_URL) bases.push(MOVIE_API_FALLBACK_URL);
    let lastError: unknown = null;
    for (let index = 0; index < bases.length; index += 1) {
      const base = bases[index];
      const targetUrl = path.startsWith('http')
        ? url
        : `${base}${path.startsWith('/') ? path : `/${path}`}${new URL(url).search}`;
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 8_000);
      const externalSignal = options.signal;
      const abortFromExternal = () => controller.abort();
      if (externalSignal) {
        if (externalSignal.aborted) controller.abort();
        else externalSignal.addEventListener('abort', abortFromExternal, { once: true });
      }
      try {
        const response = await fetch(targetUrl, { ...options, signal: controller.signal, headers: { Accept: 'application/json', ...(options.headers || {}) } });
        let payload: unknown = null;
        try { payload = await response.json(); } catch { /* handled below */ }
        if (!response.ok) {
          const data: any = payload;
          const error = data?.error || {};
          const apiError = new MovieApiError(error.message || `MovieApi request failed (${response.status}).`, response.status, error.code, error.requestId || response.headers.get('X-Request-ID') || undefined);
          lastError = apiError;
          if (index < bases.length - 1 && (response.status >= 500 || response.status === 429 || response.status === 404)) continue;
          throw apiError;
        }
        const value = unwrap<T>(payload);
        if (!options.method || options.method === 'GET') cache.set(cacheKey, { expires: Date.now() + ttl, value });
        return value;
      } catch (error) {
        lastError = error;
        const transient = (error instanceof DOMException && error.name === 'AbortError') || !(error instanceof MovieApiError);
        if (index < bases.length - 1 && transient) continue;
        reportApiFailure(error, path);
        if (error instanceof MovieApiError) throw error;
        if (error instanceof DOMException && error.name === 'AbortError') throw new MovieApiError('MovieApi request timed out.', 504, 'PROVIDER_TIMEOUT');
        throw new MovieApiError(`Unable to connect to MovieApi: ${error instanceof Error ? error.message : String(error)}`, 503, 'API_UNAVAILABLE');
      } finally {
        window.clearTimeout(timer);
        externalSignal?.removeEventListener('abort', abortFromExternal);
      }
    }
    throw lastError instanceof Error ? lastError : new MovieApiError('MovieApi unavailable.', 503, 'API_UNAVAILABLE');
  })();
  if (!options.method || options.method === 'GET') {
    inflight.set(cacheKey, promise);
    promise.finally(() => inflight.delete(cacheKey)).catch(() => undefined);
  }
  return promise;
}
type MovieApiMediaRef =
  | { provider: 'tmdb'; type: 'movie' | 'tv'; id: number }
  | { provider: 'tvmaze'; type: 'tv'; id: number };

function mediaFromId(id: string): MovieApiMediaRef | null {
  const tmdb = id.match(/^(?:kinoma_)?tmdb_(movie|tv)_(\d+)$/);
  if (tmdb) return { provider: 'tmdb', type: tmdb[1] as 'movie' | 'tv', id: Number(tmdb[2]) };

  const tvmaze = id.match(/^kinoma_tvmaze_(\d+)$/);
  if (tvmaze) return { provider: 'tvmaze', type: 'tv', id: Number(tvmaze[1]) };

  return null;
}

async function resolveTmdbId(media: MovieApiMediaRef, signal?: AbortSignal): Promise<number | null> {
  if (media.provider === 'tmdb') return media.id;
  const details = await request<MovieApiMedia>(`/api/v1/tv/${media.id}`, undefined, { signal }, 300_000);
  const tmdbId = Number(details.ids?.tmdb || 0);
  return tmdbId > 0 ? tmdbId : null;
}

function toAnimeItem(item: MovieApiMedia): AnimeItem {
  return {
    id: item.id,
    title: item.title,
    image: item.poster || '',
    cover: item.backdrop || '',
    banner: item.backdrop || '',
    rating: item.rating ?? undefined,
    type: item.type,
    releaseDate: item.releaseDate || undefined,
    description: item.overview || undefined,
    genres: item.genres || [],
    status: item.status || undefined,
    contentType: item.type === 'movie' ? 'movie' : 'series',
  };
}

function toDetails(item: MovieApiMedia): AnimeDetails {
  return {
    ...toAnimeItem(item),
    episodes: [],
    seasons: [],
    description: item.overview || undefined,
    totalEpisodes: 0,
    trailer: item.trailer || null,
  };
}

function toEpisode(item: any): Episode {
  return {
    id: String(item.id || item.providerId || `episode-${item.season || 1}-${item.number || 1}`),
    number: Number(item.number || 1),
    title: item.title || undefined,
    image: item.image?.original || item.image?.medium || item.image || undefined,
    duration: item.runtime || undefined,
    playable: true,
    seasonNumber: Number(item.season || 1),
  };
}

async function searchAll(query: string, page = 1, signal?: AbortSignal) {
  const [movies, tv] = await Promise.allSettled([
    request<any>('/api/v1/tmdb/search/movie', { q: query, page }, { signal }),
    request<any>('/api/v1/tmdb/search/tv', { q: query, page }, { signal }),
  ]);

  const movieResults = movies.status === 'fulfilled'
    ? (movies.value.results || []).map((item: any): MovieApiMedia => ({
        id: `tmdb_movie_${item.id}`,
        type: 'movie',
        title: item.title || item.original_title || 'Untitled',
        originalTitle: item.original_title || item.title || null,
        year: item.release_date ? Number(String(item.release_date).slice(0, 4)) || null : null,
        rating: Number.isFinite(Number(item.vote_average)) ? Number(item.vote_average) : null,
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
        overview: item.overview || null,
        genres: [],
        runtime: null,
        releaseDate: item.release_date || null,
        status: null,
        language: item.original_language || null,
        ids: { tmdb: Number(item.id) },
        source: 'tmdb'
      }))
    : [];

  const tvResults = tv.status === 'fulfilled'
    ? (tv.value.results || []).map((item: any): MovieApiMedia => ({
        id: `tmdb_tv_${item.id}`,
        type: 'tv',
        title: item.name || item.original_name || 'Untitled',
        originalTitle: item.original_name || item.name || null,
        year: item.first_air_date ? Number(String(item.first_air_date).slice(0, 4)) || null : null,
        rating: Number.isFinite(Number(item.vote_average)) ? Number(item.vote_average) : null,
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
        overview: item.overview || null,
        genres: [],
        runtime: null,
        releaseDate: item.first_air_date || null,
        status: null,
        language: item.original_language || null,
        ids: { tmdb: Number(item.id) },
        source: 'tmdb'
      }))
    : [];

  const results = [...movieResults, ...tvResults];
  return {
    results,
    total: Math.max(
      Number(movies.status === 'fulfilled' ? movies.value.total_results : 0),
      Number(tv.status === 'fulfilled' ? tv.value.total_results : 0),
      results.length
    )
  };
}

export async function resolveMediaIdFromSlug(slug: string, type?: string) {
  const decoded = decodeURIComponent(slug);
  const legacy = mediaFromId(decoded);
  if (legacy) return legacy.id;

  const normalized = slugifyTitle(decoded);
  if (!normalized) throw new MovieApiError('Invalid title slug.', 400, 'INVALID_TITLE_SLUG');

  const candidates = type === 'movie' ? ['movie'] : type === 'series' ? ['tv'] : ['movie', 'tv'];

  const [providerMatches, tvmazeMatches] = await Promise.all([
    Promise.all(candidates.map(async (kind) => {
      try {
        const data = await request<any>('/api/v1/tmdb/search/' + kind, { q: decoded, page: 1 }, undefined, 60_000);
        return (data.results || []).map((item: any): MovieApiMedia => ({
          id: 'tmdb_' + kind + '_' + item.id,
          type: kind === 'movie' ? 'movie' : 'tv',
          title: item.title || item.name || item.original_title || item.original_name || 'Untitled',
          poster: item.poster_path ? 'https://image.tmdb.org/t/p/w500' + item.poster_path : null,
          backdrop: item.backdrop_path ? 'https://image.tmdb.org/t/p/w1280' + item.backdrop_path : null,
          releaseDate: item.release_date || item.first_air_date || null,
          overview: item.overview || null,
          rating: Number.isFinite(Number(item.vote_average)) ? Number(item.vote_average) : null,
          ids: { tmdb: Number(item.id) },
          source: 'tmdb'
        }));
      } catch { return [] as MovieApiMedia[]; }
    })),
    (type === 'series' || !type) ? (async () => {
      try {
        const data = await request<any>('/api/v1/tv/search', { q: decoded, page: 1, limit: 20 }, undefined, 60_000);
        return (data.results || []).map((item: any) => ({
          id: String(item.id || ''),
          title: item.title || item.name || 'Untitled'
        })).filter((item: { id: string; title: string }) => item.id);
      } catch { return [] as Array<{ id: string; title: string }>; }
    })() : Promise.resolve([] as Array<{ id: string; title: string }>)
  ]);

  const tmdbResults = providerMatches.flat();
  const tmdbExact = tmdbResults.find(item => slugifyTitle(item.title) === normalized);
  const tvmazeExact = tvmazeMatches.find(item => slugifyTitle(item.title) === normalized);

  // TVMaze is the preferred metadata source for series, while MovieAPI maps
  // its records to TMDB IDs for trailers and Vidy playback.
  if ((type === 'series' || !type) && tvmazeExact) {
    return 'kinoma_tvmaze_' + tvmazeExact.id;
  }

  if (tmdbExact) return tmdbExact.id;
  if (tmdbResults[0]) return tmdbResults[0].id;

  if ((type === 'series' || !type) && tvmazeMatches[0]) {
    return 'kinoma_tvmaze_' + tvmazeMatches[0].id;
  }

  throw new MovieApiError('Unable to resolve this title.', 404, 'TITLE_NOT_FOUND');
}

export const api = {
  async getHome() {
    return request<MovieApiHome>('/api/v1/home', undefined, undefined, 120_000);
  },

  async getTrending() {
    const data = await request<MovieApiPage>('/api/v1/trending', { window: 'day' }, undefined, 30_000);
    return { results: data.results.map(toAnimeItem) };
  },

  async getPopular() {
    const data = await request<MovieApiPage>('/api/v1/popular/movies');
    return { results: data.results.map(toAnimeItem) };
  },

  async getUpcomingMovies() {
    const data = await request<MovieApiPage>('/api/v1/upcoming/movies', { region: 'US' }, undefined, 300_000);
    return { results: data.results.map(toAnimeItem) };
  },

  async getUpcomingTv() {
    const data = await request<MovieApiPage>('/api/v1/upcoming/tv', undefined, undefined, 300_000);
    return { results: data.results.map(toAnimeItem) };
  },

  async getNewOnNetflix() {
    const data = await request<MovieApiPage>('/api/v1/streaming/netflix', { region: 'US' }, undefined, 300_000);
    return { results: data.results };
  },

  async getNewOnDisneyPlus() {
    const data = await request<MovieApiPage>('/api/v1/streaming/disney-plus', { region: 'US' }, undefined, 300_000);
    return { results: data.results };
  },

  async getAiringSchedule() {
    const data = await request<any>('/api/v1/airing/today', { country: 'US' }, undefined, 300_000);
    const results = (data.episodes || []).map((episode: any) => episode.show).filter(Boolean).map(toAnimeItem);
    return { schedule: data.episodes || [], results };
  },

  async getAiringToday() {
    return this.getAiringSchedule();
  },

  async getMovies() {
    const data = await request<MovieApiPage>('/api/v1/popular/movies');
    return { results: data.results.map(toAnimeItem) };
  },

  async getGenreAnime(genre = '', limit?: number) {
    const data = await request<{ type: 'tv' | 'movie'; genreId: number; page: number; totalPages: number; totalResults: number; results: MovieApiMedia[] }>('/api/v1/genres/' + encodeURIComponent(genre), { type: 'tv', page: 1 });
    return { results: data.results.slice(0, limit ?? data.results.length).map(toAnimeItem) };
  },

  async search(query: string, signal?: AbortSignal) {
    const data = await searchAll(query, 1, signal);
    return { results: data.results.map(toAnimeItem) };
  },

  async searchPaged(query: string, page = 1) {
    const data = await searchAll(query, page);
    return { results: data.results.map(toAnimeItem), total: data.total };
  },

  async getRecommendations(id: string, signal?: AbortSignal) {
    const media = mediaFromId(id);
    if (!media) return { results: [] as AnimeItem[] };
    const tmdbId = await resolveTmdbId(media, signal);
    if (!tmdbId) return { results: [] as AnimeItem[] };
    const data = await request<MovieApiPage>(
      `/api/v1/recommendations/${tmdbId}`,
      { type: media.type },
      { signal }
    );
    return { results: data.results.map(toAnimeItem) };
  },

  async getTrailer(id: string, signal?: AbortSignal) {
    const details = await this.getDetails(id, signal);
    return {
      available: Boolean(details.trailer?.embedUrl),
      trailer: details.trailer || null
    };
  },

  async getDetails(id: string, signal?: AbortSignal): Promise<AnimeDetails> {
    const media = mediaFromId(id);
    if (!media) throw new MovieApiError('This title is not a MovieApi media ID.', 400, 'INVALID_MEDIA_ID');

    const path = media.provider === 'tvmaze'
      ? `/api/v1/tv/${media.id}`
      : `/api/v1/tmdb/${media.type === 'movie' ? 'movie' : 'tv'}/${media.id}`;
    const data = await request<MovieApiMedia>(path, undefined, { signal });
    if (media.provider === 'tmdb' && media.type === 'tv' && !data.overview && data.ids?.tvmaze) {
      try {
        const tvmaze = await request<MovieApiMedia>(`/api/v1/tv/${data.ids.tvmaze}`, undefined, { signal }, 300_000);
        return toDetails({
          ...data,
          overview: data.overview || tvmaze.overview || null,
          poster: data.poster || tvmaze.poster || null,
          backdrop: data.backdrop || tvmaze.backdrop || null,
          genres: data.genres?.length ? data.genres : (tvmaze.genres || []),
          runtime: data.runtime || tvmaze.runtime || null,
        });
      } catch {
        // TMDB remains the authoritative detail response when the optional fallback is unavailable.
      }
    }
    return toDetails(data);
  },

  async getSeasons(id: string, signal?: AbortSignal) {
    const media = mediaFromId(id);
    if (!media || media.type !== 'tv') return { seasons: [] as AnimeSeasonItem[] };

    if (media.provider === 'tvmaze') {
      const data = await request<{ seasons: any[] }>(`/api/v1/tv/${media.id}/seasons`, undefined, { signal });
      return {
        seasons: (data.seasons || []).map((season: any): AnimeSeasonItem => ({
          seasonNumber: Number(season.number || 1),
          animeId: id,
          title: season.name || `Season ${season.number || 1}`,
          episodeCount: Number(season.episodeOrder || 0),
        })),
      };
    }

    const tmdb = await request<MovieApiMedia & { numberOfSeasons?: number }>(`/api/v1/tmdb/tv/${media.id}`, undefined, { signal }, 300_000);
    const tvmazeId = Number(tmdb.ids?.tvmaze || 0);
    if (!tvmazeId) {
      const count = Math.max(0, Number(tmdb.numberOfSeasons || 0));
      return { seasons: Array.from({ length: count }, (_, index): AnimeSeasonItem => ({
        seasonNumber: index + 1, animeId: id, title: `Season ${index + 1}`, episodeCount: 0
      })) };
    }
    const data = await request<{ seasons: any[] }>(`/api/v1/tv/${tvmazeId}/seasons`, undefined, { signal }, 300_000);
    return { seasons: (data.seasons || []).map((season: any): AnimeSeasonItem => ({
      seasonNumber: Number(season.number || 1), animeId: id, title: season.name || `Season ${season.number || 1}`,
      episodeCount: Number(season.episodeOrder || 0)
    })) };
  },

  async getSeasonEpisodes(id: string, seasonNumber: number, signal?: AbortSignal) {
    const media = mediaFromId(id);
    if (!media || media.type !== 'tv') return { anime_id: id, season_number: seasonNumber, season_anime_id: id, episodes: [] as Episode[] };

    let data: { episodes: any[] };
    if (media.provider === 'tvmaze') {
      data = await request<{ episodes: any[] }>(`/api/v1/tv/${media.id}/season/${seasonNumber}`, undefined, { signal }, 300_000);
    } else {
      const tmdb = await request<MovieApiMedia>(`/api/v1/tmdb/tv/${media.id}`, undefined, { signal }, 300_000);
      const tvmazeId = Number(tmdb.ids?.tvmaze || 0);
      if (tvmazeId) {
        data = await request<{ episodes: any[] }>(`/api/v1/tv/${tvmazeId}/season/${seasonNumber}`, undefined, { signal }, 300_000);
      } else {
        data = await request<{ episodes: any[] }>(`/api/v1/tmdb/tv/${media.id}/season/${seasonNumber}`, undefined, { signal }, 300_000);
      }
    }

    return {
      anime_id: id, season_number: seasonNumber, season_anime_id: id,
      episodes: (data.episodes || []).map((ep) => ({
        id: String(ep.id), number: Number(ep.number || 1), title: ep.title || `Episode ${ep.number || 1}`,
        synopsis: ep.synopsis || ep.overview || '', image: ep.image?.original || ep.image?.medium || ep.image || '',
        duration: Number(ep.runtime || ep.duration || 0) || undefined,
        rating: Number(ep.rating ?? ep.vote_average ?? 0) || undefined
      }))
    };
  },

  async getWatchLink(id: string, season = 1, episode = 1, signal?: AbortSignal, progress = 0) {
    const media = mediaFromId(id);
    if (!media) throw new MovieApiError('Playback requires a MovieApi media ID.', 400, 'INVALID_MEDIA_ID');

    const tmdbId = await resolveTmdbId(media, signal);
    if (!tmdbId) throw new MovieApiError('Unable to resolve this title to a TMDB ID for Vidy playback.', 503, 'TMDB_ID_UNAVAILABLE');

    const url = buildVidyUrl(tmdbId, media.type === 'movie' ? 'movie' : 'tv', season, episode, progress);
    const source: MovieApiPlaybackSource = {
      id: `vidy-${media.type}-${tmdbId}-${season}-${episode}`,
      provider: 'vidy',
      type: 'embed',
      url,
      title: 'Vidy',
      quality: 'auto',
      requiresClientPlayback: true,
    };
    return { url, source };
  },

  async getServers(id: string, episode = 1) {
    try {
      const data = await this.getWatchLink(id, 1, episode);
      return { servers: [data.source] };
    } catch {
      return { servers: [] };
    }
  },

  async getStream(id: string, episode = 1) {
    const data = await this.getWatchLink(id, 1, episode);
    return { url: data.url };
  },

  async getSchedule(_day?: string) {
    return this.getAiringSchedule();
  },

  async health() {
    return request('/api/v1/health', undefined, undefined, 10_000);
  },

  clearCache() {
    cache.clear();
  },

  getDetailsMediaId(id: string) {
    return mediaFromId(id);
  },
};

export type MovieApiHome = {
  featured: MovieApiMedia | null;
  sections: {
    trending: MovieApiMedia[];
    popularMovies: MovieApiMedia[];
    popularTv: MovieApiMedia[];
    latestMovies: MovieApiMedia[];
    latestTv: MovieApiMedia[];
  };
  generatedAt: string;
};

export type KinomaContentApi = typeof api;
