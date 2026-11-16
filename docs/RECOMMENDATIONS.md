# Recommendations

> v1.5.0 adds **Panda Intelligence**, an on-device, per-profile learned ranker, on top of the v1.4.0 engine described further down. The v1.4.0 engine is unchanged and is still the first stage.

## Panda Intelligence (v1.5.0)

Code: `src/lib/intel/` (pure modules) and `src/lib/feed/` (Home category feed). Tests: `src/test/v150-*.test.ts`.

### Runtime choice

We evaluated ONNX Runtime Web, TensorFlow.js and LiteRT (TFLite) for in-browser inference. All three are built for running a pre-trained network; none of them helps with what Panda needs, which is **training a small model per profile on the device** from a few hundred interactions. They would add 0.5 to 6 MB of WASM / JS to an app that must start fast on low-memory Android TV boxes, and a pre-trained network would need a server-side training pipeline over users' viewing data, which the privacy rules forbid. Panda Intelligence is therefore plain TypeScript: hashed sparse features, two decayed taste vectors and an online logistic regression (AdaGrad). It has no dependencies, trains in a Web Worker (idle-callback fallback), and its whole state is a few hundred kilobytes per profile. The architecture was kept in v1.5.0: no neural model was added, because nothing measurable would justify the runtime cost on low-memory TV boxes (see Evaluation).

### Model

1. **Content features** (`features.ts`): each title becomes a hashed sparse vector of genres and genre pairs, language, decade, rating band, type, and when details are known, directors / creators, top cast and franchise (TMDB collection). Details are added when the profile opens a title page, and in idle time for the strongest candidates (`prefetch.ts`: at most 8 per run, 24 per session, 2 at a time, cache first, cancelled on profile change, off on Data Saver and ≤ 1 GB devices).
2. **Taste model** (`learner.ts`): a short-term taste vector (half-life 10 days) and a long-term one (half-life 1 year), in the same space, updated by every weighted interaction.
3. **Personal ranking model**: an online logistic regression over the v1.4.0 engine's seven score parts, short / long taste similarity, franchise affinity and novelty (dense), plus the sparse content vector (a weight per director, language, genre pair…). Dense weights start at the hand-tuned v1.4.0 weights and are L2-regularised toward them, so a new profile ranks exactly like v1.4.0 and moves away only as far as its own behaviour justifies.
4. **Re-ranking** (`runtime.ts › rerank`): the engine's candidates are re-scored by the model, then diversified by the v1.4.0 maximal-marginal-relevance pass (shared genres, type and seed); novelty is a model feature.

### Signals and safeguards (`events.ts`)

Finished, binge (several episodes within a day), rewatch, Love / Like, My List and More like this are positive; Not for me, Not interested, Hide and leaving early without coming back are negative; opens and plays are weak positives; a title shown three or more times and never opened is a very weak negative. **Never negative**: playback failures, a short sample, pausing, an accidental exit, and finishing an episode (a finished episode is a positive for the show). Titles that repeatedly fail to play are kept out of rows by the playback-health list instead (`useHiddenRecoIds`).

### Storage and privacy (`store.ts`)

