import { useEffect, useRef, useState } from "react";
import { isAudioUnlocked, onAudioUnlock, registerTrailer, stopAllTrailers } from "../lib/audio";

import { loadYouTubeApi, type YTPlayer } from "../lib/youtube";

export { loadYouTubeApi };

const PLAYING = 1, ENDED = 0, PAUSED = 2, BUFFERING = 3;
/** Seconds before the end at which the trailer jumps back to the start, so YouTube's end screen never shows. */
const LOOP_GUARD_S = 1.6;
/** Volume ramp after the reveal (the opacity fade is `--dur-trailer-fade`, also 600 ms). */
const FADE_MS = 600;
/**
 * A trailer stays invisible and silent until it has been PLAYING this long: YouTube paints its title,
 * channel avatar and logo overlay over the first moments of an embed, and they are gone by then.
 */
export const REVEAL_DELAY_MS = 2000;
/** Background trailers start this far in, so the hidden overlay time is not spent on the first frames. */
export const START_SECONDS = 1;
/** After a loop seek the player buffers briefly; the stall watchdog ignores that window so the frame stays visible. */
const LOOP_GRACE_MS = 2500;
/** Not playing for longer than this while wanted: hide, nudge playVideo, then move to the next trailer. */
const STALL_MS = 700;
const GIVE_UP_MS = 3500;

