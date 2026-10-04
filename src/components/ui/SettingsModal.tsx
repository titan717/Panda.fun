import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Sparkles, 
  LayoutTemplate, 
  Monitor, 
  Play, 
  FastForward, 
  SkipForward, 
  Volume2, 
  Database, 
  Check, 
  Sliders,
  CheckCircle2,
  Trash2,
  Download,
  RefreshCw,
} from 'lucide-react';
import { useAppearance } from '../../lib/AppearanceContext';
import { usePWAInstall } from '../../lib/usePWAInstall';
import { historyUtil } from '../../lib/history';
import { libraryManager } from '../../lib/library';

export function SettingsModal() {
  const { 
    isSettingsModalOpen, 
    closeSettingsModal, 
    playerSettings,
    playbackPreferences,
    updatePlaybackPreference, 
    updatePlayerSetting,
    activeSettingsTab,
    setActiveSettingsTab
  } = useAppearance();

  const { isInstallable, isInstalled, install } = usePWAInstall();

  if (!isSettingsModalOpen) return null;

  const handleClearHistory = () => {
    if (window.confirm('Clear your entire watch history? This cannot be undone.')) {
      historyUtil.clearHistory();
    }
  };

  const handleClearLibrary = () => {
    if (window.confirm('Clear your Watchlist, Completed, and Favorites lists? This cannot be undone.')) {
      libraryManager.clearAll();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-xl bg-[#0f1015] border border-[#222230] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c1c28] bg-[#12131b]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#7b1fa2] to-[#ab47bc] flex items-center justify-center text-white shadow-md">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Kinoma Settings</h2>
              <p className="text-[11px] text-gray-400">Appearance style and playback preferences</p>
            </div>
          </div>

          <button
            onClick={closeSettingsModal}
            className="w-8 h-8 rounded-xl bg-[#1a1b24] hover:bg-[#252633] text-gray-400 hover:text-white flex items-center justify-center transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-[#1c1c28] bg-[#101118]">
          <button
            onClick={() => setActiveSettingsTab('appearance')}
            className={`flex items-center gap-2 pb-3 px-1 text-xs font-bold transition-colors relative ${
              activeSettingsTab === 'appearance' ? 'text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <LayoutTemplate className="w-3.5 h-3.5 text-[#c084fc]" />
            <span>Appearance / UI Style</span>
            {activeSettingsTab === 'appearance' && (
              <motion.div 
                layoutId="settingsTabIndicator" 
                className="absolute bottom-0 inset-x-0 h-0.5 bg-[#c084fc] rounded-full" 
              />
            )}
          </button>

          <button
            onClick={() => setActiveSettingsTab('player')}
            className={`flex items-center gap-2 pb-3 px-1 text-xs font-bold transition-colors relative ${
              activeSettingsTab === 'player' ? 'text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Play className="w-3.5 h-3.5 text-[#c084fc]" />
            <span>Player Preferences</span>
            {activeSettingsTab === 'player' && (
              <motion.div 
                layoutId="settingsTabIndicator" 
                className="absolute bottom-0 inset-x-0 h-0.5 bg-[#c084fc] rounded-full" 
              />
            )}
          </button>

          <button
            onClick={() => setActiveSettingsTab('library')}
            className={`flex items-center gap-2 pb-3 px-1 text-xs font-bold transition-colors relative ${
              activeSettingsTab === 'library' ? 'text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-[#c084fc]" />
            <span>Storage & Data</span>
            {activeSettingsTab === 'library' && (
              <motion.div 
                layoutId="settingsTabIndicator" 
                className="absolute bottom-0 inset-x-0 h-0.5 bg-[#c084fc] rounded-full" 
              />
            )}
          </button>

       </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-gray-300">
          
          {/* APPEARANCE TAB */}
          {activeSettingsTab === 'appearance' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Kinoma Interface</h3>
                <p className="text-xs text-gray-400">
                  Kinoma uses one unified interface across web and mobile.
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-[#3b2925] bg-[#171313]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#b84d41]/15 border border-[#b84d41]/25 flex items-center justify-center text-[#e8d0c0]">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Current interface</h4>
                    <p className="text-[11px] text-gray-400 mt-0.5">Kinoma unified experience</p>
                  </div>
                </div>
              </div>

            </div>
          )}
          {/* PLAYER PREFERENCES TAB */}
          {activeSettingsTab === 'player' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Streaming & Playback</h3>
                <p className="text-xs text-gray-400">
                  Configure your preferred defaults across all video playback screens.
                </p>
              </div>

              <div className="space-y-3">
                
                {/* Auto Play */}
                <div className="flex items-center justify-between p-3.5 bg-[#13141c] border border-[#222230] rounded-xl">
                  <div className="flex items-center gap-3">
                    <Play className="w-4 h-4 text-[#c084fc]" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Auto Play</h4>
                      <p className="text-[11px] text-gray-400">Start playing episode automatically upon loading</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updatePlayerSetting('autoPlay', !playerSettings.autoPlay)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      playerSettings.autoPlay ? 'bg-[#7b1fa2]' : 'bg-[#222230]'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        playerSettings.autoPlay ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Auto Next */}
                <div className="flex items-center justify-between p-3.5 bg-[#13141c] border border-[#222230] rounded-xl">
                  <div className="flex items-center gap-3">
                    <FastForward className="w-4 h-4 text-[#c084fc]" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Auto Next Episode</h4>
                      <p className="text-[11px] text-gray-400">Advance to the next episode when the current one finishes</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updatePlayerSetting('autoNext', !playerSettings.autoNext)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      playerSettings.autoNext ? 'bg-[#7b1fa2]' : 'bg-[#222230]'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        playerSettings.autoNext ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Skip Intro */}
                <div className="flex items-center justify-between p-3.5 bg-[#13141c] border border-[#222230] rounded-xl">
                  <div className="flex items-center gap-3">
                    <SkipForward className="w-4 h-4 text-[#c084fc]" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Skip Intro</h4>
                      <p className="text-[11px] text-gray-400">Prompt / fast-skip 85-second opening theme sequences</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updatePlayerSetting('skipIntro', !playerSettings.skipIntro)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      playerSettings.skipIntro ? 'bg-[#7b1fa2]' : 'bg-[#222230]'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        playerSettings.skipIntro ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Skip Outro */}
                <div className="flex items-center justify-between p-3.5 bg-[#13141c] border border-[#222230] rounded-xl">
                  <div className="flex items-center gap-3">
                    <SkipForward className="w-4 h-4 text-gray-400" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Skip Outro</h4>
                      <p className="text-[11px] text-gray-400">Skip ending credits to jump immediately to the next episode</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updatePlayerSetting('skipOutro', !playerSettings.skipOutro)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      playerSettings.skipOutro ? 'bg-[#7b1fa2]' : 'bg-[#222230]'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        playerSettings.skipOutro ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Default playback */}
                <div className="pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Default playback</h4>
                  <div className="space-y-2.5">
                    <label className="flex items-center justify-between gap-4 p-3.5 bg-[#13141c] border border-[#222230] rounded-xl">
                      <span className="flex items-center gap-3 min-w-0"><Server className="w-4 h-4 text-[#c084fc]" /><span><strong className="block text-xs text-white">Video provider</strong><small className="text-[11px] text-gray-400">Preferred stream server for new playback</small></span></span>
                      <select value={playbackPreferences.videoProvider} onChange={e => updatePlaybackPreference('videoProvider', e.target.value as any)} className="bg-[#1c1c28] border border-[#2b2b3b] text-white text-xs rounded-lg px-2.5 py-2 outline-none"><option value="nxsha">Multi HD</option><option value="cinesrc">CineSrc</option><option value="videasy">Videasy</option></select>
                    </label>
                    <label className="flex items-center justify-between gap-4 p-3.5 bg-[#13141c] border border-[#222230] rounded-xl">
                      <span className="flex items-center gap-3 min-w-0"><Volume2 className="w-4 h-4 text-[#c084fc]" /><span><strong className="block text-xs text-white">Audio language</strong><small className="text-[11px] text-gray-400">Preferred audio track when available</small></span></span>
                      <select value={playbackPreferences.audioLanguage} onChange={e => updatePlaybackPreference('audioLanguage', e.target.value as any)} className="bg-[#1c1c28] border border-[#2b2b3b] text-white text-xs rounded-lg px-2.5 py-2 outline-none"><option value="en">English</option><option value="ja">Japanese</option><option value="ko">Korean</option><option value="es">Spanish</option><option value="hi">Hindi</option><option value="auto">Auto / Original</option></select>
                    </label>
                    <label className="flex items-center justify-between gap-4 p-3.5 bg-[#13141c] border border-[#222230] rounded-xl">
                      <span className="flex items-center gap-3 min-w-0"><Captions className="w-4 h-4 text-[#c084fc]" /><span><strong className="block text-xs text-white">Subtitle language</strong><small className="text-[11px] text-gray-400">Preferred subtitle track when available</small></span></span>
                      <select value={playbackPreferences.subtitleLanguage} onChange={e => updatePlaybackPreference('subtitleLanguage', e.target.value as any)} className="bg-[#1c1c28] border border-[#2b2b3b] text-white text-xs rounded-lg px-2.5 py-2 outline-none"><option value="en">English</option><option value="hi">Hindi</option><option value="es">Spanish</option><option value="ja">Japanese</option><option value="ko">Korean</option><option value="auto">Auto</option><option value="off">Off</option></select>
                    </label>
                    <label className="flex items-center justify-between gap-4 p-3.5 bg-[#13141c] border border-[#222230] rounded-xl">
                      <span className="flex items-center gap-3 min-w-0"><Captions className="w-4 h-4 text-[#c084fc]" /><span><strong className="block text-xs text-white">Subtitle provider</strong><small className="text-[11px] text-gray-400">Provider used for subtitle preferences</small></span></span>
                      <select value={playbackPreferences.subtitleProvider} onChange={e => updatePlaybackPreference('subtitleProvider', e.target.value as any)} className="bg-[#1c1c28] border border-[#2b2b3b] text-white text-xs rounded-lg px-2.5 py-2 outline-none"><option value="nitro">Nitro</option><option value="auto">Auto</option></select>
                    </label>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* STORAGE & DATA TAB */}
          {activeSettingsTab === 'library' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Local State & Cache</h3>
                <p className="text-xs text-gray-400">
                  Manage cached stream URLs, stored progress records, and catalog lists.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 bg-[#13141c] border border-[#222230] rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">Watch History</h4>
                    <p className="text-[11px] text-gray-400">Reset your in-progress timestamps and continue watching list</p>
                  </div>
                  <button
                    onClick={handleClearHistory}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1c1618] hover:bg-red-950/50 text-red-400 border border-red-900/30 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                </div>

                <div className="p-3.5 bg-[#13141c] border border-[#222230] rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">My List & Bookmarks</h4>
                    <p className="text-[11px] text-gray-400">Clear saved watchlist, completed titles, and favorites</p>
                  </div>
                  <button
                    onClick={handleClearLibrary}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1c1618] hover:bg-red-950/50 text-red-400 border border-red-900/30 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#1c1c28] bg-[#12131b] flex items-center justify-between">
          <div className="text-[11px] text-gray-500">
            Current interface: <span className="text-[#e8d0c0] font-semibold">Unified</span>
          </div>
          <button
            onClick={closeSettingsModal}
            className="px-5 py-2 bg-gradient-to-r from-[#7b1fa2] to-[#9c27b0] hover:from-[#6a1b9a] hover:to-[#ab47bc] text-white text-xs font-bold rounded-xl shadow-[0_2px_12px_rgba(123,31,162,0.3)] transition-all"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}
