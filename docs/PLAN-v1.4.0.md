# v1.4.0 implementation plan and baseline

Baseline: `main` at f7f9dd0 (v1.3.1). On 2026-11-15, typecheck, lint, 311 unit tests and the production build passed (build warning: the `panda3d` chunk is 532 KB, used only by /welcome).

## Baseline bug list

| # | Pri | Area | Bug | Root cause | Status |
|---|---|---|---|---|---|
| B1 | P0 | Web | Posters and backdrops show the placeholder on the production site after the first visit | The service worker re-fetches images with `fetch()`, which is governed by CSP `connect-src`; the TMDB image host was only in `img-src`, so every SW image fetch was blocked and the `<img>` fell back | Fixed (CSP `connect-src` + SW passes failed image requests through; verified 14/14 artwork on an HTTPS production build with the SW active) |
| B2 | P0 | TV | Settings could not be scrolled with the D-pad; focused options went off-screen | Settings scroll container had no focus-driven scrolling | Fixed (wip/tvinput) |
| B3 | P0 | TV | Search field could not reliably open Gboard in the Android app | WebView input was focused with `inputmode=none`; no native request to show the IME | Fixed (wip/tvinput, native bridge + `useRemoteField`) |
| B4 | P1 | Playback | Visible source pickers (pills, TV panel, Settings choice, stall "Switch source") | Product rule changed in v1.4.0 | Fixed (removed everywhere; automatic fallback) |
| B5 | P1 | Playback | VidLink reachable on mobile; non-CineSrc providers reachable on TV through the stored preference | Preference honoured on every platform | Fixed (`SOURCE_POLICY`, preference forced to auto) |
| B6 | P1 | Details | TV season list shows TMDB arc names ("East Blue", "Wano Country Arc") | Season `name` rendered as is | Fixed (always "Season N", Specials only for season 0) |
| B7 | P1 | Profiles | Every app start asked "Who's watching?" and did not restore the last profile | v1.2.9 rule | Fixed (wip/onboarding: last profile restored on restart; fresh install still asks) |
| B8 | P1 | Intro | Different intros per platform; no single place to replace the asset | Intro code spread over several modules | Fixed (Intro Manager, `public/intro/intro-tv.mp4` on TV and mobile) |
| B9 | P2 | Reco | Top Picks were mostly popularity with genre weights; no feedback controls; no cold start | Simple heuristic in `personal.ts` | Replaced by `src/lib/reco/` |
| B10 | P2 | Trailers | Trailer autoplay was implemented separately on each surface; two could start at once | No central manager | Fixed (`trailerAutoplay.ts`) |
| B11 | P3 | Build | `panda3d` chunk over 500 KB | three.js on /welcome only, lazy-loaded | Not changed; the chunk is lazy-loaded and does not affect the app shell |

## Workstreams

- [x] Production web artwork (B1)
- [x] Central brand config `src/lib/brand.ts` and assets from the brand PDF (`docs/BRAND.md`)
- [x] Intro Manager + mobile intro (`docs/INTRO.md`)
- [x] Duolingo-inspired onboarding (7 screens, skippable, per profile, Settings redo/reset)
- [x] Profile restore on restart
- [x] TV D-pad: Settings scrolling, focus memory, Gboard text entry
- [x] Playback registry, automatic fallback and health records (`PLAYBACK_HEALTH.md`, `SOURCES.md`)
- [x] Recommendation engine and the redesigned Search (`RECOMMENDATIONS.md`)
- [x] Seasons and trailer autoplay (`DETAILS.md`, `TRAILERS.md`)
- [x] Tests for every module; web gate (typecheck, lint, unit, build)
- [ ] Android build (CI `build-apk.yml`; no Android SDK in the dev sandbox) and emulator check (`emulator-check.yml`)
- [ ] Independent design review ≥ 9/10 (`docs/REVIEW-v1.4.0.md`)
- [x] Version 1.4.0, changelog, release notes
- [ ] GitHub Release, Vercel production deploy and production verification
