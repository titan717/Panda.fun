// Kinoma user preferences, search history, and personalization storage
const SEARCH_HISTORY_KEY = 'panda_search_history';
const GENRE_AFFINITY_KEY = 'panda_genre_affinity';
const AUDIO_PREF_PREFIX = 'panda_audio_pref_';
const SERVER_PREF_PREFIX = 'panda_server_pref_';
const GLOBAL_AUDIO_PREF_KEY = 'panda_global_audio_pref';
export interface GenreAffinity {
  [genre: string]: number;
}

export const preferencesUtil = {
  // --- Search History ---
  getRecentSearches: (): string[] => {
    try {
      const data = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
    } catch {
      return [];
    }
  },

  addRecentSearch: (query: string) => {
    if (!query || query.trim().length === 0) return;
    const clean = query.trim();
    try {
      const existing = preferencesUtil.getRecentSearches();
      const filtered = existing.filter(q => q.toLowerCase() !== clean.toLowerCase());
      const updated = [clean, ...filtered].slice(0, 10);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('panda_search_history_updated', { detail: updated }));
    } catch {}
  },

  removeRecentSearch: (query: string) => {
    try {
      const existing = preferencesUtil.getRecentSearches();
      const updated = existing.filter(q => q.toLowerCase() !== query.toLowerCase());
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('panda_search_history_updated', { detail: updated }));
    } catch {}
  },

  clearRecentSearches: () => {
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
      window.dispatchEvent(new CustomEvent('panda_search_history_updated', { detail: [] }));
    } catch {}
  },

  // --- Genre Affinity / Personalization Signals ---
  recordGenreInteraction: (genres: string[]) => {
    if (!genres || !Array.isArray(genres) || genres.length === 0) return;
    try {
      const data = localStorage.getItem(GENRE_AFFINITY_KEY);
      const affinity: GenreAffinity = data ? JSON.parse(data) : {};
      genres.forEach(g => {
        const key = g.trim();
        if (key) {
          affinity[key] = (affinity[key] || 0) + 1;
        }
      });
      localStorage.setItem(GENRE_AFFINITY_KEY, JSON.stringify(affinity));
      window.dispatchEvent(new CustomEvent('panda_genre_affinity_updated', { detail: preferencesUtil.getTopUserGenres(5) }));
    } catch {}
  },

  getTopUserGenres: (limit = 3): string[] => {
    try {
      const data = localStorage.getItem(GENRE_AFFINITY_KEY);
      if (!data) return [];
      const affinity: GenreAffinity = JSON.parse(data);
      const entries = Object.entries(affinity);
      entries.sort((a, b) => b[1] - a[1]);
      return entries.slice(0, limit).map(([genre]) => genre);
    } catch {
      return [];
    }
  },

  // --- Audio / Subtitle Preferences (Per anime & Global) ---
  getAudioPreference: (animeId?: string): 'sub' | 'dub' => {
    try {
      if (animeId) {
        const perAnime = localStorage.getItem(`${AUDIO_PREF_PREFIX}${animeId}`);
        if (perAnime === 'sub' || perAnime === 'dub') return perAnime;
      }
      const globalPref = localStorage.getItem(GLOBAL_AUDIO_PREF_KEY);
      if (globalPref === 'sub' || globalPref === 'dub') return globalPref;
    } catch {}
    return 'sub';
  },

  setAudioPreference: (pref: 'sub' | 'dub', animeId?: string) => {
    try {
      if (animeId) {
        localStorage.setItem(`${AUDIO_PREF_PREFIX}${animeId}`, pref);
      }
      localStorage.setItem(GLOBAL_AUDIO_PREF_KEY, pref);
    } catch {}
  },

  getServerPreference: (animeId?: string): string => {
    try {
      if (animeId) {
        const perAnime = localStorage.getItem(`${SERVER_PREF_PREFIX}${animeId}`);
        if (perAnime) return perAnime;
      }
    } catch {}
    return 'HD-1';
  },

  setServerPreference: (server: string, animeId?: string) => {
    try {
      if (animeId) {
        localStorage.setItem(`${SERVER_PREF_PREFIX}${animeId}`, server);
      }
    } catch {}
  }

};
