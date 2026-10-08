import { auth, db } from './firebase';
import { doc, setDoc, getDocs, collection } from 'firebase/firestore';
import { getActiveProfileId, getActiveProfileStorageKey } from './profileScope';

export interface HistoryItem {
  animeId: string;
  slug: string;
  episodeId: string;
  episodeNumber: string;
  seasonNumber: number;
  seasonTitle?: string;
  title: string;
  image: string;
  playbackTimestamp: number; // seconds
  duration: number; // seconds
  completionPercentage: number; // 0 to 100
  lastWatchedTime: number; // timestamp in ms
  isCompleted: boolean;
  // Backward compatibility aliases
  progress: number;
  timestamp: number;
}

export interface EpisodeProgress {
  animeId: string;
  slug: string;
  seasonNumber: number;
  episodeId: string;
  episodeNumber: string;
  playbackTimestamp: number;
  duration: number;
  completionPercentage: number;
  lastWatchedTime: number;
  isCompleted: boolean;
}

export interface WatchCTAInfo {
  type: 'watch_now' | 'continue_watching' | 'watch_again';
  label: string;
  episode: any;
  seasonNumber: number;
  playbackTimestamp: number;
  formattedTimestamp: string;
  completionPercentage: number;
  isCompletedAnime: boolean;
}

const HISTORY_KEY = 'kinoma_history';
const LEGACY_HISTORY_KEY = 'animora_history';
const META_KEY = 'kinoma_meta_cache';
const LEGACY_META_KEY = 'animora_meta_cache';
const EPISODES_PROGRESS_KEY = 'kinoma_ep_progress';
const activeKey = (base: string) => getActiveProfileStorageKey(base);

