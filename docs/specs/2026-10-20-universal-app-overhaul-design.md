# Panda.fun Universal App and UI Overhaul — Design

**Date:** 2026-10-20  
**Status:** Approved for implementation  
**Scope:** Shared React/TypeScript frontend and Android packaging.

## Goals
1. Deliver one Android APK that can launch on Android TV, phones, and tablets, while keeping the web/PWA frontend usable on desktop.
2. Select navigation, layout and input behavior based on device capabilities and screen size.
3. Improve visual consistency with near-black surfaces, restrained warm accents, stable artwork geometry, accessible focus, loading and error states.
4. Preserve current TV playback behavior, Vidy URLs and parameters, normalized media IDs, season/episode routes, and native fullscreen lifecycle.
5. Add focused regression coverage and run web/Android builds where the environment permits.
6. Update the root README with the actual universal architecture, build/test commands, playback boundaries, and honest validation status.

## Current evidence
- The manifest requires Leanback and forces the main and player activities to landscape.
- `MainActivity.kt` unconditionally sets `window.isKinomaAndroidTV = true`, stores TV mode in localStorage and adds `tv-mode`.
- `App.tsx` installs a document-wide directional-key handler; `tvRemoteNavigation.ts` already checks the TV flag and excludes editable controls and embedded media.
- The project has mobile-shell components/styles, TV-specific styles, Vitest tests and the `thinking-orbs` dependency.
- The root README still describes the native app as Android TV-only.

## Architecture
Keep API access, media identity, authentication, library/history, analytics, routes and playback URL generation shared. Add deterministic device-mode selection: native TV capability is authoritative; otherwise touch/coarse input and viewport width distinguish mobile and tablet, while pointer-first environments use desktop behavior. The Android bridge reports actual TV capability rather than hard-coding it. Keep separate presentation behavior for TV remote navigation and touch-first mobile, with adaptive tablet/desktop density.

## Universal Android package
Keep the existing application ID and update/install contract. Advertise both ordinary and Leanback launchers, make Leanback optional, keep touchscreen optional, and remove the main activity's landscape lock. Preserve the player activity's existing orientation/fullscreen behavior unless regression evidence requires a narrowly scoped change. Confirm launcher compatibility on actual devices/emulators where available; manifest inspection alone is not proof of device support.

## Visual system
Use near-black/charcoal surfaces, consistent type/spacing, restrained warm accents, rectangular artwork with stable dimensions, clear focus/hover/pressed/disabled states, accessible loading status, neutral image-failure treatment, and reduced motion. Reuse existing shells and the installed Thinking Orbs dependency after verifying its API. Do not invent placeholder posters or duplicate data fetching.

## Playback compatibility boundary
Do not change Vidy URL construction, autoplay/next-episode parameters, media-ID normalization, season/episode routes, or native fullscreen/player lifecycle as part of the redesign. Test representative movie/TV URL and route contracts before and after shared-shell changes. Fix a playback defect only with narrow evidence-based changes.

## README requirements
Preserve useful API, routes, accounts, analytics and playback documentation. Correct stale Android-TV-only statements; document the single universal APK, TV capability selection, shared core/device-specific shells, supported build/test commands, Vidy boundary and unverified device-level checks. Never claim builds or device compatibility that were not verified.

## Validation
Run baseline and final `npm run lint`, `npm test`, and `npm run build`. Run `cd android && gradle clean :app:assembleDebug` when Gradle/SDK dependencies are available; this repository does not include a Gradle wrapper. Inspect merged manifest and bundled assets. Test TV remote, phone touch and tablet/resize behavior when devices/emulators are available. Report unavailable checks explicitly.

## Out of scope
No backend/provider replacement, no rewrite of TV playback, no removal of routes/auth/analytics/library behavior, and no claim of exact third-party UI parity.

## Acceptance criteria
- Main manifest supports ordinary and Leanback launcher entries without requiring Leanback or forcing main activity landscape.
- TV D-pad behavior activates only with positive TV capability; phone/tablet do not inherit TV mode.
- Existing TV playback and Vidy behavior remain unchanged.
- Responsive shells and shared state treatments remain consistent and accessible.
- Tests/build outcomes and remaining device-level gaps are reported accurately.
- Root README matches the verified implementation.
