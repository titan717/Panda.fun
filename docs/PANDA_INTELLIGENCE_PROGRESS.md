# Panda Intelligence — progress (v1.5.0)

Branch `feature/panda-intelligence`. Status of every part of the mission brief. "Done" means implemented, unit-tested and, where it has UI, checked end to end in desktop Chromium (TV 1920 × 1080 and phone 390 × 844 layouts, remote keys simulated). Nothing here was checked on a physical Android TV or phone.

## Done

| Area | What | Where |
|---|---|---|
| ML runtime decision | ONNX Runtime Web, TF.js and LiteRT evaluated; plain TypeScript online learning chosen (reasons in RECOMMENDATIONS.md) | docs/RECOMMENDATIONS.md |
| Content features | hashed sparse vectors: genres, genre pairs, language, decade, rating band, type, directors / creators, cast, franchise | src/lib/intel/features.ts |
| Taste model | short-term (10-day half-life) and long-term (1-year) taste vectors | src/lib/intel/learner.ts |
| Ranking model | online logistic regression (AdaGrad), dense parts regularised toward the v1.4.0 weights, sparse per-feature weights, sampled negatives; same-director / creator, franchise, language and novelty signals | learner.ts, runtime.ts |
| Safeguards | playback failures, short samples, pauses, accidental exits are never negative; finished episodes are positive | src/lib/intel/events.ts |
| Storage | IndexedDB per profile, schema versioning and migration, corruption recovery (rebuild from local data), reset, pruning of deleted profiles; never uploaded | src/lib/intel/store.ts |
| Evaluation | precision / recall / NDCG / hit rate @10, diversity, novelty, coverage on 60 synthetic users (not real-world accuracy) | src/test/v150-eval.test.ts, docs/eval/intel-eval.json |
| Home category feed | 89 categories, ranked per profile / page / day / part of day, category-level learning (impressions, opens, plays, hides), batches of 4 with prefetch, persisted cache, dedup against earlier rows, no rail under 6 titles, IntersectionObserver on phones, focus-driven on TV with stable focus | src/lib/feed/, TvHome.tsx, MHome.tsx |
| Why Panda picked this | a real shared feature, or the engine's reason, or none | learner.ts › explainTitle |
| Taste DNA + Entertainment Memory | view learned genres / languages / people / franchises / eras, More / Less overrides, forget a title, reset the model | src/pages/TasteDna.tsx (/taste-dna) |
| Mood discovery | 10 moods on Search, mood recognised in queries, real API grids | src/lib/intel/moods.ts, MoodChips.tsx |
| Session assistant | local clock only; time-of-day mood boost on Home, suggested moods first on Search | moods.ts › sessionMoods |
| Hidden Gems | 5 rails past the first Top Rated pages with a 7.0 floor | src/lib/feed/catalog.ts |
| Surprise Me | random pick from the model's top 25 unopened titles | src/lib/intel/surprise.ts |
| Smart Continue Watching | recency nudged by likelihood of resuming | src/lib/store.ts › continueScore |
| Playback policy | Android TV CineSrc only; phones Vidy (Vidy Anime for anime) then CineSrc, no source picker; browser unchanged (already in v1.4.0, verified unchanged) | src/lib/playback/registry.ts |
| Natural-language search | already provided by the Panda API from the query text ("korean thriller", "funny malayalam movies from the 90s"); no history is sent | /panda/search |

Tests: 56 unit test files, 446 tests (vitest) and e2e/v150.spec.ts (3 specs × 5 viewports).

## Planned (not done)

- Training in a Web Worker. Today it runs in short `requestIdleCallback` slices on the main thread.
- Fetching details in idle time for top candidates (today details are learned when a title page is opened), and a cast / crew recommendation row.
- Franchise story (chronological) order. Collections are shown in release order with the next unwatched part highlighted; there is no reliable chronological data source yet.
- Optional conversational assistant (would need consent and a model; not started).
- Per-page re-ranking of mood / browse grids by the model.
- Real-world measurement of recommendation quality (needs consented, on-device aggregate metrics; nothing is collected today).
- Testing on physical Android TV and phone hardware.
