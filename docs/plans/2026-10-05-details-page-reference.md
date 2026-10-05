# Panda.fun Details Page Reference Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the existing Panda.fun Details page so its information remains Panda.fun-native while the series selector, episodes, and More Like This visually and interactively follow the approved Movy reference.

**Architecture:** Keep `src/pages/Details.tsx` as the data/interaction owner and use focused Details-page CSS in `src/index.css` for the reference-faithful presentation. Preserve MovieAPI, history/watchlist, canonical media routing, and EmbedWave watch routing. Split the work into independently testable visual/behavioral commits.

**Tech Stack:** React + TypeScript, Wouter, Tailwind/CSS in `src/index.css`, Lucide icons, Vitest, MovieAPI, EmbedWave.

## Global Constraints

- Existing trailer implementation and placement are untouched.
- Existing Panda.fun information-page structure is retained.
- Title presentation is refined to be cinematic/distinctive without replacing the information layout.
- Series season selector matches the Movy reference in dimensions, spacing, geometry, typography, selected/hover/focus effects, transitions, horizontal behavior, and responsive behavior.
- Episodes retain real MovieAPI data and existing EmbedWave watch routing.
- More Like This matches the Movy reference in card proportions, image treatment, spacing, typography, hover/scale behavior, horizontal behavior, and responsive rhythm.
- Movie order: Trailer -> Information -> More Like This.
- Series order: Trailer -> Information -> Season selector -> Episodes -> More Like This.
- Do not modify homepage, sidebar/mobile navigation, trailer provider, MovieAPI architecture, or unrelated card systems.

---

### Task 1: Establish canonical Details recommendation navigation and focused behavior coverage

**Files:**
- Modify: `src/pages/Details.tsx`
- Modify: `src/lib/mediaRoute.ts`
- Test: `src/lib/mediaRoute.test.ts`

**Interfaces:**
- Consumes: `buildDetailsHref(id, type)` from `src/lib/mediaRoute.ts`.
- Produces: recommendation navigation that preserves canonical media identity and content type.

- [ ] **Step 1: Add focused failing tests**

Cover:
- canonical movie recommendation route uses the media ID rather than a title slug;
- canonical series recommendation route uses the media ID rather than a title slug;
- duplicate titles do not collapse two distinct canonical IDs into one route.

- [ ] **Step 2: Verify the relevant failure**

Run: `npm test -- src/lib/mediaRoute.test.ts --run`
Expected: the new route assertions fail because Details recommendations currently construct title-slug URLs.

- [ ] **Step 3: Implement the minimum behavior**

Import and use `buildDetailsHref` for recommendation buttons. Keep the recommendation item's existing content-type decision. Do not change API data or recommendation ordering.

- [ ] **Step 4: Verify the focused pass**

Run: `npm test -- src/lib/mediaRoute.test.ts --run`
Expected: all media-route tests pass.

- [ ] **Step 5: Run the affected integration check**

Run: `npm run lint`
Expected: TypeScript completes without errors.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add src/pages/Details.tsx src/lib/mediaRoute.ts src/lib/mediaRoute.test.ts
git commit -m "fix: use canonical routes for detail recommendations"
```

---

### Task 2: Refine the Panda.fun information section and title treatment

**Files:**
- Modify: `src/pages/Details.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: existing `data`, `title`, `synopsis`, `poster`, `kind`, watchlist/history state, and action handlers.
- Produces: refined information presentation without changing the trailer or underlying data flow.

- [ ] **Step 1: Add focused UI assertions where existing test infrastructure permits**

Verify the rendered Details structure continues to contain:
- trailer iframe/placeholder region;
- title;
- metadata;
- synopsis;
- Watch action;
- My List action;
- series selector only for series.

- [ ] **Step 2: Verify the baseline**

Run: `npm run lint`
Expected: current Details implementation type-checks before presentation changes.

- [ ] **Step 3: Implement the minimum presentation change**

Refine only the information block:
- retain its current Panda.fun placement;
- introduce a content-aware title treatment hook/class so the title can feel cinematic rather than identical across all content;
- improve hierarchy of eyebrow, title, metadata, synopsis, and actions;
- preserve existing action handlers and history behavior;
- preserve warm/dark Panda palette;
- do not modify trailer DOM or iframe construction.

