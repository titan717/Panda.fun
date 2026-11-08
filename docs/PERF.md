# Performance log

Measured on every release. Never regress.

## v1.0.2

| Metric | Value |
|---|---|
| Backend | `/panda/sources/health`: CineSrc 315 ms, Vidy 64 ms (2026-11-08). |
| Warm start | Cached rows hydrate from IndexedDB before first render (300 ms budget), so Home paints without a network wait. |
| API | `apikinoma.vercel.app` home payload ~190 KB, ~0.3 s server time. In-flight requests are deduplicated; retries use jittered backoff. |
| Source start | CineSrc playing after ~2.5 s, Vidy after ~1.4–2.5 s (see PLAYER_COMPARISON). |
| Bundle (gzip) | JS 124 KB (index 109.7 + vendor 13.0 + react 1.4), CSS 16.2 KB, HTML 0.8 KB. Single route chunk — route splitting is scheduled for perf round 1 (v1.0.5). |
