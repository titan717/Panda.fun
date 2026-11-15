# Recommendations

> v1.5.0 adds **Panda Intelligence**, an on-device, per-profile learned ranker, on top of the v1.4.0 engine described further down. The v1.4.0 engine is unchanged and is still the first stage.

## Panda Intelligence (v1.5.0)

Code: `src/lib/intel/` (pure modules) and `src/lib/feed/` (Home category feed). Tests: `src/test/v150-*.test.ts`.

### Runtime choice

We evaluated ONNX Runtime Web, TensorFlow.js and LiteRT (TFLite) for in-browser inference. All three are built for running a pre-trained network; none of them helps with what Panda needs, which is **training a small model per profile on the device** from a few hundred interactions. They would add 0.5 to 6 MB of WASM / JS to an app that must start fast on low-memory Android TV boxes, and a pre-trained network would need a server-side training pipeline over users' viewing data, which the privacy rules forbid. Panda Intelligence is therefore plain TypeScript: hashed sparse features, two decayed taste vectors and an online logistic regression (AdaGrad). It has no dependencies, runs in idle callbacks, and its whole state is a few hundred kilobytes per profile.

### Model

1. **Content features** (`features.ts`): each title becomes a hashed sparse vector of genres and genre pairs, language, decade, rating band, type, and when details are known, directors / creators, top cast and franchise (TMDB collection). Details are added when the profile opens a title page; fetching details in idle time for top candidates is planned.
2. **Taste model** (`learner.ts`): a short-term taste vector (half-life 10 days) and a long-term one (half-life 1 year), in the same space, updated by every weighted interaction.
3. **Personal ranking model**: an online logistic regression over the v1.4.0 engine's seven score parts, short / long taste similarity, franchise affinity and novelty (dense), plus the sparse content vector (a weight per director, language, genre pair…). Dense weights start at the hand-tuned v1.4.0 weights and are L2-regularised toward them, so a new profile ranks exactly like v1.4.0 and moves away only as far as its own behaviour justifies.
4. **Re-ranking** (`runtime.ts › rerank`): the engine's candidates are re-scored by the model, then diversified by the v1.4.0 maximal-marginal-relevance pass (shared genres, type and seed); novelty is a model feature.

### Signals and safeguards (`events.ts`)

Finished, binge (several episodes within a day), rewatch, Love / Like, My List and More like this are positive; Not for me, Not interested, Hide and leaving early without coming back are negative; opens and plays are weak positives; a title shown three or more times and never opened is a very weak negative. **Never negative**: playback failures, a short sample, pausing, an accidental exit, and finishing an episode (a finished episode is a positive for the show). Titles that repeatedly fail to play are kept out of rows by the playback-health list instead (`useHiddenRecoIds`).

### Storage and privacy (`store.ts`)

IndexedDB database `panda-intel`, one record per profile (profiles never read each other's record), versioned with migrations; a corrupt record is deleted and rebuilt from the profile's local history, ratings, lists and feedback. Nothing is uploaded. Settings › Profiles › **Taste DNA & Entertainment Memory** shows what was learned, lets you steer it (More / Less), forget single titles, or reset the model. Reset personalization also resets it.

Training runs in `requestIdleCallback` slices on the main thread (budgeted to a few milliseconds each), not in a Web Worker; moving it to a worker is planned.

### Home category feed (`src/lib/feed/`)

89 categories (trending, movie and TV genres, acclaimed, languages, newest, language + genre combos, 10 moods, 5 hidden-gem rails). The order is computed once per profile, page, day and part of day:

score = prior + onboarding genre match + learned genre / language affinity + preferred language + category engagement (opens, plays, completions ÷ impressions, smoothed) − hides + a small per-day exploration jitter + a time-of-day mood boost, followed by a greedy diversity pass (no genre or language repeated within three rails near the top).

Rails load in batches of four as you scroll (IntersectionObserver on phones, focus position on TV), the next batch is prefetched, results go through the persisted SWR cache, titles already shown higher up are removed, and a rail with fewer than six titles left is skipped, never shown half-empty. TV keeps D-pad focus on the current card while rails are appended.

### Discovery features

- **Moods** (`moods.ts`): ten moods map to OR-joined TMDB genres; Search shows them before you type and recognises them in a query ("something scary"). Results always come from the API.
- **Smart Watch Session Assistant**: reads only the local clock (no location, no permissions) and boosts the moods that fit the moment on Home and lists them first on Search.
- **Hidden Gems**: well-rated titles past the first pages of Top Rated, with a 7.0 rating floor, after removing anything shown higher up.
- **Surprise Me** (`surprise.ts`): a random title from the 25 the model likes most among titles seen in rows and never opened.
- **Smart Continue Watching** (`store.ts › continueScore`): recency nudged by what is most likely to be resumed (a new episode, the next episode, a movie past halfway); a brief try weeks ago sinks but is never removed.
- **Why Panda picked this**: a named feature the title shares with titles the profile chose ("Because you like films by …"), or the engine's own reason, or none.
- Natural-language search ("korean thriller", "funny malayalam movies from the 90s") is interpreted by the Panda API from the query text alone; no history is sent.

### Evaluation (synthetic, not real-world accuracy)

`src/test/v150-eval.test.ts` builds 60 synthetic users over a captured snapshot of 683 catalogue titles, with five taste kinds (genre, language, auteur, franchise, mixed), hides part of each user's positives and ranks the rest. Results are written to `docs/eval/intel-eval.json`. **These numbers only compare methods on identical synthetic data; they are not real-world recommendation accuracy, and no real-world accuracy has been measured.**

| k = 10 | Precision | Recall | NDCG | Hit rate | Diversity | Novelty | Coverage |
|---|---|---|---|---|---|---|---|
| Popularity | 0.003 | 0.007 | 0.005 | 0.033 | 0.79 | 0 | 0.016 |
| v1.4.0 engine | 0.100 | 0.200 | 0.188 | 0.667 | 0.624 | 0.873 | 0.249 |
| Intelligence, list data only | 0.147 | 0.293 | 0.273 | 0.767 | 0.429 | 0.955 | 0.417 |
| Intelligence with details | 0.165 | 0.330 | 0.318 | 0.867 | 0.530 | 0.958 | 0.329 |

NDCG by taste kind (engine → list only → with details): genre 0.124 → 0.176 → 0.222; language 0.248 → 0.394 → 0.455; auteur 0.160 → 0.232 → 0.203; franchise 0.241 → 0.367 → 0.412; mixed 0.165 → 0.195 → 0.299. The learned ranker trades some intra-list diversity for relevance; the diversity pass recovers part of it.

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
