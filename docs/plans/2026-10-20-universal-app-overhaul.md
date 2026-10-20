# Panda.fun Universal App Overhaul Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one universal Android APK with device-adaptive Panda.fun interfaces while preserving Android TV focus and Vidy playback behavior.

**Architecture:** Keep API, media identity, auth, library/history, analytics, routes and playback URL generation shared. Add deterministic device capability selection and expose actual TV mode through the native bridge. Make Android manifest compatible with ordinary and Leanback launchers. Refine existing shells instead of replacing working flows.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Kotlin, Android Manifest/Gradle, GitHub Actions.

## Global Constraints
- One installable package advertises ordinary Android and Android TV launcher entry points.
- Leanback and touchscreen must not exclude one another; main activity must not be locked to landscape. Preserve current player orientation/fullscreen behavior.
- Preserve application ID/update contract, routes, media IDs, Vidy URLs/parameters, episode routing and native fullscreen lifecycle.
- D-pad handling only runs when native TV capability is positively detected; inputs and embedded media keep key ownership.
- Reuse existing mobile/TV shells and `thinking-orbs`; do not delete routes or user state.
- Near-black/charcoal design, restrained warm accents, stable image geometry, visible focus, accessible status and reduced-motion support. No placeholder posters for failed images.
- README update is part of the work. No claims of tests/device coverage unless actually verified.
- Work on `feat/universal-app-adaptive-ui`, with small reversible commits. Do not merge or deploy without verified build/review.

---

### Task 1: Universal Android packaging and truthful TV capability

**Files:** modify `android/app/src/main/AndroidManifest.xml`, `android/app/src/main/java/com/kinoma/tv/ui/MainActivity.kt`, `src/App.tsx`, `src/components/Layout.tsx`; create `src/lib/deviceCapabilities.ts` and `src/lib/deviceCapabilities.test.ts`.

**Interfaces:** `getDeviceMode(signals): 'tv' | 'mobile' | 'tablet' | 'desktop'` is pure and deterministic. `KinomaNative.isTV(): boolean` reports Android TV UI mode or Leanback capability. Existing `window.isKinomaAndroidTV` remains the frontend compatibility signal but is set from native truth, not hard-coded true.

- [ ] Add failing tests for native TV precedence, touch widths below 768 selecting mobile, touch widths at/above 768 selecting tablet, pointer-first selecting desktop, invalid/missing width fallback, and manifest contracts (optional Leanback, optional touchscreen, both launcher categories, no landscape lock on MainActivity).
- [ ] Run focused Vitest tests; expected failure must be due to missing selector/manifest behavior. If dependencies are unavailable, record an environment blocker.
- [ ] Implement the selector, native bridge detection using `UiModeManager.currentModeType == UI_MODE_TYPE_TELEVISION` or `PackageManager.FEATURE_LEANBACK`, and conditional TV class/flag injection. Remove unconditional localStorage TV mode. Make Leanback optional; remove landscape lock from MainActivity only. Gate document-level D-pad handler; keep existing input/media exclusions.
- [ ] Rerun focused tests; expect all selection boundaries and manifest assertions to pass.
- [ ] Run `npm run lint`, `npm test`, `npm run build`; if Android SDK exists, run `cd android && ./gradlew :app:assembleDebug`. Existing TV-navigation, mobile-shell, Vidy and media-route tests must stay green.
- [ ] Commit as `feat(android): support universal TV and touch launch`.

### Task 2: Responsive shell and visual consistency

**Files:** modify `src/components/Layout.tsx`, `src/components/mobile/mobile-shell.css`, `src/styles/android-tv.css`, `src/index.css`, and only where needed `src/pages/MobileHome.tsx` and `src/pages/mobile-home.css`; update `src/App.tsx` loading state and add focused component tests.

**Interfaces:** shells consume device mode; shared data and playback contracts do not change. TV keeps remote navigation and visible focus; mobile keeps touch-first header/bottom navigation and portrait layout; tablet/desktop adapts density without TV-only key handling.

- [ ] Add failing tests for shell mode classes/navigation, mobile nav visibility on touch, TV focus styling, reduced-motion behavior and accessible route-loading status.
- [ ] Run focused tests and distinguish pre-existing failures from new ones.
- [ ] Reuse existing shells/tokens; normalize surface/card/button states and safe areas; use Thinking Orbs only after confirming its API; keep neutral image-error states and stable geometry; honor `prefers-reduced-motion`.
- [ ] Rerun focused tests; assert no route or media data-contract changes.
- [ ] Run lint, full tests and build; compare TV-navigation and `src/lib/vidy.test.ts`/`src/lib/mediaRoute.test.ts` behavior.
- [ ] Commit as `refactor(ui): align responsive shells across devices`.

### Task 3: README and release regression gate

**Files:** modify `README.md`, the design and plan docs; add a documentation contract test if supported by existing conventions.

**Interfaces:** docs describe the actual implementation and only the validation that ran.

- [ ] Add a focused README contract check for universal APK, ordinary + Leanback launcher intent, shared core/device shells, real build/test commands, TV capability selection and unchanged Vidy boundary.
- [ ] Run the check and confirm it flags stale Android-TV-only wording/missing universal guidance.
- [ ] Update README while preserving useful API, route, account, analytics and playback material. Derive commands from actual package scripts and Gradle files; explicitly identify device-level checks not performed.
- [ ] Rerun the documentation test and verify command examples against project configuration.
- [ ] Final gate: `npm run lint`, `npm test`, `npm run build`, Android debug assembly when available, `git diff --check`, merged-manifest inspection, and playback-related diff review. No changes to Vidy URL construction or route/media identity logic.
- [ ] Commit as `docs: document universal Panda.fun app architecture`.

## Unresolved externally observable decisions
Physical-device/emulator coverage depends on available TV, phone and tablet environments. If unavailable, report those checks as unverified. Release signing is environment-dependent; do not create or rotate credentials.
