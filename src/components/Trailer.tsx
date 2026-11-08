import { useEffect, useRef, useState } from "react";
import { isAudioUnlocked, onAudioUnlock, registerTrailer, stopAllTrailers } from "../lib/audio";

/* Minimal typing for the YouTube IFrame API. */
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  setVolume(v: number): void;
  getPlayerState(): number;
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(s: number, allowSeekAhead: boolean): void;
  getIframe?(): HTMLIFrameElement;
  destroy(): void;
}
interface YTNamespace {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer;
}
declare global {
  interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }
}

let apiPromise: Promise<YTNamespace> | null = null;
/** Loads the IFrame API once; safe to call early to warm it up. */
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); if (window.YT) resolve(window.YT); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => { apiPromise = null; reject(new Error("YouTube unavailable")); };
    document.head.appendChild(s);
  });
  return apiPromise;
}

const PLAYING = 1, ENDED = 0;
/** Seconds before the end at which the trailer jumps back to the start, so YouTube's end screen never shows. */
const LOOP_GUARD_S = 1.6;
const FADE_MS = 600;

export interface TrailerProps {
  /** Ranked trailer keys; on an embed error the next one is tried. */
  keys: string[];
  /** false = preload (player created and buffering, invisible, silent); true = play and fade in. */
  play: boolean;
  /** Sound wanted (profile preference and not muted). Applied only after audio is unlocked. */
  sound: boolean;
  /** 0..1 */
  volume: number;
  className?: string;
  /** Background trailers loop; the full-screen viewer plays once and calls onEnd. */
  loop?: boolean;
  onEnd?: () => void;
  /** Fired once frames are actually playing (used to crossfade the backdrop away). */
  onPlaying?: () => void;
  /** Every key failed: caller keeps the backdrop. */
  onFail?: () => void;
}

/**
 * Background trailer (MASTER §4.B). No controls, no keyboard, no related videos or annotations,
 * never focusable. Loops before the end, fades its volume in, and stops the moment it unmounts or
 * another trailer starts. The iframe is scaled slightly inside an overflow-hidden box to keep the
 * leftover player chrome out of view without covering YouTube branding further.
 */
export function Trailer({ keys, play, sound, volume, className, loop: loops = true, onPlaying, onFail, onEnd }: TrailerProps) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [keyIndex, setKeyIndex] = useState(0);
  const cb = useRef({ onPlaying, onFail, onEnd, loops });
  useEffect(() => { cb.current = { onPlaying, onFail, onEnd, loops }; });
  const live = useRef({ play, sound, volume });
  useEffect(() => { live.current = { play, sound, volume }; });
  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  const startRef = useRef<(() => void) | null>(null);
  const soundRef = useRef<(() => void) | null>(null);
  const videoKey = keys[keyIndex];

  // create the player for the current key
  useEffect(() => {
    if (!videoKey) { cb.current.onFail?.(); return; }
    let cancelled = false;
    let player: YTPlayer | null = null;
    let loop: ReturnType<typeof setInterval> | null = null;
    let fade: ReturnType<typeof setInterval> | null = null;
    readyRef.current = false;
    setVisible(false);
    const mount = document.createElement("div");
    host.current?.appendChild(mount);

    const stop = () => { try { player?.pauseVideo(); player?.mute(); } catch { /* gone */ } setVisible(false); };
    const unregister = registerTrailer(stop);

    loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      player = new YT.Player(mount, {
        host: "https://www.youtube-nocookie.com",
        videoId: videoKey,
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 0, controls: 0, mute: 1, playsinline: 1, rel: 0, modestbranding: 1, iv_load_policy: 3, disablekb: 1, fs: 0, cc_load_policy: 0, showinfo: 0, origin: window.location.origin, enablejsapi: 1 },
        events: {
          onReady: () => {
            if (!player || cancelled) return;
            readyRef.current = true;
            const iframe = player.getIframe?.() ?? host.current?.querySelector("iframe");
            if (iframe) {
              iframe.setAttribute("tabindex", "-1");
              iframe.setAttribute("aria-hidden", "true");
              iframe.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
            }
            if (live.current.play) start();
          },
          onStateChange: (e: { data: number }) => {
            if (e.data === PLAYING && live.current.play) { setVisible(true); cb.current.onPlaying?.(); }
            if (e.data === ENDED) {
              if (!cb.current.loops) { setVisible(false); cb.current.onEnd?.(); return; }
              try { player?.seekTo(0, true); player?.playVideo(); } catch { /* gone */ }
            }
          },
          onError: () => {
            if (cancelled) return;
            setVisible(false);
            setKeyIndex((i) => i + 1);
          }
        }
      });
      playerRef.current = player;
    }).catch(() => { if (!cancelled) cb.current.onFail?.(); });

    function rampTo(target: number) {
      if (fade) clearInterval(fade);
      let v = 0;
      const steps = 12;
      fade = setInterval(() => {
        v += target / steps;
        try { player?.setVolume(Math.round(Math.min(target, v))); } catch { /* gone */ }
        if (v >= target && fade) { clearInterval(fade); fade = null; }
      }, FADE_MS / steps);
    }
    function applySound() {
      if (!player || !readyRef.current) return;
      const { sound: want, volume: vol } = live.current;
      try {
        if (want && isAudioUnlocked()) { player.setVolume(0); player.unMute(); rampTo(Math.round(vol * 100)); }
        else player.mute();
      } catch { /* not ready */ }
    }
    function start() {
      if (!player) return;
      stopAllTrailers(stop);
      try { player.playVideo(); } catch { return; }
      applySound();
      // if sound blocked the start, retry silently
      setTimeout(() => { try { if (player && player.getPlayerState() !== PLAYING && !cancelled) { player.mute(); player.playVideo(); } } catch { /* gone */ } }, 1500);
      if (!loop && cb.current.loops) loop = setInterval(() => {
        try {
          const d = player!.getDuration(), t = player!.getCurrentTime();
          if (d > 0 && t > d - LOOP_GUARD_S) player!.seekTo(0, true);
        } catch { /* gone */ }
      }, 400);
    }
    startRef.current = start;
    soundRef.current = applySound;
    const offUnlock = onAudioUnlock(applySound);

    return () => {
      cancelled = true;
      unregister(); offUnlock();
      if (loop) clearInterval(loop);
      if (fade) clearInterval(fade);
      try { player?.destroy(); } catch { /* already gone */ }
      playerRef.current = null;
      readyRef.current = false;
      startRef.current = null; soundRef.current = null;
      mount.remove();
    };
  }, [videoKey]);

  // preload → play
  useEffect(() => { if (play && readyRef.current) startRef.current?.(); }, [play]);
  // live mute / volume changes
  useEffect(() => { soundRef.current?.(); }, [sound, volume]);

  return <div ref={host} className={`trailer ${visible && play ? "is-visible" : ""} ${className ?? ""}`} aria-hidden="true" />;
}

/** Ranked trailer keys: official trailers first, then teasers, then other clips. */
export function rankTrailers(videos: { key: string; type: string; official: boolean }[] | undefined, max = 3): string[] {
  if (!videos?.length) return [];
  const rank = (v: { type: string; official: boolean }) => (v.type === "Trailer" ? 0 : v.type === "Teaser" ? 1 : 2) * 2 + (v.official ? 0 : 1);
  return [...videos].sort((a, b) => rank(a) - rank(b)).slice(0, max).map((v) => v.key);
}

/** Best single trailer key (used for the explicit "Trailer" buttons). */
export function pickTrailer(videos: { key: string; type: string; official: boolean }[] | undefined) {
  return rankTrailers(videos, 1)[0] ?? null;
}
