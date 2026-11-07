import { useEffect, useRef, useState } from "react";

/* Minimal typing for the YouTube IFrame API. */
interface YTPlayer {
  playVideo(): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  setVolume(v: number): void;
  getPlayerState(): number;
  destroy(): void;
}
interface YTNamespace {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer;
}
declare global {
  interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }
}

let apiPromise: Promise<YTNamespace> | null = null;
function loadApi(): Promise<YTNamespace> {
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

export interface TrailerProps {
  videoKey: string;
  muted?: boolean;
  className?: string;
  /** Fired once frames are actually playing (used to crossfade the backdrop away). */
  onPlaying?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

/**
 * Background trailer (BLUEPRINT_SPEC 5.9, 7.7, 14.2). Never focusable, no controls, destroyed on unmount
 * to keep TV memory flat. Tries sound first and falls back to muted when autoplay with sound is blocked.
 */
export function Trailer({ videoKey, muted = false, className, onPlaying, onEnd, onError }: TrailerProps) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const cb = useRef({ onPlaying, onEnd, onError });
  useEffect(() => { cb.current = { onPlaying, onEnd, onError }; });
  const playerRef = useRef<YTPlayer | null>(null);

  useEffect(() => {
    let cancelled = false;
    let player: YTPlayer | null = null;
    let check: ReturnType<typeof setTimeout> | null = null;
    setVisible(false);
    const mount = document.createElement("div");
    host.current?.appendChild(mount);
    loadApi().then((YT) => {
      if (cancelled) return;
      player = new YT.Player(mount, {
        host: "https://www.youtube-nocookie.com",
        videoId: videoKey,
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 1, controls: 0, mute: 1, playsinline: 1, rel: 0, modestbranding: 1, iv_load_policy: 3, disablekb: 1, fs: 0, cc_load_policy: 0, origin: window.location.origin },
        events: {
          onReady: () => {
            if (!player) return;
            player.playVideo();
            if (!muted) {
              player.unMute();
              player.setVolume(80);
              check = setTimeout(() => {
                if (player && player.getPlayerState() !== 1) { player.mute(); player.playVideo(); }
              }, 1500);
            }
          },
          onStateChange: (e: { data: number }) => {
            if (e.data === 1) { setVisible(true); cb.current.onPlaying?.(); }
            if (e.data === 0) { setVisible(false); cb.current.onEnd?.(); }
          },
          onError: () => { setVisible(false); cb.current.onError?.(); }
        }
      });
      playerRef.current = player;
      const iframe = host.current?.querySelector("iframe");
      if (iframe) {
        iframe.setAttribute("tabindex", "-1");
        iframe.setAttribute("aria-hidden", "true");
        iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
        iframe.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
      }
    }).catch(() => cb.current.onError?.());
    return () => {
      cancelled = true;
      if (check) clearTimeout(check);
      try { player?.destroy(); } catch { /* already gone */ }
      playerRef.current = null;
      mount.remove();
    };
  }, [videoKey, muted]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    try { if (muted) p.mute(); else p.unMute(); } catch { /* not ready */ }
  }, [muted]);

  return <div ref={host} className={`trailer ${visible ? "is-visible" : ""} ${className ?? ""}`} aria-hidden="true" />;
}

/** Choose the best trailer: official trailers first, then teasers, then any clip. */
export function pickTrailer(videos: { key: string; type: string; official: boolean }[] | undefined) {
  if (!videos?.length) return null;
  const rank = (v: { type: string; official: boolean }) => (v.type === "Trailer" ? 0 : v.type === "Teaser" ? 1 : 2) * 2 + (v.official ? 0 : 1);
  return [...videos].sort((a, b) => rank(a) - rank(b))[0]!.key;
}