Use deterministic classes derived from content type/title rather than runtime-generated styles so rendering remains stable.

- [ ] **Step 4: Verify**

Run: `npm run lint`
Expected: TypeScript passes with no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Details.tsx src/index.css
git commit -m "feat: refine Panda details information design"
```

---

### Task 3: Rebuild the series selector and episode presentation to match Movy

**Files:**
- Modify: `src/pages/Details.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `seasonItems`, `selectedSeason`, `seasonEpisodes`, `historyUtil`, and existing episode watch routing.
- Produces: reference-faithful season cards and episode rows while retaining current season/episode functionality.

- [ ] **Step 1: Add focused tests for season/episode state behavior**

Cover:
- the saved season is selected when it exists in the returned season list;
- otherwise the first returned season is selected;
- changing season requests/uses only that season's episodes;
- selecting an episode builds the existing `id$season$episode` watch route.

- [ ] **Step 2: Verify baseline failure/pass state**

Run: `npm test -- src/lib/mediaRoute.test.ts --run`
Expected: route tests pass; season behavior remains covered through the Details integration once the implementation is updated.

- [ ] **Step 3: Implement reference-faithful selector**

Update the series section presentation to match the Movy reference:
- same compact card sizing and proportions;
- same horizontal gap and scrolling;
- rounded card geometry;
- clear active-season treatment;
- hover/focus microinteraction and transition;
- no intrusive full-width dashboard controls;
- mobile remains horizontally scrollable.

Keep `selectedSeason` state and `api.getSeasonEpisodes` behavior unchanged.

Update episode presentation to the agreed reference rhythm:
- episode number;
- artwork;
- title;
- short synopsis;
- useful metadata when available;
- clear selected/hover/focus affordance.

Selecting an episode must retain the current watch route and analytics event.

- [ ] **Step 4: Verify focused behavior**

Run: `npm run lint`
Expected: TypeScript passes.

- [ ] **Step 5: Run full tests**

Run: `npm test -- --run`
Expected: Vitest completes successfully with no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Details.tsx src/index.css
git commit -m "feat: match details season and episode styling"
```

---

### Task 4: Rebuild More Like This to match Movy and place it after episodes for series

**Files:**
- Modify: `src/pages/Details.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `recommendations` from MovieAPI and `buildDetailsHref`.
- Produces: a reference-faithful More Like This rail for movies and series.

- [ ] **Step 1: Add focused rendering/navigation coverage**

Verify:
- movie Details renders More Like This immediately after information;
- series Details renders More Like This after episodes;
- recommendation cards use canonical media routes;
- missing recommendations render the existing empty state;
- missing recommendation images do not break the card.

- [ ] **Step 2: Implement the reference card rail**

Replace the current movie-only generic recommendation grid with a shared More Like This presentation for both content types.

Match the Movy reference's:
- card width/aspect ratio;
- image crop and radius;
- horizontal spacing;
- metadata/title hierarchy;
- hover scale/shadow treatment;
- horizontal overflow behavior;
- mobile scrolling;
- restrained section heading and vertical rhythm.

Use real recommendation data. Do not copy reference titles or artwork.

Render it after the episode section for series and after information for movies.

- [ ] **Step 3: Verify**

Run: `npm run lint`
Expected: TypeScript passes.

Run: `npm test -- --run`
Expected: all Vitest tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Details.tsx src/index.css
git commit -m "feat: match details more like this to reference"
```

---

## Verification and visual acceptance

After all four commits:

- Run `npm run lint` and confirm zero TypeScript errors.
- Run `npm test -- --run` and confirm all tests pass.
- Inspect one movie Details page and one series Details page at desktop width.
- Inspect the same pages at mobile width.
- Confirm the existing trailer is unchanged.
- Confirm season switching updates episodes.
- Confirm episode selection opens the correct existing watch route.
- Confirm More Like This appears in the approved position for both movie and series.
- Confirm recommendation clicks preserve canonical media identity.
- Confirm no homepage/sidebar/player changes are introduced.

## Unresolved product decisions

None. The approved design decisions are complete.