/** Hardened embed parameters (docs/TRAILERS.md). modestbranding/showinfo are deprecated and not sent. */
export function trailerEmbedUrl(key: string, origin: string, startSeconds = 0) {
  const q = new URLSearchParams({
    enablejsapi: "1", origin, controls: "0", disablekb: "1", fs: "0", iv_load_policy: "3", cc_load_policy: "0",
    rel: "0", playsinline: "1", autoplay: "0", mute: "1"
  });
  if (startSeconds > 0) q.set("start", String(Math.round(startSeconds)));
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(key)}?${q.toString()}`;
}

/** The only sandbox and permissions a trailer frame gets: no popups, top navigation, forms or new windows. */
export const TRAILER_SANDBOX = "allow-scripts allow-same-origin";
export const TRAILER_ALLOW = "autoplay; encrypted-media";

function trailerFrame(key: string, startSeconds: number) {
  const f = document.createElement("iframe");
  f.src = trailerEmbedUrl(key, window.location.origin, startSeconds);
  f.setAttribute("sandbox", TRAILER_SANDBOX);
  f.setAttribute("allow", TRAILER_ALLOW);
  f.setAttribute("tabindex", "-1");
  f.setAttribute("aria-hidden", "true");
  f.setAttribute("title", "");
  f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  f.setAttribute("frameborder", "0");
  f.className = "trailer-frame";
  return f;
}

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
  /** How long the frame must be PLAYING before it is shown and unmuted (default REVEAL_DELAY_MS). */
  revealDelayMs?: number;
  onEnd?: () => void;
  /** Fired once the frame has been revealed (used to crossfade the backdrop away). */
  onPlaying?: () => void;
  /** Every key failed: caller keeps the backdrop. */
  onFail?: () => void;
}

/**
 * Clean background trailer (MASTER V4 §4.B, docs/TRAILERS.md). Panda builds the sandboxed
 * youtube-nocookie iframe itself and binds the IFrame API to it, so the sandbox holds from the very
 * first load. The frame never takes pointer, keyboard or focus. When it starts PLAYING it stays at
 * opacity 0 and volume 0 for REVEAL_DELAY_MS (YouTube's title and logo overlay are gone by then),
 * then fades in, reports onPlaying and ramps the sound in. It hides and recovers on a stall, loops
 * before the end screen without hiding, and moves to the next trailer (then the backdrop) on any
 * error or unexpected state. A pending reveal is cancelled on unmount, key change, play=false and
 * when another trailer starts, and a reveal only applies to the player generation that scheduled it.
 */
export function Trailer({ keys, play, sound, volume, className, loop: loops = true, revealDelayMs = REVEAL_DELAY_MS, onPlaying, onFail, onEnd }: TrailerProps) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [keyIndex, setKeyIndex] = useState(0);
  const cb = useRef({ onPlaying, onFail, onEnd, loops, revealDelayMs });
  useEffect(() => { cb.current = { onPlaying, onFail, onEnd, loops, revealDelayMs }; });
  const live = useRef({ play, sound, volume });
  useEffect(() => { live.current = { play, sound, volume }; });
  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  const startRef = useRef<(() => void) | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const soundRef = useRef<(() => void) | null>(null);
  const videoKey = keys[keyIndex];
  const keySig = keys.join(",");
  const hasKeys = keys.length > 0;
  useEffect(() => { setKeyIndex(0); }, [keySig]);

  // create the player for the current key
  useEffect(() => {
    if (!videoKey) { if (hasKeys) cb.current.onFail?.(); return; }
    let cancelled = false;
    let player: YTPlayer | null = null;
    let loop: ReturnType<typeof setInterval> | null = null;
    let fade: ReturnType<typeof setInterval> | null = null;
    let watch: ReturnType<typeof setInterval> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let reveal: ReturnType<typeof setTimeout> | null = null;
    /** Bumped whenever a pending reveal must not apply any more (hide, stop, stall, next key). */
    let gen = 0;
    let shown = false, notPlayingSince = 0, loopedAt = 0, nudged = false, announced = false, everPlayed = false;
    readyRef.current = false;
    setVisible(false);
    const frame = trailerFrame(videoKey, cb.current.loops ? START_SECONDS : 0);
    host.current?.appendChild(frame);

    const cancelReveal = () => { gen++; if (reveal) { clearTimeout(reveal); reveal = null; } };
    const silence = () => {
      if (fade) { clearInterval(fade); fade = null; }
      try { player?.setVolume(0); player?.mute(); } catch { /* not ready */ }
    };
    const hide = () => { cancelReveal(); shown = false; silence(); setVisible(false); };
    const stop = () => { hide(); try { player?.pauseVideo(); } catch { /* gone */ } };
    const unregister = registerTrailer(stop);
    const next = () => { if (cancelled) return; hide(); setKeyIndex((i) => i + 1); };
    const isPlaying = () => { try { return player?.getPlayerState() === PLAYING; } catch { return false; } };

    /** Show the frame once it has been PLAYING for the reveal delay; stale timers never apply. */
    function scheduleReveal() {
      if (shown || reveal || cancelled || !live.current.play) return;
      const g = gen;
      reveal = setTimeout(() => {
        reveal = null;
        if (cancelled || g !== gen || !live.current.play || !isPlaying()) return;
        shown = true;
        setVisible(true);
        if (!announced) { announced = true; cb.current.onPlaying?.(); }
        applySound();
      }, Math.max(0, cb.current.revealDelayMs));
    }

    loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      player = new YT.Player(frame as unknown as HTMLElement, {
        events: {
          onReady: () => {
            if (!player || cancelled) return;
            readyRef.current = true;
            silence();
            if (live.current.play) start();
          },
          onStateChange: (e: { data: number }) => {
            if (cancelled) return;
            if (e.data === PLAYING) {
              everPlayed = true; notPlayingSince = 0; nudged = false;
              if (!shown) scheduleReveal();
              return;
            }
            if (e.data === ENDED) {
              if (!cb.current.loops) { hide(); cb.current.onEnd?.(); return; }
              // loop without hiding: the frame stays on screen through the seek
              loopedAt = performance.now();
              try { player?.seekTo(0, true); player?.playVideo(); } catch { /* gone */ }
              return;
            }
            if (e.data === PAUSED || e.data === BUFFERING) {
              if (!notPlayingSince) notPlayingSince = performance.now();
              // a pause or buffer during the reveal delay restarts it: only a steady start is shown
              if (!shown) cancelReveal();
              return;
            }
            // unstarted (-1) or cued (5) after it had played = YouTube swapped the video or reset: next trailer
            if (everPlayed && live.current.play) next();
          },
          onError: () => next()
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
    /** Sound only while revealed; before that the player stays muted at volume 0. */
    function applySound() {
      if (!player || !readyRef.current) return;
      if (!shown) { silence(); return; }
      const { sound: want, volume: vol } = live.current;
      try {
        if (want && isAudioUnlocked()) {
          if (player.isMuted()) { player.setVolume(0); player.unMute(); rampTo(Math.round(vol * 100)); }
          else if (!fade) player.setVolume(Math.round(vol * 100));
        } else silence();
      } catch { /* not ready */ }
    }
    function start() {
      if (!player || cancelled) return;
      stopAllTrailers(stop);
      try { player.playVideo(); } catch { return; }
      applySound();
      // already playing (resumed after play=false) → no state change will fire, so schedule here
      if (isPlaying()) scheduleReveal();
      // if the start was blocked, retry once (still muted)
      if (retry) clearTimeout(retry);
      retry = setTimeout(() => { retry = null; if (!cancelled && live.current.play && !isPlaying()) { try { player?.mute(); player?.playVideo(); } catch { /* gone */ } } }, 1500);
      if (!loop && cb.current.loops) loop = setInterval(() => {
        try {
          const d = player!.getDuration(), t = player!.getCurrentTime();
          if (d > 0 && t > d - LOOP_GUARD_S) { loopedAt = performance.now(); player!.seekTo(0, true); }
        } catch { /* gone */ }
      }, 400);
      // stall watchdog: never leave a paused, buffering or stuck frame on screen (a loop seek is not a stall)
      if (!watch) watch = setInterval(() => {
        if (cancelled || !live.current.play || !player) return;
        if (isPlaying()) return;
        const now = performance.now();
        if (loopedAt && now - loopedAt < LOOP_GRACE_MS) return;
        if (!notPlayingSince) notPlayingSince = now;
        const idle = now - notPlayingSince;
        if (idle > STALL_MS) {
          if (shown || reveal) hide();
          if (!nudged) { nudged = true; try { player.playVideo(); } catch { /* gone */ } }
        }
        if (idle > GIVE_UP_MS && everPlayed) next();
      }, 250);
    }
    startRef.current = start;
    stopRef.current = stop;
    soundRef.current = applySound;
    const offUnlock = onAudioUnlock(applySound);

    return () => {
      cancelled = true;
      cancelReveal();
      unregister(); offUnlock();
      if (loop) clearInterval(loop);
      if (fade) clearInterval(fade);
      if (watch) clearInterval(watch);
      if (retry) clearTimeout(retry);
      try { player?.destroy(); } catch { /* already gone */ }
      playerRef.current = null;
      readyRef.current = false;
      startRef.current = null; stopRef.current = null; soundRef.current = null;
      frame.remove();
    };
  }, [videoKey, hasKeys]);

  // preload → play; leaving play cancels a pending reveal, pauses, silences and hides at once
  useEffect(() => {
    if (play && readyRef.current) startRef.current?.();
    if (!play) { stopRef.current?.(); setVisible(false); }
  }, [play]);
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
