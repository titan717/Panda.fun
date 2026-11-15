# Clean trailers

Background trailers (TV hero, TV Details, TV row backdrops, phone Details) and the full-screen Trailers & More viewer. Rules from MASTER V4 §4.B and docs/DECISIONS.md D-141 to D-143. Code: `src/lib/trailerAutoplay.ts` (the manager), `src/lib/useTrailer.ts` (surface hook), `src/components/Trailer.tsx` (player and reveal), `src/lib/youtube.ts`, `src/lib/hooks.ts` (`useTrailerStage`, kept as a thin wrapper), `src/lib/audio.ts`.

## Trailer Autoplay Manager (v1.3.2)

One manager (`trailerManager` in `src/lib/trailerAutoplay.ts`) decides which background trailer may run on every surface: `tv-hero`, `tv-row`, `tv-details`, `m-hero` and `m-details`. Surfaces call `useSurfaceTrailer(surface, key, enabled)`, which reads the profile prefs (`trailerAutoplay`, `rowTrailers` for `tv-row`, `trailerDelay`, `reduceMotion`, `quality`) and returns the stage `idle → preload → play`.

- Request: a title becomes active (TV focus, desktop hover = focus, the active phone hero slide, the Details media at least 50 % visible). Preload starts `PRELOAD_LEAD_MS` (3 s) before play; play starts after `trailerDelay` seconds (default 5 s; 0 plays at once).
- Single active player: a new request cancels the previous one at once, so two trailer players never run together.
- Release: focus change, scrolling off screen (IntersectionObserver), unmount or leaving the page cancel the pending delay or stop the trailer and restore the artwork. Fast scrolling never starts a trailer because every focus change restarts the delay.
- Blocks: page hidden (`visibilitychange`), reduced motion (Settings switch, `html[data-motion=reduce]`, `prefers-reduced-motion`), data saver (Stream quality "Data Saver" 480, `navigator.connection.saveData`, 2G/3G `effectiveType`) and lite devices. When a block lifts while the title is still active, its delay starts over.
- Failure or end: a title whose trailer failed is not retried this session; a play-once trailer that ended waits for a new request. The artwork returns in both cases.
- Phone hero: always muted, starts only on the visible active slide after a 400 ms settle, and pauses the carousel auto-advance while it plays.
- Phone Details uses `trailerDelay` (previously a fixed 1200 ms).
- "Watch trailer" opens the full trailer in the viewer: TV Details `#det-trailer` (square button next to My List), phone Details `.m-det-watch-trailer` pill.
- `REVEAL_DELAY_MS` and `START_SECONDS` live in `trailerAutoplay.ts` and are re-exported from `Trailer.tsx`; the reveal rules below are unchanged.

## Timeline (TV focus trailer)

| Time | What happens |
|---|---|
| 0 s | Focus rests on a title. The backdrop shows. |
| 2 s | Preload: the sandboxed iframe and player are created, muted, invisible (`play=false`). |
| 5 s | Play (`trailerDelay`, per profile, default 5 s). `playVideo()` while still muted and at opacity 0. |
| PLAYING | Reveal timer starts. A pause or buffer before it ends restarts it. |
| PLAYING + 2 s | `REVEAL_DELAY_MS`: the frame fades in over 600 ms, the backdrop crossfades away (`onPlaying`), then the sound ramps in over 600 ms if the profile wants sound and the first remote press, key or tap has unlocked audio. |
| End − 1.6 s | Loop: seek to 0 without hiding (YouTube's end screen never shows). |

Focus moving away cancels the pending reveal and pauses, mutes and hides the trailer; only one trailer plays at a time (the manager's single request, plus `stopAllTrailers` in the player).

## Clean frame

- Host `www.youtube-nocookie.com/embed/{key}` with `enablejsapi=1, controls=0, disablekb=1, fs=0, iv_load_policy=3, cc_load_policy=0, rel=0, playsinline=1, autoplay=0, mute=1`, plus `start=1` for background trailers. `modestbranding` and `showinfo` are deprecated by YouTube and not sent ([YouTube player parameters](https://developers.google.com/youtube/player_parameters)).
- `sandbox="allow-scripts allow-same-origin"`, `allow="autoplay; encrypted-media"`, `tabindex=-1`, `aria-hidden`, `pointer-events: none`. No popups, top navigation, forms or new windows.
- The video is scaled to 110 % inside an `overflow: hidden` box with an inset black edge shadow, so the bottom-right logo and edge chrome stay out of view.
- CSP `frame-src` allows `youtube-nocookie.com` only; the Android WebView refuses any navigation to youtube.com (`AdShield.isYouTubeExit`).

## Failure handling

- Stall (not PLAYING for more than 700 ms while wanted, outside a loop seek): hide, call `playVideo()` once; after 3.5 s move to the next trailer key.
- Error, or the player resetting to unstarted/cued after it had played: next key; when every key failed the backdrop stays (`onFail`).
- Low-memory or data-saver devices get the slow backdrop zoom instead of video.

## Full-screen viewer

`VideoOverlay` uses the same frame with `revealDelayMs={0}`, `loop={false}` and no start offset: the viewer was opened on purpose, shows the whole frame and closes at the end or with Back.

## Tests (release-blocking)

- `src/test/trailerAutoplay.test.tsx` (fake timers): delay and preload lead, cancel on focus change, single active request, release, page hidden, reduced motion, data saver (pref, saveData, 2G/3G), failed titles not retried, ended trailers.

- `src/test/trailerReveal.test.tsx`: hidden and silent for the delay, then visible, `onPlaying`, sound ramp; no reveal after play=false, key change, another trailer starting or unmount; pause/buffer restarts the delay; visible through loops; error during the delay → next key → backdrop; viewer shows at once.
- `e2e/trailer-clean.spec.ts`: iframe host, parameters, sandbox and permissions; hidden until PLAYING + ≥1.9 s; stall hides; clicks, right-click and keys over the trailer open no window and never navigate; the TV focus trailer starts after 5 s; the viewer opens, plays and closes with Back.
