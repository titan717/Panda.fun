export interface MediaTrailer {
  id: string;
  name: string;
  type: string;
  site: string;
  key: string;
  url?: string | null;
  embedUrl?: string | null;
  thumbnail?: string | null;
  official?: boolean;
  publishedAt?: string | null;
  language?: string | null;
  country?: string | null;
}

export interface Episode {
  id: string;
  number: number;
  title?: string;
  synopsis?: string;
  image?: string;
  duration?: number;
  rating?: number;
  playable?: boolean;
  subbed?: boolean;
  dubbed?: boolean;
  seasonNumber?: number;
  seasonAnimeId?: string;
}

export interface AnimeSeasonItem {
  seasonNumber: number;
  animeId: string;
  title: string;
  episodeCount: number;
}

export type ContentType = 'anime' | 'movie' | 'series';

export interface AnimeItem {
  id: string;
  title: string | { english?: string; romaji?: string; native?: string };
  image: string;
  cover?: string;
  banner?: string;
  rating?: number | string;
  contentRating?: string;
  type?: string;
  releaseDate?: string;
  originalLanguage?: string;
  runtime?: number;
  description?: string;
  genres?: string[];
  totalEpisodes?: number;
  status?: string;
  contentType?: ContentType;
}

export interface AnimeDetails extends AnimeItem {
  episodes: Episode[];
  seasons?: AnimeSeasonItem[];
  studio?: string;
  trailer?: MediaTrailer | null;
}

export const DEFAULT_POSTER = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=60';
export const DEFAULT_BANNER = 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1600&auto=format&fit=crop&q=80';
