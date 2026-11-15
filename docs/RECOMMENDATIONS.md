# Recommendations (v1.4.0)

Search, before you type, is Panda's discovery page. Its first row is **Panda Top Picks**, followed by Recommended for you, Trending now, Popular now, Because you watched…, Hidden gems, genre discovery and Recently added. All of it is computed **on the device** from the active profile's own data. Nothing is sent to a server and there is no AI or ML API. The engine is a transparent, hand-weighted content-based ranker with diversity re-ranking. **It is not machine learning**, and the app never calls it "AI".

Code: `src/lib/reco/` (pure modules, unit-tested in `src/test/v140-reco.test.ts`). UI: `src/tv/TvDiscover.tsx`, `src/mobile/MDiscover.tsx`, hook `useRecommendations.ts`.

## Pipeline

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

## Honest explanations

`explain()` gives a reason only when one component really drove the score (contribution > 0.12) and has a checkable cause: "Because you watched Dark", "You picked Thriller", "You rate Comedy highly", "Trending now", "Rated 8.4", "New in 2026". When nothing stands out, **no reason is shown**. The UI never makes up text like "Because you'll love it".

## Feedback controls

Hold OK on TV (or press Menu, or right-click on a computer), or press and hold / tap ⋮ on a phone: **More like this**, **Not interested**, **Hide from recommendations**, **Already watched** and **Undo my last choice for this title**. Changes apply immediately because the hook subscribes to the feedback store. Settings › Personalise resets the taste profile, and clearing recommendation feedback is part of that reset.

## Offline evaluation

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
- The catalogue is whatever the backend returns (Home rails, trending, discover, More Like This). The engine cannot recommend what those lists never contain.

## Developer diagnostics

Dev builds, or `localStorage.setItem("panda:recodebug", "1")` on any build, show a collapsed "Recommendation diagnostics" panel under the rows. It lists the model (genre affinities and their origin, seeds, type, era) and the top 25 scored candidates with every score part and the chosen reason. It is hidden from viewers by default.
