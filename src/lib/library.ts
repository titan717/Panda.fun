import { auth, db } from './firebase';
import { getActiveProfileId, getActiveProfileStorageKey } from './profileScope';
import { doc, setDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';

export interface LibraryItem {
  id: string;
  title: string;
  image: string;
  type: 'watchlist' | 'completed' | 'favorites';
  updatedAt: number;
}

const WATCHLIST_KEY = 'kinoma_watchlist';
const COMPLETED_KEY = 'kinoma_completed';
const FAVORITES_KEY = 'kinoma_favorites';
const SEARCH_HISTORY_KEY = 'kinoma_search_history';
const activeKey = (base: string) => getActiveProfileStorageKey(base);

// Default fallback poster
const DEFAULT_POSTER = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';

function safeGet(key: string, fallbackKey?: string): LibraryItem[] {
  try {
    const data = localStorage.getItem(activeKey(key)) || (activeKey(key) === key && fallbackKey ? localStorage.getItem(fallbackKey) : null);
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed.map((item: any) => ({
        id: String(item.id || item.animeId || ''),
        title: String(item.title || 'Untitled Anime'),
        image: item.image || DEFAULT_POSTER,
        type: item.type || (key.includes('completed') ? 'completed' : key.includes('favorites') ? 'favorites' : 'watchlist'),
        updatedAt: Number(item.updatedAt || item.addedAt || item.timestamp || Date.now())
      })).filter(i => Boolean(i.id)).sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return [];
  } catch {
    return [];
  }
}

function safeSet(key: string, items: LibraryItem[]): void {
  try {
    localStorage.setItem(activeKey(key), JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('kinoma_library_update', { detail: { key, count: items.length } }));
  } catch (e) {
    console.error('Failed to save library data', e);
  }
}

function syncItemToCloud(item: LibraryItem) {
  if (!auth.currentUser) return;
  try {
    const cleanId = `${item.type}_${item.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const profileId = getActiveProfileId(auth.currentUser.uid);
    const itemRef = profileId
      ? doc(db, 'users', auth.currentUser.uid, 'profiles', profileId, 'library', cleanId)
      : doc(db, 'users', auth.currentUser.uid, 'library', cleanId);
    setDoc(itemRef, {
      id: item.id,
      title: item.title,
      image: item.image || '',
      type: item.type,
      updatedAt: item.updatedAt
    }, { merge: true }).catch((err) => {
      console.warn('Cloud sync error for library item:', err);
    });
  } catch (e) {
    console.warn('Failed cloud sync:', e);
  }
}

function deleteItemFromCloud(id: string, type: string) {
  if (!auth.currentUser) return;
  try {
    const cleanId = `${type}_${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const profileId = getActiveProfileId(auth.currentUser.uid);
    const itemRef = profileId
      ? doc(db, 'users', auth.currentUser.uid, 'profiles', profileId, 'library', cleanId)
      : doc(db, 'users', auth.currentUser.uid, 'library', cleanId);
    deleteDoc(itemRef).catch(() => {});
  } catch {}
}

export const libraryManager = {
  getWatchlist: (): LibraryItem[] => safeGet(WATCHLIST_KEY, 'animora_watchlist'),
  getCompleted: (): LibraryItem[] => safeGet(COMPLETED_KEY, 'animora_completed'),
  getFavorites: (): LibraryItem[] => safeGet(FAVORITES_KEY, 'animora_favorites'),

  isInWatchlist: (id: string): boolean => {
    return safeGet(WATCHLIST_KEY, 'animora_watchlist').some(i => i.id === id);
  },

  isCompleted: (id: string): boolean => {
    return safeGet(COMPLETED_KEY, 'animora_completed').some(i => i.id === id);
  },

  isFavorite: (id: string): boolean => {
    return safeGet(FAVORITES_KEY, 'animora_favorites').some(i => i.id === id);
  },

  toggleWatchlist: (item: { id: string; title: string; image?: string }): boolean => {
    const list = safeGet(WATCHLIST_KEY, 'animora_watchlist');
    const existingIndex = list.findIndex(i => i.id === item.id);
    let isNowInWatchlist = false;

    if (existingIndex >= 0) {
      list.splice(existingIndex, 1);
      deleteItemFromCloud(item.id, 'watchlist');
      isNowInWatchlist = false;
    } else {
      const newItem: LibraryItem = {
        id: item.id,
        title: item.title,
        image: item.image || DEFAULT_POSTER,
        type: 'watchlist',
        updatedAt: Date.now()
      };
      list.unshift(newItem);
      syncItemToCloud(newItem);
      isNowInWatchlist = true;
    }

    safeSet(WATCHLIST_KEY, list);
    return isNowInWatchlist;
  },

  toggleCompleted: (item: { id: string; title: string; image?: string }): boolean => {
    const list = safeGet(COMPLETED_KEY, 'animora_completed');
    const existingIndex = list.findIndex(i => i.id === item.id);
    let isNowCompleted = false;

    if (existingIndex >= 0) {
      list.splice(existingIndex, 1);
      deleteItemFromCloud(item.id, 'completed');
      isNowCompleted = false;
    } else {
      const newItem: LibraryItem = {
        id: item.id,
        title: item.title,
        image: item.image || DEFAULT_POSTER,
        type: 'completed',
        updatedAt: Date.now()
      };
      list.unshift(newItem);
      syncItemToCloud(newItem);
      isNowCompleted = true;
    }

    safeSet(COMPLETED_KEY, list);
    return isNowCompleted;
  },

  toggleFavorite: (item: { id: string; title: string; image?: string }): boolean => {
    const list = safeGet(FAVORITES_KEY, 'animora_favorites');
    const existingIndex = list.findIndex(i => i.id === item.id);
    let isNowFav = false;

    if (existingIndex >= 0) {
      list.splice(existingIndex, 1);
      deleteItemFromCloud(item.id, 'favorites');
      isNowFav = false;
    } else {
      const newItem: LibraryItem = {
        id: item.id,
        title: item.title,
        image: item.image || DEFAULT_POSTER,
        type: 'favorites',
        updatedAt: Date.now()
      };
      list.unshift(newItem);
      syncItemToCloud(newItem);
      isNowFav = true;
    }

    safeSet(FAVORITES_KEY, list);
    return isNowFav;
  },

  removeItem: (id: string, type: 'watchlist' | 'completed' | 'favorites'): void => {
    const key = type === 'watchlist' ? WATCHLIST_KEY : type === 'completed' ? COMPLETED_KEY : FAVORITES_KEY;
    const list = safeGet(key).filter(i => i.id !== id);
    safeSet(key, list);
    deleteItemFromCloud(id, type);
  },

  clearType: (type: 'watchlist' | 'completed' | 'favorites'): void => {
    const key = type === 'watchlist' ? WATCHLIST_KEY : type === 'completed' ? COMPLETED_KEY : FAVORITES_KEY;
    safeSet(key, []);
  },

  clearAll: (): void => {
    safeSet(WATCHLIST_KEY, []);
    safeSet(COMPLETED_KEY, []);
    safeSet(FAVORITES_KEY, []);
  },

  getSearchHistory: (): string[] => {
    try {
      const data = localStorage.getItem(activeKey(SEARCH_HISTORY_KEY)) || (activeKey(SEARCH_HISTORY_KEY) === SEARCH_HISTORY_KEY ? localStorage.getItem('animora_search_history') : null);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  addSearchQuery: (query: string): void => {
    if (!query || !query.trim()) return;
    try {
      const trimmed = query.trim();
      let list = libraryManager.getSearchHistory();
      list = [trimmed, ...list.filter(q => q.toLowerCase() !== trimmed.toLowerCase())].slice(0, 15);
      localStorage.setItem(activeKey(SEARCH_HISTORY_KEY), JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('kinoma_search_update'));
    } catch {}
  },

  removeSearchQuery: (query: string): void => {
    try {
      const list = libraryManager.getSearchHistory().filter(q => q !== query);
      localStorage.setItem(activeKey(SEARCH_HISTORY_KEY), JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('kinoma_search_update'));
    } catch {}
  },

  clearSearchHistory: (): void => {
    try {
      localStorage.removeItem(activeKey(SEARCH_HISTORY_KEY));
      localStorage.removeItem('animora_search_history');
      window.dispatchEvent(new CustomEvent('kinoma_search_update'));
    } catch {}
  },

  syncFromFirestore: async (userId: string): Promise<void> => {
    try {
      const profileId = getActiveProfileId(userId);
      const colRef = profileId
        ? collection(db, 'users', userId, 'profiles', profileId, 'library')
        : collection(db, 'users', userId, 'library');
      const snap = await getDocs(colRef);
      if (snap.empty) return;

      const watchMap: Record<string, LibraryItem> = {};
      const compMap: Record<string, LibraryItem> = {};
      const favMap: Record<string, LibraryItem> = {};

      libraryManager.getWatchlist().forEach(i => { watchMap[i.id] = i; });
      libraryManager.getCompleted().forEach(i => { compMap[i.id] = i; });
      libraryManager.getFavorites().forEach(i => { favMap[i.id] = i; });

      snap.forEach(d => {
        const item = d.data() as Partial<LibraryItem>;
        if (!item.id || !item.type) return;

        const validItem: LibraryItem = {
          id: item.id,
          title: item.title || 'Untitled Anime',
          image: item.image || DEFAULT_POSTER,
          type: item.type as any,
          updatedAt: item.updatedAt || Date.now()
        };

        if (item.type === 'watchlist') watchMap[item.id] = validItem;
        else if (item.type === 'completed') compMap[item.id] = validItem;
        else if (item.type === 'favorites') favMap[item.id] = validItem;
      });

      safeSet(WATCHLIST_KEY, Object.values(watchMap).sort((a, b) => b.updatedAt - a.updatedAt));
      safeSet(COMPLETED_KEY, Object.values(compMap).sort((a, b) => b.updatedAt - a.updatedAt));
      safeSet(FAVORITES_KEY, Object.values(favMap).sort((a, b) => b.updatedAt - a.updatedAt));
    } catch (e) {
      console.warn('Error syncing library from Firestore:', e);
    }
  }
};
