import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthContext';

export type VideoProvider = 'nxsha' | 'cinesrc' | 'videasy';
export type PlaybackLanguage = 'en' | 'ja' | 'ko' | 'es' | 'hi' | 'auto' | 'off';
export type SubtitleProvider = 'nitro' | 'auto';

export interface PlaybackPreferences {
  videoProvider: VideoProvider;
  audioLanguage: PlaybackLanguage;
  subtitleLanguage: PlaybackLanguage;
  subtitleProvider: SubtitleProvider;
}

export interface PlayerSettings {
  autoPlay: boolean;
  autoNext: boolean;
  skipIntro: boolean;
  skipOutro: boolean;
  preferredAudio: 'sub' | 'dub';
}

export type SettingsTab = 'appearance' | 'player' | 'library';

interface AppearanceContextType {
  playerSettings: PlayerSettings;
  playbackPreferences: PlaybackPreferences;
  updatePlaybackPreference: <K extends keyof PlaybackPreferences>(key: K, value: PlaybackPreferences[K]) => void;
  updatePlayerSetting: <K extends keyof PlayerSettings>(key: K, value: PlayerSettings[K]) => void;
  isSettingsModalOpen: boolean;
  openSettingsModal: (tab?: SettingsTab) => void;
  closeSettingsModal: () => void;
  activeSettingsTab: SettingsTab;
  setActiveSettingsTab: (tab: SettingsTab) => void;
}

export const DEFAULT_PLAYBACK_PREFERENCES: PlaybackPreferences = {
  videoProvider: 'nxsha',
  audioLanguage: 'en',
  subtitleLanguage: 'en',
  subtitleProvider: 'nitro',
};

const PLAYBACK_PREFERENCES_KEY = 'panda_playback_preferences';

const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  autoPlay: true,
  autoNext: true,
  skipIntro: true,
  skipOutro: false,
  preferredAudio: 'sub',
};

const PLAYER_SETTINGS_KEY = 'panda_player_settings';
const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [playbackPreferences, setPlaybackPreferences] = useState<PlaybackPreferences>(() => {
    try {
      if (typeof window === 'undefined') return DEFAULT_PLAYBACK_PREFERENCES;
      const stored = window.localStorage.getItem(PLAYBACK_PREFERENCES_KEY);
      if (stored) return { ...DEFAULT_PLAYBACK_PREFERENCES, ...JSON.parse(stored) };
    } catch {}
    return DEFAULT_PLAYBACK_PREFERENCES;
  });

  const [playerSettings, setPlayerSettings] = useState<PlayerSettings>(() => {
    try {
      if (typeof window === 'undefined') return DEFAULT_PLAYER_SETTINGS;
      const stored = window.localStorage.getItem(PLAYER_SETTINGS_KEY);
      if (stored) return { ...DEFAULT_PLAYER_SETTINGS, ...JSON.parse(stored) };
    } catch {}
    return DEFAULT_PLAYER_SETTINGS;
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (cancelled) return;
      const data = snap.data() || {};
      const remote = data.playbackPreferences as Partial<PlaybackPreferences> | undefined;
      if (remote && typeof remote === 'object') {
        const merged = { ...DEFAULT_PLAYBACK_PREFERENCES, ...remote } as PlaybackPreferences;
        const validProvider = ['nxsha', 'cinesrc', 'videasy'].includes(merged.videoProvider);
        const validLanguage = (value: string) => ['en', 'ja', 'ko', 'es', 'hi', 'auto', 'off'].includes(value);
        if (validProvider && validLanguage(merged.audioLanguage) && validLanguage(merged.subtitleLanguage) && ['nitro', 'auto'].includes(merged.subtitleProvider)) {
          setPlaybackPreferences(merged);
          try { window.localStorage.setItem(PLAYBACK_PREFERENCES_KEY, JSON.stringify(merged)); } catch {}
        }
      }

      const remotePlayer = data.playerSettings as Partial<PlayerSettings> | undefined;
      if (remotePlayer && typeof remotePlayer === 'object') {
        const merged = { ...DEFAULT_PLAYER_SETTINGS, ...remotePlayer } as PlayerSettings;
        if (
          typeof merged.autoPlay === 'boolean' &&
          typeof merged.autoNext === 'boolean' &&
          typeof merged.skipIntro === 'boolean' &&
          typeof merged.skipOutro === 'boolean' &&
          ['sub', 'dub'].includes(merged.preferredAudio)
        ) {
          setPlayerSettings(merged);
          try { window.localStorage.setItem(PLAYER_SETTINGS_KEY, JSON.stringify(merged)); } catch {}
        }
      }
    }).catch(error => console.error('Failed to load playback preferences:', error));
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    const handleOnboarding = (event: Event) => {
      const detail = (event as CustomEvent<Partial<PlayerSettings>>).detail;
      if (!detail) return;
      setPlayerSettings(current => {
        const updated = {
          ...current,
          ...(typeof detail.autoPlay === 'boolean' ? { autoPlay: detail.autoPlay } : {}),
          ...(typeof detail.autoNext === 'boolean' ? { autoNext: detail.autoNext } : {}),
          ...(typeof detail.skipIntro === 'boolean' ? { skipIntro: detail.skipIntro } : {}),
          ...(typeof detail.skipOutro === 'boolean' ? { skipOutro: detail.skipOutro } : {}),
        };
        try { window.localStorage.setItem(PLAYER_SETTINGS_KEY, JSON.stringify(updated)); } catch {}
        return updated;
      });
    };
    window.addEventListener('panda_onboarding_complete', handleOnboarding);
    return () => window.removeEventListener('panda_onboarding_complete', handleOnboarding);
  }, []);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('player');

  const updatePlaybackPreference = useCallback(<K extends keyof PlaybackPreferences>(key: K, value: PlaybackPreferences[K]) => {
    setPlaybackPreferences(prev => {
      const updated = { ...prev, [key]: value };
      try {
        window.localStorage.setItem(PLAYBACK_PREFERENCES_KEY, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('panda_playback_preferences_change', { detail: updated }));
      } catch {}
      if (user) {
        setDoc(doc(db, 'users', user.uid), { playbackPreferences: updated }, { merge: true })
          .catch(error => console.error('Failed to save playback preferences:', error));
      }
      return updated;
    });
  }, [user]);

  const updatePlayerSetting = useCallback(<K extends keyof PlayerSettings>(key: K, value: PlayerSettings[K]) => {
    setPlayerSettings(prev => {
      const updated = { ...prev, [key]: value };
      try {
        window.localStorage.setItem(PLAYER_SETTINGS_KEY, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('panda_player_settings_change', { detail: updated }));
      } catch {}
      if (user) {
        setDoc(doc(db, 'users', user.uid), { playerSettings: updated }, { merge: true })
          .catch(error => console.error('Failed to sync player settings:', error));
      }
      return updated;
    });
  }, [user]);

  const openSettingsModal = useCallback((tab: SettingsTab = 'player') => {
    setActiveSettingsTab(tab);
    setIsSettingsModalOpen(true);
  }, []);

  const closeSettingsModal = useCallback(() => setIsSettingsModalOpen(false), []);

  return (
    <AppearanceContext.Provider value={{
      playerSettings, playbackPreferences, updatePlaybackPreference, updatePlayerSetting, isSettingsModalOpen, openSettingsModal,
      closeSettingsModal, activeSettingsTab, setActiveSettingsTab
    }}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('useAppearance must be used within an AppearanceProvider');
  return context;
}
