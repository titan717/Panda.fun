# Panda.fun v1.4.0 — Independent Release Review

Reviewer: release critic (did not build this release). Reviewed: `release/v1.4.0` at commit `24a9aca` (PR #69).
Note: while I was reviewing, someone else left uncommitted edits in the working tree (19 e2e specs, `src/lib/intro/manager.ts`). I did not review them and did not touch them.

## Overall score: 7.0 / 10. Below the 9/10 bar.

The core of the release is solid: the playback-source policy and fallback, seasons, profile restore and onboarding. It falls short on four things: TV focus details, how the recommendations are evaluated, brand-colour discipline, and one false claim about testing.

## Scores by area

| Area | Score |
|---|---|
| Brand assets / config | 7 |
| Intro Manager | 7.5 |
| Onboarding | 8 |
| TV D-pad / focus | 6.5 |
| Search + Gboard (code only, not tested on a device) | 7.5 |
| Source policy / fallback | 8.5 |
| Playback health / suppression | 7.5 |
| Recommendation engine | 6.5 |
| Recommendation evaluation honesty | 6 |
| Trailers | 7.5 |
| Seasons | 8.5 |
| Profile restore | 8.5 |
| Visual design (black + purple/magenta) | 6.5 |
| Tests | 7 |
| Docs / release honesty | 6.5 |

## Defects, by priority

### P1
1. **False testing claim.** `docs/release-notes/v1.4.0.md` says the release was tested "plus the Android emulator check in CI". `emulator-check.yml` only runs when triggered by hand (`workflow_dispatch`), and its last runs were on `main` (2026-11-09). It never ran for v1.4.0, and it only checks the icon, banner, splash and launch anyway. Fix: run it on this branch and report the result, or delete the claim.
2. **Search → Details → Back on TV loses focus.** Steps: open the Top Picks card `reco-top-picks-2`, then press Back. Focus lands on `search-input`, not on the card. The directive requires restoring the previous focus. Home → Details → Back works (`trending-3` is restored). Fix: save and restore the focused ID per route, the same way Home does, in the TV Search page and its spatial-nav memory.

### P2
3. **First OK after the hold menu is ignored (TV Search).** Steps: hold OK on a card, close the menu with Back, press OK. The first OK does nothing; the second opens the title. Reproduced twice. Fix: reset the long-press "suppress next click" flag when the menu closes, not on the next key press.
4. **Vertical focus memory is inconsistent on TV Search.** Going down 3 rows and back up 3 rows lands on the search input, not the starting card, and the column position isn't kept (lands on `trending-0`). Fix: remember the column per row and keep up/down moves symmetric.
5. **TV episode focus is clipped and hard to see.** On `/title/tv/1396`, the focused episode `ep-1-6` ends at 1093px on a 1080px screen. Its focus style has no outline or shadow, only a thin border, and a partly hidden card sits under the sticky season header. Fix: use `scrollIntoView({block:"nearest"})` plus a scroll margin for the header height, and add a clear focus ring in the brand colour. Screenshot: `/tmp/critic/tv-details-down.png`.
6. **Focus is lost after the intro.** If keys are pressed while the intro plays, focus falls to `<body>` when it ends, and Down moves into the side menu. Fix: when the intro unmounts, move focus to the page's first content item or the onboarding button.
7. **Retry escalates suppression within minutes** (`Player.tsx` retry/`retryAll` → `health.ts`). After all sources fail, pressing Retry and failing again moves the 24h suppression to 72h, and a third failure to 7 days. Fix: count a failure toward escalation only if it is a separate verified failure, at least N hours after the last one.
8. **Recommendation evaluation doesn't do what the directive asks.** `src/lib/reco/evaluate.ts` scores synthetic profiles where "relevant" means "genre matches". That is circular, because the engine itself is genre-driven. It doesn't measure CTR, watch starts, completion, watchlist conversion, repeat-recommendation rate, suppressed-title leakage, or playback-adjusted quality against a baseline. No impressions are logged (`feedback.ts`). Fix: log impressions/clicks/starts/completions locally and compute those metrics against the v1.3 baseline. Until then, state the gap in RECOMMENDATIONS.md.
9. **Missing candidate sources and unmeasured weights** (`reco/engine.ts`). There are no cast, crew, director, keyword or collection candidates. `SCORE_WEIGHTS` are hand-set, which the directive says not to do ("Do not invent weights without measuring results"). Cold-start Top Picks ("You picked Crime") includes weak matches such as Love in Disguise and Doctor X. Fix: add credits/keywords candidate generation, and tune the weights against the metrics in #8.
10. **Off-brand colours.** Blue appears in the TV search field, the mic button, the "Who's watching?" heading, the "You" avatar, the mobile "All Episodes" link and the progress line. A red/orange "NEW & HOT" pill appears on mobile home. Fix: map these to brand tokens in `src/lib/brand.ts` and the CSS variables.
11. **No v1.4.0 end-to-end tests.** No new Playwright specs cover onboarding, the intro, TV focus restore or source policy. Several v1.4 unit tests only check that source files contain certain strings (`toContain`). Fix: add e2e specs for those flows.
12. **Gboard typing is not verified on a device.** The code path (`remoteInput.ts`, `MainActivity.showSoftKeyboard`) looks plausible, and the release notes admit it is untested. The directive asked for testing on an Android TV environment or emulator. Fix: run it on an Android TV emulator with Gboard and record the result.

### P3
13. **Brand asset problems.** The crops of the mark, glyph and mascot peek have a hard flat cut at the bottom. `logo-vertical` has only a white version and its edges are clipped. There are no light-background variants. `public/icon.svg` wraps a 64px PNG but is declared `sizes:any` in the manifest, so it looks blurry when scaled. Fix: export vector or high-resolution crops from the brand PDF art, and add light variants.
14. TV Settings says "Signed in as Asha", which suggests an account exists even though there is no login. Fix: change it to "Profile: Asha".
15. Details pages log "Permissions policy violation: picture-in-picture" because of the YouTube trailer iframe. Fix: line up the iframe `allow` attribute with the site's Permissions-Policy header.
16. One failed episode suppresses the whole TV show, because health is keyed by `platform:type:id`. Fix: key by episode, or roll up to the show only after several episodes fail.
17. On mobile onboarding, the sticky Continue button covers the last row of genre cards.
18. `PLAN-v1.4.0.md` B8 says the TV intro video plays on mobile too. The config uses the mascot animation on mobile, so the plan and config disagree.
19. The intro replay mode is "every-cold-start", so the 5-second TV intro plays on every app launch. Consider "once per version" (play it once after each update) or a shorter replay.
20. "Playback health" and "Language" in Settings use the same globe icon.

## How each finding was checked

**Checked by running:**
- Typecheck, eslint (0 warnings) and vitest (49 files, 387 tests) all passed.
- PR #69 CI status. The emulator workflow's run history.
- TV:
  - Settings scrolling.
  - Search typing, Backspace and Enter.
  - The hold-OK menu, and the first OK being ignored after it closes.
  - Focus restore on Home (works) and Search (fails).
  - Vertical focus memory.
  - Episode focus clipping.
  - Trailer autoplay delay on home rows and details.
  - Fresh intro → skip → keyboard-only onboarding.
  - Focus loss after the intro.
- Mobile:
  - Onboarding (7 steps) and restore after restart.
  - Skip.
  - Reduced-motion intro.
  - Search rows and Top Picks reasons.
  - Details layout.
- Season labels: tv/1396, 37854 and 1429 show "Season N" with no "Arc".
- Web: no broken images or failed requests. The only console noise is the PiP warning.

**Checked by reading code:**
- `playback/registry.ts`: the source policy matches (TV: CineSrc only; mobile: Vidy → CineSrc; browser keeps VidLink as last resort; no source picker).
- `fallback.ts` / `health.ts` logic.
- `remoteInput.ts` / `MainActivity.kt`.
- `reco/engine.ts` and `evaluate.ts`, and the "not AI" wording.
- `intro/config.ts`, `manager.ts` and `INTRO.md`.
- `brand.ts` and `public/brand/*` against the brand-src PDF art.
- The test suite contents.
- The release notes and the plan.

## Key screenshots (in /tmp/critic/)
- Brand: `brand-sheet.png`
- TV:
  - Home, Search, Settings: `tv/tv-_.png`, `tv/tv-_search.png`, `tv/tv-_settings.png`
  - Settings scrolling: `tv-settings-bottom.png`
  - Search typing and hold menu: `tv-search-typed.png`, `tv-search-hold.png`
  - Home focus: `tv-home-focus.png`
  - Episode clipping: `tv-details-down.png`
  - Intro and onboarding: `tv-fresh-intro.png`, `tv-fresh-ob.png`, `tv-ob-genres.png`
- Mobile:
  - Onboarding: `m-onboarding-sheet.png`
  - After onboarding, restart, skip: `m-after-ob.png`, `m-restart.png`, `m-skip.png`
  - Reduced-motion intro: `m-rm-intro.png`
  - Search and details: `m-search-full-sheet.png`, `m-details-full-sheet.png`
- Web: `web-_.png`, `web-_welcome_.png`