export function formatPlaybackTimestamp(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(secs)}`;
  }
  return `${minutes}:${pad(secs)}`;
}

export function parseSeasonNumber(titleOrStr: any, fallback = 1): number {
  if (!titleOrStr) return fallback;
  const str = typeof titleOrStr === 'string'
    ? titleOrStr
    : (titleOrStr.english || titleOrStr.romaji || titleOrStr.native || '');

  // Check Season X, Xnd/rd/th Season, S X, Part X
  const match = str.match(/(?:Season\s*(\d+))|(?:(\d+)(?:nd|rd|th|st)\s*Season)|(?:\bS(\d+)\b)|(?:Part\s*(\d+))/i);
  if (match) {
    const raw = match[1] || match[2] || match[3] || match[4];
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }
  return fallback;
}

export const historyUtil = {
  getHistory: (): HistoryItem[] => {
    try {
      const data = localStorage.getItem(activeKey(HISTORY_KEY)) || (getActiveProfileStorageKey(HISTORY_KEY) === HISTORY_KEY ? localStorage.getItem(LEGACY_HISTORY_KEY) : null);
      if (!data) return [];
      const parsed: any[] = JSON.parse(data);
      return parsed.map(item => {
        const playbackTimestamp = item.playbackTimestamp ?? item.progress ?? 0;
        const duration = item.duration || 1440;
        const completionPercentage = item.completionPercentage ?? (duration > 0 ? (playbackTimestamp / duration) * 100 : 0);
        const lastWatchedTime = item.lastWatchedTime ?? item.timestamp ?? Date.now();
        const seasonNumber = item.seasonNumber ?? parseSeasonNumber(item.title, 1);
        const isCompleted = item.isCompleted ?? (completionPercentage >= 88);

        return {
          ...item,
          seasonNumber,
          playbackTimestamp,
          duration,
          completionPercentage,
          lastWatchedTime,
          isCompleted,
          progress: playbackTimestamp,
          timestamp: lastWatchedTime
        };
      });
    } catch {
      return [];
    }
  },

  saveMeta: (slug: string, meta: { title: string; image: string; animeId: string; seasonNumber?: number }) => {
    try {
      const data = localStorage.getItem(activeKey(META_KEY)) || (activeKey(META_KEY) === META_KEY ? localStorage.getItem(LEGACY_META_KEY) : null);
      const metas = data ? JSON.parse(data) : {};
      metas[slug] = meta;
      localStorage.setItem(activeKey(META_KEY), JSON.stringify(metas));
    } catch (e) {
      console.error('Failed to save meta', e);
    }
  },

  getMeta: (slug: string) => {
    try {
      const data = localStorage.getItem(META_KEY) || localStorage.getItem(LEGACY_META_KEY);
      const metas = data ? JSON.parse(data) : {};
      return metas[slug] || null;
    } catch {
      return null;
    }
  },

  removeFromHistory: (animeIdOrSlug: string) => {
    try {
      const history = historyUtil.getHistory();
      const target = (animeIdOrSlug || '').toLowerCase();
      const updated = history.filter(item => 
        (item.animeId || '').toLowerCase() !== target && 
        (item.slug || '').toLowerCase() !== target &&
        (item.episodeId || '').toLowerCase() !== target
      );
      localStorage.setItem(activeKey(HISTORY_KEY), JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('kinoma_progress_update', {
        detail: { removed: animeIdOrSlug }
      }));
    } catch (e) {
      console.error('Failed to remove from history', e);
    }
  },

  getAllEpisodesProgressMap: (): Record<string, Record<string, EpisodeProgress>> => {
    try {
      const raw = localStorage.getItem(activeKey(EPISODES_PROGRESS_KEY));
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  getAnimeEpisodesProgress: (animeIdOrSlug: string, fallbackSlug?: string): Record<string, EpisodeProgress> => {
    const allMap = historyUtil.getAllEpisodesProgressMap();
    const idKey = (animeIdOrSlug || '').toLowerCase();
    const fallbackKey = (fallbackSlug || '').toLowerCase();

    // Check exact key or match
    for (const key of Object.keys(allMap)) {
      const lKey = key.toLowerCase();
      if (lKey === idKey || (fallbackKey && lKey === fallbackKey)) {
        return allMap[key];
      }
    }
    return {};
  },

  getEpisodeProgress: (animeIdOrSlug: string, epNumOrId: string | number, fallbackSlug?: string): EpisodeProgress | null => {
    const epsMap = historyUtil.getAnimeEpisodesProgress(animeIdOrSlug, fallbackSlug);
    const key = String(epNumOrId);
    if (epsMap[key]) return epsMap[key];

    // Try finding by episodeNumber or episodeId match
    const found = Object.values(epsMap).find(ep => ep.episodeNumber === key || ep.episodeId === key);
    return found || null;
  },

  getAnimeProgress: (animeIdOrSlug: string, fallbackSlug?: string): HistoryItem | null => {
    try {
      const history = historyUtil.getHistory();
      const targetId = (animeIdOrSlug || '').toLowerCase();
      const targetFallback = (fallbackSlug || '').toLowerCase();

      return history.find(item => {
        const aId = (item.animeId || '').toLowerCase();
        const s = (item.slug || '').toLowerCase();
        const ep = (item.episodeId || '').toLowerCase();

        return (
          aId === targetId ||
          s === targetId ||
          (targetFallback && (aId === targetFallback || s === targetFallback)) ||
          ep.startsWith(targetId) ||
          (targetFallback && ep.startsWith(targetFallback))
        );
      }) || null;
    } catch {
      return null;
    }
  },

  getWatchedEpisodeNumbers: (animeIdOrSlug: string, fallbackSlug?: string): Set<number> => {
    const watched = new Set<number>();
    try {
      // 1. Check detailed episodes map
      const epsMap = historyUtil.getAnimeEpisodesProgress(animeIdOrSlug, fallbackSlug);
      Object.values(epsMap).forEach(ep => {
        if (ep.isCompleted || ep.completionPercentage >= 88) {
          const n = parseInt(ep.episodeNumber, 10);
          if (!isNaN(n)) watched.add(n);
        }
      });

      // 2. Also check anime main progress
      const progress = historyUtil.getAnimeProgress(animeIdOrSlug, fallbackSlug);
      if (progress && progress.episodeNumber) {
        const currNum = parseInt(progress.episodeNumber, 10);
        if (!isNaN(currNum) && currNum > 0) {
          // If current episode is completed, include it
          if (progress.isCompleted) {
            for (let i = 1; i <= currNum; i++) watched.add(i);
          } else {
            for (let i = 1; i < currNum; i++) watched.add(i);
          }
        }
      }
    } catch {}
    return watched;
  },

  saveProgress: (
    slug: string, 
    episodeId: string, 
    episodeNumber: string | number, 
    playbackTimestamp: number, 
    duration: number = 1440,
    extraMeta?: { 
      title?: string; 
      image?: string; 
      animeId?: string;
      seasonNumber?: number;
    }
  ) => {
    if (playbackTimestamp < 0) return;
    const dur = duration > 0 ? duration : 1440;
    const completionPercentage = Math.min(100, Math.max(0, (playbackTimestamp / dur) * 100));
    const isCompleted = completionPercentage >= 88;
    const epNumStr = String(episodeNumber);

    try {
      const history = historyUtil.getHistory();
      const meta = historyUtil.getMeta(slug) || extraMeta;
      
      const animeId = meta?.animeId || extraMeta?.animeId || slug.split('|')[0] || slug;
      const title = meta?.title || extraMeta?.title || slug;
      const image = meta?.image || extraMeta?.image || '';
      const seasonNumber = extraMeta?.seasonNumber ?? meta?.seasonNumber ?? parseSeasonNumber(title, 1);

      const now = Date.now();

      const newItem: HistoryItem = {
        animeId,
        slug,
        episodeId,
        episodeNumber: epNumStr,
        seasonNumber,
        title,
        image,
        playbackTimestamp: Math.floor(playbackTimestamp),
        duration: Math.floor(dur),
        completionPercentage: Number(completionPercentage.toFixed(1)),
        lastWatchedTime: now,
        isCompleted,
        progress: Math.floor(playbackTimestamp),
        timestamp: now
      };

      const existingIndex = history.findIndex(h => h.slug === slug || h.animeId === animeId);
      if (existingIndex >= 0) {
        history[existingIndex] = newItem;
      } else {
        history.push(newItem);
      }

      history.sort((a, b) => b.lastWatchedTime - a.lastWatchedTime);
      const limitedHistory = history.slice(0, 30);
      localStorage.setItem(activeKey(HISTORY_KEY), JSON.stringify(limitedHistory));

      // Also persist to detailed per-episode map
      const allMap = historyUtil.getAllEpisodesProgressMap();
      if (!allMap[animeId]) allMap[animeId] = {};
      allMap[animeId][epNumStr] = {
        animeId,
        slug,
        seasonNumber,
        episodeId,
        episodeNumber: epNumStr,
        playbackTimestamp: Math.floor(playbackTimestamp),
        duration: Math.floor(dur),
        completionPercentage: Number(completionPercentage.toFixed(1)),
        lastWatchedTime: now,
        isCompleted
      };
      // Also index by slug if different
      if (slug !== animeId) {
        if (!allMap[slug]) allMap[slug] = {};
        allMap[slug][epNumStr] = allMap[animeId][epNumStr];
      }
      localStorage.setItem(activeKey(EPISODES_PROGRESS_KEY), JSON.stringify(allMap));

      // Trigger dispatch event so all listening components update in real-time
      window.dispatchEvent(new CustomEvent('kinoma_progress_update', {
        detail: { animeId, slug, episodeNumber: epNumStr, playbackTimestamp, isCompleted }
      }));

      // Non-blocking sync to Firebase Firestore for logged-in users
      if (auth.currentUser) {
        const cleanId = animeId.replace(/[^a-zA-Z0-9_-]/g, '_');
        const profileId = getActiveProfileId(auth.currentUser.uid);
        const progressRef = profileId
          ? doc(db, 'users', auth.currentUser.uid, 'profiles', profileId, 'progress', cleanId)
          : doc(db, 'users', auth.currentUser.uid, 'progress', cleanId);
        setDoc(progressRef, {
          animeId,
          slug,
          title,
          image,
          episodeId,
          episodeNumber: Number(epNumStr) || 1,
          seasonNumber,
          playbackTimestamp: Math.floor(playbackTimestamp),
          duration: Math.floor(dur),
          completionPercentage: Number(completionPercentage.toFixed(1)),
          lastWatchedTime: now,
          isCompleted
        }, { merge: true }).catch(() => {});
      }
    } catch (e) {
      console.error('Failed to save progress', e);
    }
  },

  syncFromFirestore: async (userId: string) => {
    try {
      const profileId = getActiveProfileId(userId);
      const colRef = profileId
        ? collection(db, 'users', userId, 'profiles', profileId, 'progress')
        : collection(db, 'users', userId, 'progress');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        const history = historyUtil.getHistory();
        const allMap = historyUtil.getAllEpisodesProgressMap();

        snap.forEach(docSnap => {
          const data = docSnap.data();
          if (data && data.animeId) {
            const item: HistoryItem = {
              animeId: data.animeId,
              slug: data.slug || data.animeId,
              episodeId: data.episodeId || '',
              episodeNumber: String(data.episodeNumber || 1),
              seasonNumber: data.seasonNumber || 1,
              title: data.title || data.animeId,
              image: data.image || '',
              playbackTimestamp: data.playbackTimestamp || 0,
              duration: data.duration || 1440,
              completionPercentage: data.completionPercentage || 0,
              lastWatchedTime: data.lastWatchedTime || Date.now(),
              isCompleted: data.isCompleted || false,
              progress: data.playbackTimestamp || 0,
              timestamp: data.lastWatchedTime || Date.now()
            };

            const idx = history.findIndex(h => h.animeId === item.animeId || h.slug === item.slug);
            if (idx >= 0) {
              if (item.lastWatchedTime > history[idx].lastWatchedTime) {
                history[idx] = item;
              }
            } else {
              history.push(item);
            }

            if (!allMap[item.animeId]) allMap[item.animeId] = {};
            allMap[item.animeId][item.episodeNumber] = {
              animeId: item.animeId,
              slug: item.slug,
              seasonNumber: item.seasonNumber,
              episodeId: item.episodeId,
              episodeNumber: item.episodeNumber,
              playbackTimestamp: item.playbackTimestamp,
              duration: item.duration,
              completionPercentage: item.completionPercentage,
              lastWatchedTime: item.lastWatchedTime,
              isCompleted: item.isCompleted
            };
          }
        });

        history.sort((a, b) => b.lastWatchedTime - a.lastWatchedTime);
        localStorage.setItem(activeKey(HISTORY_KEY), JSON.stringify(history.slice(0, 30)));
        localStorage.setItem(activeKey(EPISODES_PROGRESS_KEY), JSON.stringify(allMap));
        window.dispatchEvent(new CustomEvent('kinoma_progress_update'));
      }
    } catch (e) {
      console.warn("Could not sync from Firestore:", e);
    }
  },

  calculateWatchCTA: (
    animeIdOrSlug: string,
    episodes: any[],
    animeTitle?: any,
    fallbackSlug?: string
  ): WatchCTAInfo => {
    const defaultSeason = parseSeasonNumber(animeTitle, 1);
    const firstEp = episodes && episodes.length > 0 ? episodes[0] : null;

    if (!episodes || episodes.length === 0) {
      return {
        type: 'watch_now',
        label: 'Watch Now',
        episode: null,
        seasonNumber: defaultSeason,
        playbackTimestamp: 0,
        formattedTimestamp: '0:00',
        completionPercentage: 0,
        isCompletedAnime: false
      };
    }

    const mainProgress = historyUtil.getAnimeProgress(animeIdOrSlug, fallbackSlug);
    const epsMap = historyUtil.getAnimeEpisodesProgress(animeIdOrSlug, fallbackSlug);
    const hasAnyProgress = Boolean(mainProgress || Object.keys(epsMap).length > 0);

    // 1. NEVER-WATCHED ANIME
    if (!hasAnyProgress) {
      return {
        type: 'watch_now',
        label: 'Watch Now',
        episode: firstEp,
        seasonNumber: defaultSeason,
        playbackTimestamp: 0,
        formattedTimestamp: '0:00',
        completionPercentage: 0,
        isCompletedAnime: false
      };
    }

    // 2. CHECK COMPLETED ANIME
    // Check if all episodes are completed or the final episode was finished
    const lastEp = episodes[episodes.length - 1];
    const lastEpProg = epsMap[lastEp.number] || epsMap[lastEp.id];
    const lastEpFinished = lastEpProg?.isCompleted || (
      mainProgress && 
      (mainProgress.episodeNumber === String(lastEp.number) || mainProgress.episodeId === lastEp.id) &&
      mainProgress.isCompleted
    );

    // Check if user watched all or finished the last episode
    const allWatched = episodes.every(ep => {
      const p = epsMap[ep.number] || epsMap[ep.id];
      return p && p.isCompleted;
    });

    if (allWatched || lastEpFinished) {
      return {
        type: 'watch_again',
        label: 'Watch Again',
        episode: firstEp,
        seasonNumber: defaultSeason,
        playbackTimestamp: 0,
        formattedTimestamp: '0:00',
        completionPercentage: 100,
        isCompletedAnime: true
      };
    }

    // 3. PARTIALLY WATCHED ANIME: Calculate the exact next episode & saved timestamp
    let targetEpisode = firstEp;
    let targetSeason = mainProgress?.seasonNumber || defaultSeason;
    let playbackTimestamp = 0;
    let completionPercentage = 0;

    if (mainProgress) {
      const currEpIndex = episodes.findIndex(
        (e: any) => e.number.toString() === mainProgress.episodeNumber || e.id === mainProgress.episodeId
      );

      if (currEpIndex !== -1) {
        const currEp = episodes[currEpIndex];
        // If current episode was completed (>= 88%), advance to next unwatched episode
        if (mainProgress.isCompleted) {
          if (currEpIndex + 1 < episodes.length) {
            targetEpisode = episodes[currEpIndex + 1];
            // Check if next episode already has partial progress
            const nextProg = epsMap[targetEpisode.number] || epsMap[targetEpisode.id];
            playbackTimestamp = nextProg ? nextProg.playbackTimestamp : 0;
            completionPercentage = nextProg ? nextProg.completionPercentage : 0;
            targetSeason = targetEpisode.season || (targetEpisode.number > 12 && episodes.length > 12 ? Math.ceil(targetEpisode.number / 12) : targetSeason);
          } else {
            // Last episode was completed!
            return {
              type: 'watch_again',
              label: 'Watch Again',
              episode: firstEp,
              seasonNumber: defaultSeason,
              playbackTimestamp: 0,
              formattedTimestamp: '0:00',
              completionPercentage: 100,
              isCompletedAnime: true
            };
          }
        } else {
          // In the middle of this episode! Resume from saved playback timestamp
          targetEpisode = currEp;
          playbackTimestamp = mainProgress.playbackTimestamp;
          completionPercentage = mainProgress.completionPercentage;
          targetSeason = currEp.season || targetSeason;
        }
      } else {
        // Episode object not in current chunk/list, use mainProgress data
        targetEpisode = {
          id: mainProgress.episodeId,
          number: mainProgress.episodeNumber,
          title: mainProgress.title,
          image: mainProgress.image
        };
        playbackTimestamp = mainProgress.playbackTimestamp;
        completionPercentage = mainProgress.completionPercentage;
      }
    } else {
      // Find first unwatched episode in epsMap
      const firstUnfinished = episodes.find(ep => {
        const p = epsMap[ep.number] || epsMap[ep.id];
        return !p || !p.isCompleted;
      });
      if (firstUnfinished) {
        targetEpisode = firstUnfinished;
        const p = epsMap[firstUnfinished.number] || epsMap[firstUnfinished.id];
        playbackTimestamp = p ? p.playbackTimestamp : 0;
        completionPercentage = p ? p.completionPercentage : 0;
      }
    }

    const formattedTimestamp = formatPlaybackTimestamp(playbackTimestamp);
    const epNum = targetEpisode?.number ?? (mainProgress?.episodeNumber || '1');
    const label = `Continue Watching · S${targetSeason} E${epNum} — ${formattedTimestamp}`;

    return {
      type: 'continue_watching',
      label,
      episode: targetEpisode,
      seasonNumber: targetSeason,
      playbackTimestamp,
      formattedTimestamp,
      completionPercentage,
      isCompletedAnime: false
    };
  },
  
  removeHistory: (slug: string) => {
    try {
      const history = historyUtil.getHistory();
      const filtered = history.filter(h => h.slug !== slug && h.animeId !== slug);
      localStorage.setItem(activeKey(HISTORY_KEY), JSON.stringify(filtered));

      const allMap = historyUtil.getAllEpisodesProgressMap();
      delete allMap[slug];
      localStorage.setItem(activeKey(EPISODES_PROGRESS_KEY), JSON.stringify(allMap));

      window.dispatchEvent(new CustomEvent('kinoma_progress_update', {
        detail: { slug, removed: true }
      }));
    } catch (e) {
      console.error('Failed to remove history', e);
    }
  },

  clearHistory: () => {
    try {
      localStorage.removeItem(activeKey(HISTORY_KEY));
      localStorage.removeItem(activeKey(EPISODES_PROGRESS_KEY));
      window.dispatchEvent(new CustomEvent('kinoma_progress_update', {
        detail: { cleared: true }
      }));
    } catch (e) {
      console.error('Failed to clear history', e);
    }
  }
};

