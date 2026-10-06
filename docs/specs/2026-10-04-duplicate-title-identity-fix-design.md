# Duplicate-title identity fix

## Problem
Panda.fun search results can contain different movies with the same title. Search cards currently retain the unique MovieApi ID, but navigation converts it to a title slug. Details then searches TMDB by title, so duplicate titles can resolve to the wrong movie.

## Goals
- Preserve the exact canonical media ID from the selected result.
- Make details lookup ID-based whenever the ID is available.
- Keep trailer resolution tied to that same ID.
- Preserve legacy IDs and existing movie/TV behavior.
- Avoid special-casing any title.
- Add regression coverage for same-title movies with different IDs.

## Non-goals
- Do not merge or hide legitimate duplicate titles.
- Do not change MovieApi search ranking or metadata.
- Do not redesign the details page.

## Approaches

### A. Canonical media ID in the details route — recommended
Use `/details/{MovieApiMediaId}?type=movie`.

Pros: deterministic, minimal, matches the existing MovieApi identity contract.

Cons: URLs are less human-readable.

### B. Title slug plus ID query parameter
Use `/details/2018?type=movie&mediaId=tmdb_movie_12345`.

Pros: readable path.

Cons: extra parsing/fallback logic and easier to accidentally omit the ID.

### C. New short route token
Create a stable route key from type + TMDB ID.

Pros: clean URLs.

Cons: introduces another identity abstraction without a current need.

## Recommendation
Use Approach A. The MovieApi ID is already the canonical frontend identity and is required by details, recommendations, seasons, playback, and trailer APIs. Passing it directly removes the ambiguous title-resolution step.

Keep title-slug resolution only as a backwards-compatible fallback for old bookmarks.

## Implementation design

1. Search result hrefs use `item.id`, not `slugifyTitle(item.title)`.
2. Details recognizes canonical MovieApi IDs first and uses them directly.
3. Canonical-ID routes remain stable; they are not rewritten to title-only URLs.
4. `getDetails(id)` and `getTrailer(id)` receive the same resolved canonical ID.
5. Audit recommendation/home/library cards and route by ID whenever one exists.
6. Add regression tests for two same-title movies with different IDs, including href generation and canonical-ID resolution.

## Acceptance criteria
- Clicking either of two same-title movies opens its own details.
- Posters, metadata, backdrop, and trailer remain tied to the selected TMDB ID.
- Refreshing either details page preserves the selected movie.
- Existing legacy title URLs still resolve when possible.
- TV series and movie playback continue working.
- No title-specific special case is added.