IndexedDB database `panda-intel`, one record per profile (profiles never read each other's record), versioned with migrations; a corrupt record is deleted and rebuilt from the profile's local history, ratings, lists and feedback. Nothing is uploaded. Settings › Profiles › **Taste DNA & Entertainment Memory** shows what was learned, lets you steer it (More / Less), forget single titles, or reset the model. Reset personalization also resets it.

Training runs in a Web Worker (`trainer.ts` / `worker.ts`) with the same deterministic code; jobs carry only new interactions and unseen features, results carry only changed weights, and a generation number drops stale results after a profile switch, delete, Reset or Forget. Without Worker support, or if the worker fails, training falls back to short `requestIdleCallback` slices (benchmarks in docs/PERF.md). Deleting a profile removes its model, feedback events, on-device metrics and onboarding answers (`runtime.ts › forgetProfile`). The optional encrypted sync (Settings › Sync, off unless linked) carries history, lists and ratings but never the model, feedback, metrics or taste vectors (`src/test/v150-privacy.test.ts`).

### Home category feed (`src/lib/feed/`)

**109 categories** after the v1.5.0 audit (`src/test/feed-audit.test.ts`, opt-in `FEED_AUDIT=1`, results in `docs/eval/feed-audit.json`): every category was fetched from the live API and checked for usable titles, rating and overlap with the others. The audit fixed the "Malayalam Hidden Gems" rail (it was always empty: regional rating-sorted lists are only a few titles long, so regional gems now use popularity pages with a 7.0 floor) and moved the mood rails to page 2 (page 1 was identical to the genre rails). 20 rails were added only where the catalogue returns enough distinct titles: sci-fi mysteries, mystery thrillers, horror mysteries, crime comedies, romantic comedies, family / animated adventures (kids), Korean crime and mystery series, acclaimed Malayalam drama, thriller / sci-fi / Tamil / docuseries gems, and the best of French, Japanese, Spanish, Italian, Korean and Hindi cinema. Not added, because the API has no reliable data for them: "one-season shows", "brilliant endings", keyword-based themes (psychological, heist) and chronological franchise order. Four rails still overlap by 60 % in pairs (animation / family movies, scary / edge-of-your-seat moods); the feed's de-duplication removes repeats when both appear.

**Personal rails** (`personal.ts`), built only from the profile's own evidence and labelled with it: Directed by X (a director behind 2+ titles the profile finished or loved), Starring X (2+ titles), a franchise rail **in release order** (TMDB collection parts sorted by release date and labelled "In release order"; story-chronological order is not claimed because no reliable source exists), New Interest (a genre whose short-term taste has clearly overtaken the long-term one), Something Different (acclaimed titles in a genre the profile rarely watches) and Picked for You. They are interleaved every third rail, and person / collection rails use the real `/panda/person` and `/panda/collection` data (crew filtered by role, never inferred).

The category order is computed once per profile, page, day and part of day:

score = prior + onboarding genre match + learned genre / language affinity + preferred language + category engagement (opens, plays, completions ÷ impressions, smoothed) − hides + a small per-day exploration jitter + a time-of-day mood boost, followed by a greedy diversity pass (no genre or language repeated within three rails near the top). Personal and popular rails are mixed, so Home is never purely popularity-based.

**Titles inside a rail** are ordered by blending the model's prediction with the catalogue order; the blend grows with evidence (0 for a new profile, at most 0.6), so it is a re-ranking, not a re-sort. Each rail can fetch a second page (up to 24 titles), and rails are drawn in different shapes by kind (featured, landscape, compact, editorial, hidden-gem, numbered franchise) for visual variety.

Rails load in batches as you scroll (IntersectionObserver on phones, focus position on TV), never all at once, through the persisted SWR cache; titles already shown higher up are removed, and a rail with fewer than six titles left is skipped. When the catalogue has nothing more, Home ends with the Panda mascot and "You're all caught up"; if every request of a batch fails it shows "Couldn't load more rows" with Retry (`FeedEnd.tsx`). It never shows an endless spinner. TV keeps D-pad focus on the current card while rails are appended.

### Personal ordering outside Home (`personalize.ts`)

Browse grids (genres, moods, hidden gems, language and trending lists), Search "Best match", a person's titles and More Like This use the same evidence-scaled blend. Only the order changes: filters, kids rules and the catalogue's results are never altered. With enough learning the browse default becomes **For you** and **Popular** stays the pure catalogue order; Newest and Top Rated are exact. Search keeps the API's top three results and every title-prefix match first. Paged grids are personalised page by page and frozen once shown, so loading more or the model learning in the background never reshuffles what is on screen (no TV focus jumps). Franchise collections keep release order. Ordering runs on the device; nothing about the profile is sent.

### Discovery features

- **Moods** (`moods.ts`): ten moods map to OR-joined TMDB genres; Search shows them before you type and recognises them in a query ("something scary"). Results always come from the API.
- **Conversational discovery** (`intent.ts`, on the device, no AI service or API key): a typed request is read with a fixed vocabulary into a real catalogue browse — genre words, languages ("korean", "malayalam"), movies / shows, tone ("darker", "lighter"), "underrated" / "hidden gems", "new", "like X" (only a title this profile has watched, saved or seen in rows; never invented) and "something different from what I usually watch" (the profile's least-explored mainstream genre, excluding ones it asked for Less of). Words it does not understand are reported, not guessed, and the normal text search still runs. Decades are left to the text search because the discover API has no year filter.
- **Smart Watch Session Assistant**: reads only the local clock (no location, no permissions) and boosts the moods that fit the moment on Home and lists them first on Search.
- **Hidden Gems**: well-rated titles past the first pages, with a 7.0 rating floor, after removing anything shown higher up.
- **Surprise Me** (`surprise.ts`): from the 25 model-ranked titles seen in rows and never opened, watched, hidden or forgotten, skipping titles scrolled past 4+ times, unreleased titles and (for kids) anything outside Animation / Family; a small novelty lift for genres outside recent finishes; picked with probability ∝ score² (not uniform, not always the top one) and not repeating the last 8 picks.
- **Smart Continue Watching** (`store.ts › continueScore`): one entry per title, finished movies removed, new and next episodes first, movies past halfway lifted; a brief try weeks ago and a show left on "next episode" for 90+ days sink below active ones (never removed).
- **Why Panda picked this** (`learner.ts › explainTitle`): only real evidence — a director, creator, actor, language or franchise shared with titles the profile chose ("Next in X" only if this part was released after the one watched, otherwise "Also in X"), or "You've enjoyed N thriller titles lately" when 3+ were finished or loved in the last 45 days. Otherwise no explanation.
- **Taste DNA** (`TasteDna.tsx`): genres, languages, directors and creators, actors, franchises and decades with More / Less corrections, "How your taste is changing" (rising and fading interests from the short- vs long-term taste vectors), and Entertainment Memory (forget a title, reset).

### Evaluation (synthetic, not real-world accuracy)

`src/test/v150-eval.test.ts` builds 60 synthetic users over a captured snapshot of 683 catalogue titles, with five taste kinds (genre, language, auteur, franchise, mixed), hides part of each user's positives and ranks the rest. Results are written to `docs/eval/intel-eval.json`. **These numbers only compare methods on identical synthetic data; they are not real-world recommendation accuracy, and no real-world accuracy has been measured.**

| k = 10 | Precision | Recall | NDCG | Hit rate | Diversity | Novelty | Coverage |
|---|---|---|---|---|---|---|---|
| Popularity | 0.003 | 0.007 | 0.005 | 0.033 | 0.79 | 0 | 0.016 |
| v1.4.0 engine | 0.100 | 0.200 | 0.188 | 0.667 | 0.624 | 0.873 | 0.249 |
| Intelligence, list data only | 0.138 | 0.277 | 0.277 | 0.750 | 0.442 | 0.953 | 0.416 |
| Intelligence with details | 0.175 | 0.350 | 0.335 | 0.867 | 0.513 | 0.950 | 0.348 |

NDCG by taste kind (engine → list only → with details): genre 0.124 → 0.271 → 0.262; language 0.248 → 0.378 → 0.470; auteur 0.160 → 0.216 → 0.216; franchise 0.241 → 0.333 → 0.430; mixed 0.165 → 0.187 → 0.298. The learned ranker trades some intra-list diversity for relevance; the diversity pass recovers part of it.

**Scenario suite** (`src/test/v150-scenarios.test.ts`, 12 synthetic users per scenario, `docs/eval/intel-scenarios.json`; same caveat — synthetic, not real-world accuracy):

| Scenario | v1.4.0 engine | With the on-device model |
|---|---|---|
| Cold start (no history) | — | identical top 10 to the engine (no invented personalisation) |
| Sparse (2 titles): share of top 10 in the user's genre | 0.708 | 0.892 |
| Repeat rate (already-watched titles in top 10) | — | 0 |
| Changing interests: share of recent genre / old genre in top 10 | 0.192 / 0.392 | 0.592 / 0.342 |
| Changing interests: NDCG@10 on the recent genre | 0.068 | 0.459 |
| Negative feedback: disliked genre in top 10 | 0 | 0 |
| Hidden gems: NDCG@10 / novelty | 0.732 / 0.842 | 0.930 / 0.950 |
| Multi-profile isolation | — | a second profile's learning never changes the first one's ranking |
| Rerank latency (Node, ~600 candidates incl. engine) | — | median 51 ms, p90 61 ms |

Latency is a desktop Node figure; on a low-end TV box expect several times more, which is why ranking runs once per screen and training runs in the worker.


---

## The v1.4.0 engine

Search, before you type, is Panda's discovery page. Its first row is **Panda Top Picks**, followed by Recommended for you, Trending now, Popular now, Because you watched…, Hidden gems, genre discovery and Recently added. All of it is computed **on the device** from the active profile's own data. Nothing is sent to a server and there is no AI or ML API. The engine is a transparent, hand-weighted content-based ranker with diversity re-ranking. **It is not machine learning**, and the app never calls it "AI".

Code: `src/lib/reco/` (pure modules, unit-tested in `src/test/v140-reco.test.ts`). UI: `src/tv/TvDiscover.tsx`, `src/mobile/MDiscover.tsx`, hook `useRecommendations.ts`.

### Pipeline

1. **Preference model** (`model.ts`, `buildModel`). Inputs, all per profile:
   - onboarding answers (`src/lib/tasteProfile.ts`): genres, movies/shows/both, popular/hidden gems/mix, new/classic/mix;
   - watch history (finished vs started), ratings (Love / Like / Not for me), Watchlist and custom lists;
   - explicit feedback (`feedback.ts`, `localStorage["panda:v1:recofeedback"]`): More like this, Not interested, Hide, Already watched, plus opens and plays as weak signals.

   | Signal | Genre weight |
   |---|---|
   | Genre picked in onboarding | +1.0 × 1 / (1 + signals / 12) (fades as real behaviour accumulates) |
   | Finished title | +1.0 per genre |
   | Started title | +0.5 |
   | Love / Like / Not for me | +1.6 / +0.9 / −1.6 |
   | Saved (Watchlist or list) | +0.5 |
   | More like this / Not interested | +1.2 / −0.8 |
   | Already watched / open / play | +0.4 / +0.15 / +0.3 |

   Affinities are normalised to [−1, 1]. Genres are canonicalised first (`genres.ts`: TMDB's TV genres such as "Sci-Fi & Fantasy" or "Action & Adventure" split into their movie equivalents) so movie and show signals reinforce each other. Up to 6 **seeds** (finished, loved, saved or "more like this" titles) drive similar-title candidates.

2. **Candidate generation** (`engine.ts`, `generateCandidates`): "More Like This" of up to 4 seeds (from the title payload), today's and this week's trending lists, the Home rails, two genre lists from `/panda/discover` for the profile's top genres (or Comedy and Thriller for a new profile) and the newest rails.

3. **Filtering** (`filterReason`): finished, disliked, hidden, "not interested" and "already watched" titles; titles in progress (they belong in Continue Watching); saved titles (they are already in My List); unreleased titles; titles without artwork; titles that failed on every player for this platform and are currently suppressed (see `PLAYBACK_HEALTH.md`); and, for Kids profiles, anything not kids-safe.

4. **Scoring** (`scoreCandidate`): weighted sum of seven explainable parts.

   | Part | Weight | Meaning |
   |---|---|---|
   | genre | 1.0 | 0.6 × best genre affinity + 0.4 × mean affinity |
   | similar | 1.3 | Appears in a seed's More Like This (rank-discounted, seed-weighted) |
   | type | 0.5 | Movie / show preference |
   | quality | 0.45 | TMDB rating around 6.5 |
   | popularity | 0.35 | Trending rank; positive for "popular", negative for "hidden gems", mildly positive for "mix" |
   | freshness | 0.3 | Release year against the new / classic answer |
   | language | 0.25 | Share of watched titles in the same original language |

5. **Diversity** (`mmr`): maximal marginal relevance, λ = 0.72 for Top Picks (0.6 for Recommended), with similarity from shared genres, same type and same seed. This stops one franchise or genre filling the row.

6. **Sections** (`sections.ts`): Panda Top Picks (12 titles) appears **only when the profile told Panda something** (onboarding answers or behaviour). Otherwise it would just be "Popular" under another name, and the page starts at Trending. A row needs at least 6 titles, and titles shown in an earlier row's first 8 are not repeated.

### Honest explanations

`explain()` gives a reason only when one component really drove the score (contribution > 0.12) and has a checkable cause: "Because you watched Dark", "You picked Thriller", "You rate Comedy highly", "Trending now", "Rated 8.4", "New in 2026". When nothing stands out, **no reason is shown**. The UI never makes up text like "Because you'll love it".

### Feedback controls

Hold OK on TV (or press Menu, or right-click on a computer), or press and hold / tap ⋮ on a phone: **More like this**, **Not interested**, **Hide from recommendations**, **Already watched** and **Undo my last choice for this title**. Changes apply immediately because the hook subscribes to the feedback store. Settings › Personalise resets the taste profile, and clearing recommendation feedback is part of that reset.

### Offline evaluation

Method (`src/test/v140-reco.test.ts`, the "evaluation" block): a snapshot of the real Home rails (`src/test/fixtures/reco-catalog.json`, `GET https://apikinoma.vercel.app/api/v1/panda/page/home` on 2026-11-15) is the catalogue. Five synthetic profiles each prefer a genre family. Relevance = the title carries one of the profile's genres. Baselines: popularity order (cold start) and v1.3's `personal.ts` Top Picks (with history). Metrics are in `evaluate.ts`: P@10, nDCG@10, intra-list diversity (ILD, 1 − mean pairwise genre Jaccard), genre coverage and novelty.

| Profile | Cold start P@10 engine / popularity | With history P@10 engine / v1.3 | ILD engine / v1.3 |
|---|---|---|---|
| Horror & thriller | 0.90 / 0.40 | 0.70 / 0.40 | 0.67 / 0.78 |
| Animation | 1.00 / 0.00 | 0.90 / 0.40 | 0.56 / 0.72 |
| Romance & comedy | 1.00 / 0.10 | 0.40 / 0.00 | 0.73 / 0.81 |
| Crime | 1.00 / 0.10 | 0.50 / 0.40 | 0.76 / 0.80 |
| Sci-fi | 0.90 / 0.30 | 0.90 / 0.50 | 0.57 / 0.75 |

Caveats, honestly:
- These are **synthetic** profiles on one catalogue snapshot, with genre-match relevance. They show that the engine follows stated and observed taste much better than the baselines. They do not show that real viewers will watch more. No live A/B test was run.
- Precision rises and **diversity (ILD) falls** compared with v1.3, because v1.3's list was mostly popular titles across all genres. MMR limits the drop. λ is the knob if Top Picks feels too narrow.
- The weights in the two tables above are **hand-set** from the intent of each signal and checked against this offline evaluation. They were not learned from viewing data, because Panda has none: there is no analytics backend and no real-user CTR, completion or retention numbers exist for v1.4.0.
- The genre-match relevance above is partly circular (the engine scores genres, and relevance is defined by genre). The **leave-one-out** test below avoids that by asking for one exact hidden title instead.
- The catalogue is whatever the backend returns (Home rails, trending, discover, More Like This). The engine cannot recommend what those lists never contain.

#### Leave-one-out hit rate

Each synthetic profile watched five titles of its genre family. Each title in turn is hidden from the model, the other four are the history, and the test checks whether the hidden title itself is in the top 10 (HR@10). Results on the same snapshot (`v140-reco.test.ts`, "leave-one-out"):

| Profile | Engine | v1.3 Top Picks | Popularity |
|---|---|---|---|
| Horror & thriller | 4/5 | 2/5 | 3/5 |
| Animation | 2/5 | 0/5 | 0/5 |
| Romance & comedy | 1/5 | 1/5 | 1/5 |
| Crime | 5/5 | 3/5 | 1/5 |
| Sci-fi | 5/5 | 3/5 | 2/5 |
| **Total** | **17/25** | **9/25** | **7/25** |

This is still synthetic: the histories are built from one genre family and the More Like This lists in the test are a deterministic stand-in, so it shows the ranking works as designed, not that viewers will watch more.

### On-device metrics

`metrics.ts` keeps a small per-profile log on the device (`localStorage["panda:v1:recometrics"]`, at most 400 titles per list):

- **Impression**: a recommended card was at least 60 % on screen in a row (IntersectionObserver), once per title per row.
- **Open**: the viewer opened a recommended title from a row.
- **Watch start / completion**: read from the profile's own watch history, credited only if it happened after the open (more than 60 s watched, or marked finished).

The diagnostics panel shows, per row and in total: shown, opened, CTR, started, start rate, completed and completion rate. "Reset personalization" in Settings clears it with the rest of the profile's taste data. Nothing is uploaded, so these numbers describe one device. They are there to sanity-check tuning on real use, not to support claims about all viewers.

### Developer diagnostics

Dev builds, or `localStorage.setItem("panda:recodebug", "1")` on any build, show a collapsed "Recommendation diagnostics" panel under the rows. It lists the on-device funnel above, the model (genre affinities and their origin, seeds, type, era) and the top 25 scored candidates with every score part and the chosen reason. It is hidden from viewers by default.
