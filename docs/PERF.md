# Performance log

Measured on every release. Never regress.

## v1.0.6

| Metric | Value |
|---|---|
| First load (gzip JS) | 54.6 KB on TV (index 26.6 + vendor 10.3 + runtime 9.7 + TV layout 8.0). The +0.7 KB covers image warm-up and the update-dot check; still −58 % against v1.0.4. |
| Page backdrop swap | The new backdrop is decoded about 100 ms after a D-pad move (measured on four moves, local preview, 1920×1080). Neighbouring backdrops (±1, +2) are warmed 200 ms after focus rests. |
| Rows | Posters of the focused row and the two rows below (up to 30 images) are fetched when the main thread is idle, so cards are ready before focus reaches them. |
| Cached images | Fixed a bug where an image served from cache fired `load` before the reset effect ran and stayed at opacity 0. Images now track their state per URL. |

## v1.0.5

| Metric | Value |
|---|---|
| First load (gzip JS) | **53.9 KB** on TV (index 26.6 + vendor 10.3 + runtime 9.7 + TV layout 7.5) and 53.7 KB on mobile, down from 131.0 KB in v1.0.4 (−59 %). |
| How | The TV and mobile layouts are separate chunks and a device downloads only its own. Player, Settings, Updates, Info and What's New are lazy-loaded and prefetched when idle. The Preact compat runtime replaces react-dom (D-37). |
| First paint | Inline boot splash in `index.html` paints before any JS: FCP 116 ms and the splash is visible 160 ms after navigation (local preview, 1920×1080). On Android the window background is the same gradient, so the screen never flashes from dark to blue. |
| Profile → Home | Home visible 760 ms after pressing a profile (849 ms in v1.0.3). |
| CSS | 18.6 KB gzip (unchanged). |

## v1.0.4

| Metric | Value |
|---|---|
| Player chrome | All overlays are compositor-only (opacity/transform); the track fill uses `scaleX` so time updates (4/s) never trigger layout. The panels and Watch Next mount only while open. |
| Seek | Left/Right accumulate a pending seek and send one `seek` command after 900 ms of no input or on OK, so holding a key doesn't flood the embed. |
| Resume / switch | Source switch and quality change reload the embed at the current position (`t`/`progress`) with `continueprompt=false`, so there's no extra resume dialog. |
| Bundle (gzip) | JS 131.0 KB (index 116.6 + vendor 13.0 + react 1.4), CSS 18.6 KB. +4.2 KB JS for the new TV player; route splitting is scheduled for v1.0.5 to bring the first load well below v1.0.2. |

## v1.0.3

| Metric | Value |
|---|---|
| Profile → Home | Home card visible 849 ms after pressing a profile (zoom 560 ms; Home rows, hero details and the YouTube API are prefetched during the zoom). |
| Poster wall | 14 columns TV / 6 mobile (10 / 5 on low-memory or data-saver devices), w185 posters (~12 KB each), transform-only CSS animation, `contain: strict`. |
| Trailers | Player created 3 s before the trailer is due (preload), muted until audio is unlocked; one trailer at a time, torn down instantly on focus change. Low-memory devices skip trailers and get a slow backdrop zoom. |
| Bundle (gzip) | JS 126.8 KB (index 112.3 + vendor 13.0 + react 1.4), CSS 16.6 KB. +2.8 KB JS for the trailer engine, wall and Trailers settings; route splitting (v1.0.5) brings this back down. |

## v1.0.2

| Metric | Value |
|---|---|
| Backend | `/panda/sources/health`: CineSrc 315 ms, Vidy 64 ms (2026-11-08). |
| Warm start | Cached rows hydrate from IndexedDB before first render (300 ms budget), so Home paints without a network wait. |
| API | `apikinoma.vercel.app` home payload ~190 KB, ~0.3 s server time. In-flight requests are deduplicated; retries use jittered backoff. |
| Source start | CineSrc playing after ~2.5 s, Vidy after ~1.4–2.5 s (see PLAYER_COMPARISON). |
| Bundle (gzip) | JS 124 KB (index 109.7 + vendor 13.0 + react 1.4), CSS 16.2 KB, HTML 0.8 KB. Single route chunk — route splitting is scheduled for perf round 1 (v1.0.5). |
