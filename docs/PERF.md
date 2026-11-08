# Performance log

Measured on every release. Never regress.

## v1.1.5

| Metric | Value |
|---|---|
| Skip markers | One small request per episode (`/panda/segments`, ~0.2 KB), fired after the title loads and never blocking playback; edge-cached 24 h when markers exist, 1 h otherwise; server cache 6 h. |
| Learned intros | Stored in localStorage (≤150 shows, ~40 bytes each), read once when the player opens. |
| Player chunk (gzip) | 11.2 KB, lazy-loaded with the player; entry chunk unchanged (33.5 KB). |
| Timers | The sleep timer ticks once a second only while armed; no timers run when it is off. |

## v1.1.4

| Metric | Value |
|---|---|
| Episode progress | Stored with the show's history entry (four numbers per episode, 200 episodes max), read synchronously from the store; episode rows render with no extra request. |
| Next-up | Pending new episodes are resolved when Continue Watching is computed (no timers, no polling). |
| First load (gzip JS) | Entry chunk +0.3 KB for the episode helpers. |

## v1.1.3

| Metric | Value |
|---|---|
| Lists | Stored with the profile in localStorage (titles slimmed to card fields, 12 lists × 200 titles max), so My Lists, Save to and quick actions need no network request. |
| Quick actions | The sheet is rendered only when opened; posters add one boolean of state and a `contextmenu` listener. |
| First load (gzip JS) | Entry chunk unchanged at 32.7 KB; list and quick-action code ride in the TV/mobile and Lists chunks. |

## v1.1.2

| Metric | Value |
|---|---|
| Details | Crew and vote count ride in the existing title payload. The collection is fetched on the server only for movies in a collection and cached for an hour, so a title page is still one request from the app. |
| Person page | One request (server cache 1 h, CDN 1 h); its code is a separate 1.5 KB (gzip) chunk, downloaded when the device is idle after start-up. |
| First load (gzip JS) | Unchanged entry chunk; Details chunks +0.5 KB. |

## v1.1.1

| Metric | Value |
|---|---|
| Search requests | Still one request per settled query (350 ms debounce). Phrase parsing and typo correction run on the server inside that request; genre chips and sorting are computed on the device from the results, so changing a filter makes no request. |
| Server | A corrected or interpreted query costs at most one extra TMDB call, cached with the search response (10 min). |
| First load (gzip JS) | Search chunk +0.6 KB. |

## v1.1.0

| Metric | Value |
|---|---|
| Personal rows | Up to five title-detail requests, started only after the Home page payload has arrived and served from the persistent SWR cache on later visits, so first paint is unchanged. Ranking is a single pass over at most ~100 titles (well under 1 ms). |
| Coming Soon | One extra rail inside the existing cached Home payload (server cache 15 min, upcoming list 1 h); no extra request from the app. |
| First load (gzip JS) | Index +0.8 KB for the ranking code. |

## v1.0.9

| Metric | Value |
|---|---|
| Repeat web visit | The service worker serves the app shell and hashed `/assets/*` from cache, so a repeat load on the web makes no JavaScript or CSS request; pages are network-first with a 3 s cut-off, so a new deploy still shows at once. |
| Artwork | TMDB posters and backdrops are cached on first view (CORS responses only, capped at 500 images; old hashed assets capped at 160). Revisited rows draw from the cache with no network wait and also work offline. |
| 4K TVs | Screens ≥ 2560 physical px wide step artwork up one TMDB size (w342→w500, w780→w1280). Phones and 1080p TVs keep the light sizes, so their bytes are unchanged. |
| Mobile Home | Rows from the fourth down use `content-visibility: auto` (230 px intrinsic height), so off-screen rows skip layout and paint until they come near the viewport. |
| First load (gzip JS) | Index 28.4 KB (+0.3 KB for reconnect recovery, the image tier and SW registration); CSS 20.1 KB. No regression. |

## v1.0.8

| Metric | Value |
|---|---|
| First load (gzip JS) | 57.0 KB on TV (index 28.2 + vendor 10.3 + runtime 9.7 + TV layout 8.9), +1.5 KB for the Kids gate, list tools and Next Episode. CSS 20.3 KB gzip. |
| Kids gate | Uses the same cached title request as Details, so it adds no network request; the player waits only on a Kids profile, and only until the cached details resolve. |
| My Space | Filtering and sorting are memoised in memory (no storage writes); removing an item writes once to the debounced store. |
| Mobile suite | 10 screens × 7 sizes (portrait and landscape phones, tablets) checked for sideways scroll, off-screen elements, text size and nav tap targets in 1.7 min. |

## v1.0.7

| Metric | Value |
|---|---|
| First load (gzip JS) | 55.5 KB on TV (index 27.2 + vendor 10.3 + runtime 9.7 + TV layout 8.3), +0.9 KB for the display preferences, voice bridge and remote-friendly search. Settings stays a separate 4.4 KB chunk loaded only when opened. |
| Text size | Absolute font sizes are wrapped in `calc(X * var(--fs, 1))` at build time (PostCSS), so changing text size is a single CSS variable write with no re-render; CSS grew 0.3 KB gzip. |
| Screen size | TV UI scale (90/95/100 %) is one transform on `#root`, so the rows keep their compositor layers. |
| Source health | Settings polls `/panda/sources/health` once a minute, only while the Sources section is open. |

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
