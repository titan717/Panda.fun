# Roadmap to v1.5.1 (MASTER MISSION V4)

Current release: **v1.2.4** (2026-11-09). One patch step per release; every release ships at least four user-visible improvements including at least one player improvement, with tests, screenshots, notes, a Vercel production deploy, a signed APK GitHub Release and a verified in-app update. Items found already shipped are replaced with bigger ones of equal or greater impact; the plan only grows.

## Shipped
v1.0.0–v1.0.9 rebuild, player, Android shell, updater, perf 1–2 · v1.1.0–v1.1.9 personalised Home, smart search, cast/collections, Watchlist 2.0, Continue Watching, ad shield, TV sidebar, calendar and reminders, personalization · v1.2.0 Anime, community ranking, Report an Issue · v1.2.1 Panda subtitles · v1.2.2 Still watching?, gestures, PiP, spoiler protection · v1.2.3 sync code · **v1.2.4** player overhaul 1 (buffering, stall card with auto source switch, resume prompt, accumulating seek bubble, time to first frame), VidLink + ad tiers, clean trailers pass 1 (sandboxed frame, 2 s reveal delay, loops without hiding), phone remote, deep links and share links.

## Plan

| Version | Theme | Player improvement |
|---|---|---|
| v1.2.5 | Source research (≥10 movie/TV sources, docs/SOURCES.md, PLAYER_COMPARISON.md), tier rules applied to each, weekly CI ranking; trailer research and provider registry (licensed > Vimeo/Dailymotion > hardened YouTube > backdrop) | Source switch keeps position across all sources |
| v1.2.6 | Anime source research (≥10, docs/ANIME_SOURCES.md), sub/dub choice | Anime: skip intro/recap/credits where sources report them |
| v1.2.7 | Player overhaul 2 (mobile): gestures, lock, panels, landscape layout | Mobile chrome to blueprint |
| v1.2.8 | Code review 1 (docs/CODE_REVIEW.md), dead code, error boundaries | Player error paths |
| v1.2.9 | Refine pages 1 + TV sidebar exactly like the blueprint | Next-episode 10 s ring |
| v1.3.0 | Refine pages 2 + customization 1 | Player panel motion 200–240 ms |
| v1.3.1 | Replaces "phone remote/QR/share" (shipped in v1.2.4): **Watch history 2.0** — per-episode history, rewatch, remove, timeline, export | Resume across devices via sync |
| v1.3.2 | Smarter discovery | Recommendations at the end card |
| v1.3.3 | Franchise, collections, actor pages 2.0 | Play-all collection queue |
| v1.3.4 | Mood picks, Surprise me, reminders 2.0 | Random episode play |
| v1.3.5 | Panda TV channel + screensaver | Channel mode player |
| v1.3.6 | Google TV integration (Watch Next, recommendations) | Launch into player from Watch Next |
| v1.3.7 | Kids 2.0 | Kids player limits |
| v1.3.8 | Code review 2 + security | Shield hardening |
| v1.3.9 | Ease of use | Simplified player for first-time users |
| v1.4.0 | Customization 2 | Player themes |
| v1.4.1 | Offline (where sources allow), offline states | Offline state in player |
| v1.4.2 | Advanced browse + Search v2 | Search from the player |
| v1.4.3 | Home v2 | Preview player on Home |
| v1.4.4 | Player 3.0 | Full §5 checklist audit |
| v1.4.5 | Performance 4, low-end devices | TTFF ≤ 2 s on low-end |
| v1.4.6 | Accessibility and localisation (RTL) | Screen-reader player |
| v1.4.7 | Tablets, foldables, notifications, widget | Tablet player layout |
| v1.4.8 | Profiles 2.0, Panda year, watch together | Watch together sync |
| v1.4.9 | Sweep 3 | Player polish |
| v1.5.0 | Final performance and blueprint fidelity | Final player pass |
| v1.5.1 | Docs, full regression, FINAL_REPORT | Regression gate |
