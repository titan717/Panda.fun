# Panda Intelligence — progress (v1.5.0)

Branch `feature/panda-intelligence`. Status of every part of the mission brief. "Done" means implemented, unit-tested and, where it has UI, checked end to end in desktop Chromium (phone 360 / 390, tablet 820, TV 1280 × 720 / 1920 × 1080 and desktop 1440 layouts, remote keys simulated). Nothing here was checked on a physical Android TV or phone.

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
| Home category feed | 109 categories (live audit, docs/eval/feed-audit.json), personal rails, rail variants, second pages, FeedEnd end / Retry, ranked per profile / page / day / part of day, category-level learning (impressions, opens, plays, hides), batches of 4 with prefetch, persisted cache, dedup against earlier rows, no rail under 6 titles, IntersectionObserver on phones, focus-driven on TV with stable focus | src/lib/feed/, TvHome.tsx, MHome.tsx |
| Why Panda picked this | a real shared feature, or the engine's reason, or none | learner.ts › explainTitle |
| Taste DNA + Entertainment Memory | "How your taste is changing", directors, actors, decades; view learned genres / languages / people / franchises / eras, More / Less overrides, forget a title, reset the model | src/pages/TasteDna.tsx (/taste-dna) |
| Mood discovery | 10 moods on Search, mood recognised in queries, real API grids | src/lib/intel/moods.ts, MoodChips.tsx |
| Session assistant | local clock only; time-of-day mood boost on Home, suggested moods first on Search | moods.ts › sessionMoods |
| Hidden Gems | 5 rails past the first Top Rated pages with a 7.0 floor | src/lib/feed/catalog.ts |
| Surprise Me | score²-weighted pick from the top 25 unopened titles; skips watched, hidden, forgotten, repeatedly ignored, unreleased; kids-safe; no recent repeats | src/lib/intel/surprise.ts |
| Smart Continue Watching | one entry per title, finished movies removed, next / new episodes first, stale tries and shows abandoned 90+ days sink | src/lib/store.ts › continueScore |
| Playback policy | Android TV CineSrc only; phones Vidy (Vidy Anime for anime) then CineSrc, no source picker; browser unchanged (already in v1.4.0, verified unchanged) | src/lib/playback/registry.ts |
| Training in a Web Worker | same deterministic trainer in a worker; small delta messages; generation-based stale-job invalidation on profile switch / delete / reset; worker creation and runtime failure fall back to idle-callback slices (old WebViews) | src/lib/intel/trainer.ts, worker.ts, docs/PERF.md |
| Idle details prefetch | ≤ 8 per run / 24 per session, 2 concurrent, cache first, never refetched, cancelled on profile change, off on Data Saver and ≤ 1 GB devices, after Home has rendered | src/lib/intel/prefetch.ts |
| Cast / crew rails | "Directed by", "Starring" from real /panda/person credits, only with 2+ titles of evidence | src/lib/feed/personal.ts |
| Franchise rail | TMDB collection parts sorted by release date, labelled "In release order" (no chronological claim) | personal.ts |
| Personal ordering outside Home | browse grids, Search best match, person pages, More Like This; evidence-scaled blend ≤ 0.6, filters untouched, pages frozen once shown | src/lib/intel/personalize.ts, useBrowse.ts, useSearchState.ts |
| Conversational discovery | on-device parser into real catalogue browses; no AI service, no key, nothing sent | src/lib/intel/intent.ts |
| Scenario evaluation | cold start, sparse, changing interests, negative feedback, hidden gems, multi-profile, repeat rate, latency (synthetic) | src/test/v150-scenarios.test.ts, docs/eval/intel-scenarios.json |
| Privacy | network audit (only catalogue GETs to allowlisted hosts in E2E), sync never carries model / feedback / taste, deleting a profile removes all its intelligence data | e2e/v150.spec.ts, src/test/v150-privacy.test.ts, runtime.ts › forgetProfile |

Tests: 68 unit test files, 524 tests (vitest, all passing); TypeScript and ESLint clean; production build OK; e2e/v150.spec.ts (6 specs) across 6 viewport projects plus the existing E2E suite.

## Not done / limitations

- Story (chronological) franchise order: no reliable data source; release order is shown and labelled.
- Playback health in Continue Watching is not tracked per title (failures are only excluded from learning).
- Real-world measurement of recommendation quality: nothing is collected; all figures are synthetic.
- Testing on physical Android TV and phone hardware has not been done.

## Next step

Merge PR #70 → #71 → #72 into main in order and build the signed v1.5.0 APK from main.
