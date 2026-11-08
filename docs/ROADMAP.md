# Roadmap to v1.5.1

Current release: **v1.1.6** (2026-11-08). One patch step per release (§10), each a big user-visible bundle with at least 4 improvements, tests, blueprint comparison, signed APK, Vercel deploy and in-app update check. Defects from AUDIT (A2-*) are folded into the earliest release that touches them.

## Shipped
v1.0.0–v1.0.9 rebuild, player, Android shell, updater, perf 1–2 · v1.1.0 personalised Home · v1.1.1 smart search · v1.1.2 cast, crew, collections · v1.1.3 Watchlist 2.0 · v1.1.4 Continue Watching 2.0 · v1.1.5 Player 2.0 (speed, sleep timer, Still watching?, skip intro, next-episode card) · v1.1.6 perf 3.

## v1.1.7 — Release calendar and reminders (in progress)
| Task | Test |
|---|---|
| Remind Me replaces Watch Now on unreleased titles (A2-1) | unit: `detailsCtas` returns `remind` for future dates |
| Coming Up page `/calendar`: Out Now + day groups, TV and mobile | e2e: page renders, D-pad reaches every card |
| New-episode alerts from `/panda/calendar` for Watchlist, reminders and recent shows (A2-2, A2-4) | unit: `followedIds`, `buildCalendar`, `unseen` |
| Blueprint 15.4 card: Allow / N new episodes / You're all caught up | e2e mobile My Space |
| Native Android notifications + notification icon + monochrome launcher layer (A2-3, A2-6) | CI Android build, emulator check |
| TV My Space Coming Up entry with count (A2-5); Settings › Notifications | e2e TV My Space |
| Upgraded Coming Soon on New & Hot: reminder state on cards, new-episode badges driven by the calendar | e2e New & Hot |

## Plan (§11)
| Version | Theme |
|---|---|
| v1.1.8 | Personalization settings (row order and visibility, density, trailer options) on top of the existing UI scale / contrast / text / motion; R8 shrinking (A2-6) |
| v1.1.9 | Visual refinement sweep 1: transitions, micro-interactions, icons, empty-state art |
| v1.2.0 | Source adapters with capabilities, Report broken source with backend ranking (Wilson + decay), AniList anime via Vidy, embed sandbox (A2-7) |
| v1.2.1 | External subtitles, caption layer, subtitle settings, per-profile languages (A2-8) |
| v1.2.2 | Still watching? after N episodes, gestures, picture-in-picture, spoiler protection |
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
