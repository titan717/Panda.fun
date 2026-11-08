# Performance log

Measured on every release. Never regress.

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
