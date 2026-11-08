# Roadmap to v1.5.1

Current release: **v1.1.6** (2026-11-08). One patch step per release (§10), each a big user-visible bundle with at least 4 improvements, tests, blueprint comparison, signed APK, Vercel deploy and in-app update check. Defects from AUDIT (A2-*) are folded into the earliest release that touches them.

## Shipped
v1.0.0–v1.0.9 rebuild, player, Android shell, updater, perf 1–2 · v1.1.0 personalised Home · v1.1.1 smart search · v1.1.2 cast, crew, collections · v1.1.3 Watchlist 2.0 · v1.1.4 Continue Watching 2.0 · v1.1.5 Player 2.0 (speed, sleep timer, Still watching?, skip intro, next-episode card) · v1.1.6 perf 3.

## v1.1.7 — Addendum 2, release 1: refine Release-1 pages, blueprint TV sidebar, ad shield (+ calendar)
Addendum 2 takes the next two versions; the roadmap items they displace (old v1.1.8 personalization + R8 and old v1.1.9 refinement sweep 1) are merged into v1.1.9, so the final release is still v1.5.1 (D-99).

| Task | Test |
|---|---|
| Ad shield layers 1–8: sandbox per source, click isolation, Android window/navigation/download/permission blocks, network blocklist, CSP parity, source ranking, Settings counter (A2-7, docs/AD_SHIELD.md) | `e2e/shield.spec.ts` (release-blocking), `src/test/v117.test.ts`, emulator playback check |
| TV sidebar exactly like the blueprint (BLUEPRINT_SPEC 4.6–4.16) | `e2e/tv-sidebar.spec.ts` at 1280, 1920, 3840 |
| Refine Home, hero, rows, Details, Search, Settings, player screens against the blueprints at every §9 viewport, 3 polish passes | blueprint-compare screenshots, smoke e2e |
| Remind Me, Coming Up `/calendar`, new-episode alerts, native notifications, notification + monochrome icons (A2-1…A2-6) | unit calendar tests, CI Android build, emulator check |
| Coming Soon in New & Hot with reminder state; new-episode badges on cards | e2e New & Hot |

## v1.1.8 — Addendum 2, release 2: refine every other page
Profiles and Who's watching, My List and list pages, Continue Watching, Kids, Coming Soon and calendar, cast and crew, collections, browse and genre pages, update and What's New screens, every empty, loading and error state — blueprint comparison at every viewport, 3 polish passes, results in BLUEPRINT_SPEC.

## Plan (§11)
| Version | Theme |
|---|---|
| v1.1.9 | ✅ Personalization settings (row order and visibility, density, trailer options) + R8 shrinking (A2-6) + visual refinement sweep 1 (transitions, micro-interactions) — merged after Addendum 2 |
| v1.2.0 | ✅ Source adapters with capabilities, Report broken source with backend ranking (Wilson + decay), AniList anime via Vidy (embed sandbox shipped in v1.1.7) |
| v1.2.1 | ✅ External subtitles, caption layer, subtitle settings, per-profile languages (A2-8) |
| v1.2.2 | ✅ Still watching? after N episodes, gestures, picture-in-picture, spoiler protection |
| v1.2.3 | Sync code with encrypted backup (A2-9) |
| v1.2.4 | Phone as remote (QR), shareable links |
| v1.2.5 | Smarter discovery (taste profile, stated reasons, hidden gems) |
| v1.2.6 | Franchise watch-order guides, curated collections, actor pages 2.0 |
| v1.2.7 | Mood and time picks, Surprise me |
| v1.2.8 | Panda TV channel, idle screensaver |
| v1.2.9 | Google TV: Watch Next row, deep links, voice handoff, launcher shortcuts |
| v1.3.0 | Kids 2.0 (safe search, time limits, PIN) |
| v1.3.1 | Security and privacy hardening |
| v1.3.2 | Stability: full e2e, soak, memory leaks |
| v1.3.3 | Competitive review 2 |
| v1.3.4 | Offline conveniences |
| v1.3.5 | Advanced browse: studios, networks, decades, moods, genre hubs |
| v1.3.6 | Home v2 |
| v1.3.7 | Search v2 |
| v1.3.8 | Player 3.0 |
| v1.3.9 | Visual refinement sweep 2 |
| v1.4.0 | Profiles 2.0 |
| v1.4.1 | "Your Panda year" recap |
| v1.4.2 | Watch together |
| v1.4.3 | Performance round 4, low-end TV mode |
| v1.4.4 | Accessibility 2.0 |
| v1.4.5 | Localization incl. RTL |
| v1.4.6 | Tablet, foldable, landscape polish, device matrix |
| v1.4.7 | Notifications 2.0 and a Continue Watching home widget |
| v1.4.8 | Onboarding and help |
| v1.4.9 | Competitive review 3, refinement sweep 3 |
| v1.5.0 | Final performance, 1080p/4K TV refinement, full blueprint audit |
| v1.5.1 | Docs, full regression, clean-install and update-path tests, FINAL_REPORT |
