# Panda.fun Details Page Reference Design

## Goal

Refine the existing Panda.fun Details page without replacing its current structure or trailer. Use the Movy details-page reference as the visual benchmark for the season selector, episode presentation, and More Like This, while keeping Panda.fun branding, data, routing, and Vidy.st playback.

## Scope

### 1. Existing trailer

- Keep the current trailer implementation and placement unchanged.
- Do not replace the trailer provider or alter playback behavior as part of this feature.

### 2. Information section

Keep the current Panda.fun information layout and placement.

Refine:
- title typography and visual treatment so the title feels cinematic and distinctive rather than a generic identical heading for every title;
- metadata hierarchy for year, rating, runtime/type, and genres;
- synopsis spacing and readability;
- existing Watch/Continue Watching and My List actions;
- native share icon/button where the existing page supports it.

The information section should remain recognizably Panda.fun and should not become a copy of the Movy information layout.

### 3. Series season selector

For series, visually match the Movy reference as closely as practical:
- same card dimensions and proportions;
- same spacing/gaps;
- same rounded geometry;
- same typography scale and hierarchy;
- same selected-state appearance;
- same hover/focus treatment;
- same transition feel;
- same horizontal scrolling behavior;
- responsive sizing matching the reference.

Functionality remains driven by Panda.fun's real season data. Selecting a season updates the episode list without replacing the page or playback architecture.

### 4. Episodes

Retain real MovieAPI episode data and existing watch routing.

Presentation should follow the reference's visual language:
- episode artwork;
- episode number;
- title;
- short synopsis when available;
- useful metadata when available;
- clear hover/focus affordance.

Selecting an episode routes to the existing Vidy.st playback target using TMDB identity plus season and episode.

### 5. More Like This

For both movies and series, make the More Like This section reference-faithful to Movy:
- same card proportions;
- same image treatment;
- same spacing;
- same typography hierarchy;
- same hover/scale interaction;
- same horizontal rail behavior;
- same responsive behavior and visual rhythm.

Recommendations remain dynamically supplied by MovieAPI. Do not copy reference content.

Placement:
- Movie: Trailer -> Information -> More Like This
- Series: Trailer -> Information -> Season selector -> Episodes -> More Like This

### 6. Existing Panda.fun shell

Do not modify:
- sidebar;
- mobile navigation;
- homepage;
- unrelated homepage card systems;
- existing trailer implementation;
- MovieAPI architecture;
- Vidy.st provider.

## Data and interaction

- Continue using the current Details data loading and MovieAPI endpoints.
- Continue using existing season and episode endpoints.
- Preserve watchlist/history behavior.
- Preserve analytics events where applicable.
- Recommendation cards must navigate using the canonical Panda.fun media route rather than title-derived identity where the route helper is available.
- Season changes must preserve the current selected-season/history behavior.

## Responsive behavior

Desktop should prioritize the reference's proportions and horizontal rhythm. Tablet and mobile should retain the same visual hierarchy while allowing horizontal selector/recommendation rails to scroll naturally without breaking the Panda.fun shell.

## Error and loading behavior

- Existing title loading/error states remain.
- Empty season/episode and recommendation states remain graceful.
- Missing artwork gets the existing Panda.fun fallback treatment.
- A missing recommendation or episode must not break the rest of the Details page.

## Testing

Before implementation is declared complete:
- run TypeScript/lint checks;
- run existing Vitest tests;
- add focused tests for any new pure route/data behavior introduced;
- inspect the Details page at desktop and mobile breakpoints;
- verify season switching, episode selection, recommendation navigation, and existing trailer behavior.

## Out of scope

- Homepage redesign.
- Trailer/player redesign.
- New recommendation algorithm.
- New API endpoints unless an existing contract is insufficient for the specified UI.
- Sidebar redesign.
- General card-system refactoring outside the Details page.
