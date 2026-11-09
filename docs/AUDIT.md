# Audit

## Audit v1.2.7 — subtitles, Kids PIN and Android review (2026-11-09)

Affected screens audited first: player subtitles (TV side panel, phone sheet), Settings › Subtitles and Parental, Profiles, Manage/Edit profile, the phone remote page, and the native update, network and storage paths.

| Finding | Severity | Fix |
|---|---|---|
| Manage profiles let a child turn Kids off, remove the PIN or add an adult profile without the PIN | High | ParentLock on Settings › Parental, Manage and Edit profile (A127-3) |
| Kids PIN stored in plain text, unlimited guesses | Medium | PBKDF2 hash + salt, persisted lockout (A127-1, A127-2) |
| Hold-to-repeat timing buttons stopped as soon as a finger moved on phones | Medium (bug) | HoldButton uses pointer capture and stops only on release/cancel/lost capture |
| CC key did nothing on phones (focus on `<body>`, listener on the player root) | Low (bug) | window capture listener |
| Subtitle offset in 0.5 s steps was too coarse for real drift | Low | 0.1 s steps with hold acceleration |
| Phone remote: no session expiry or rate limit, any source address, no Host check, code kept on the phone | Medium | sessions, LAN-only, IP-literal Host, token bucket, global wrong-code limit (A127-8) |
| Update APK origin not checked before the installer; FileProvider exposed the external storage root; backups on; no pinning | Medium/Low | A127-4 to A127-7 |
| R8 full mode implicit | Info | set explicitly; keep rules for Gson/TypeToken already present |

Gates: lint 0 warnings, `tsc -b` strict, 232 unit tests, full Playwright suite on all projects, entry JS 23,367 B (≤ budget), CSP check, Android build and emulator install over 1.2.6 in CI.

## Audit v1.2.6 — player and security gate (2026-11-09)

Inspected: the player on phones (portrait and landscape), tablets and TV with the CineSrc, Vidy and VidLink stand-ins and the live embeds; every workflow in `.github/workflows`; `npm audit`; `vercel.json` headers; the Android WebView, bridge and bundled-asset responses (`MainActivity.kt`); the entry chunk by module.

| # | Finding | Where | Fix |
|---|---|---|---|
| A126-1 | CSP allowed `'unsafe-inline'` styles for one inline `<style>` | `vercel.json`, `MainActivity.kt` | SHA-256 hash, build fails on mismatch (`scripts/vite-integrity.mjs`) |
| A126-2 | No HSTS of Panda's own, no SRI on entry assets | `vercel.json`, `index.html` | HSTS preload, sha384 integrity |
| A126-3 | Actions referenced by tag | all workflows | pinned by SHA, least-privilege permissions, CodeQL, gitleaks, Dependabot, SBOM |
| A126-4 | `npm audit`: happy-dom ≤ 21.0.3 (High), minimatch ReDoS (Moderate), dev tooling only | `package.json` | happy-dom 21.0.4, typescript-eslint 8.72.1, `overrides` minimatch 11.0.5, exact versions |
| A126-5 | **High:** the Android bridge was reachable from provider and ad iframes (pairing code, notifications, downloads, exit) | `MainActivity.kt` | per-launch bridge key given to the top document only (docs/SECURITY.md) |
| A126-6 | Bundled app files served with `Access-Control-Allow-Origin: *` | `MainActivity.kt` | header removed |
| A126-7 | Kids PIN unhashed on the device | `lib/store.ts` | v1.2.7 |
| A126-8 | `allowBackup="true"` | `AndroidManifest.xml` | v1.2.7 |
| A126-9 | Update flow relies on the OS signature check | `UpdateChecker.kt` | v1.2.7 |
| A126-10 | CineSrc's "Rotate your phone" dialog appeared in portrait under Panda's tap layer and could not be dismissed | `pages/player.css` | 16:9 frame in portrait (D-152) |
| A126-11 | Mobile skeleton posters on Lists and Anime had zero size (`--poster-w/h` undefined on phones) | `pages/Lists.tsx`, `pages/Anime.tsx` | phone skeleton class |
| A126-12 | Saved volume, speed and mute were only applied on CineSrc's `ready`, which fast loads can post before Panda listens | `pages/Player.tsx` | applied on the first message of each load |
| A126-13 | The remote's Menu key did nothing while the lazy chrome chunk was still loading, or when focus sat outside the player | `pages/Player.tsx`, `tv/TvPlayerChrome.tsx` | window-level key handler and an open request the chrome consumes when it mounts |
| A126-14 | Audio column volume row overflowed on landscape phones | `tv/tvplayer.css` | `nowrap` control group |
| A126-15 | CodeQL `js/remote-property-injection`: backup keys reached plain objects | `lib/sync.ts` | null-prototype maps and key guards (unit test) |
| A126-16 | CodeQL `js/incomplete-sanitization`: version only partly regex-escaped | `lib/releaseNotes.ts` | full escape |
| A126-17 | CodeQL `js/incomplete-multi-character-sanitization`: one-pass caption tag strip | `lib/captions.ts` | strip until stable (unit test) |
| A126-18 | CodeQL `js/file-system-race` in the build plugin | `scripts/vite-integrity.mjs` | single file descriptor |
| A126-19 | CodeQL `js/reflected-xss` in the local ad-score harness | `scripts/source-adscore.mjs` | allowlist + escaping |

## Audit 2 — state at v1.1.6 (2026-11-08, before v1.1.7)

Inspected: the whole repo, every doc, `package.json` (1.1.6), GitHub Releases (latest `v1.1.6`, signed APK + `.sha256`), Actions (CI green on `a654c86`; emulator check for v1.1.6 running, phone job passed), Vercel production deployments (one per `main` commit, latest `a654c86`), `titan717/movieapi` (`main` at `257338f`, live at `https://apikinoma.vercel.app/api/v1`, `/health` 200), and the Drive blueprint folder `0AIeajh48Vj_sUk9PVA`.

### Verified locally

| Check | Result |
|---|---|
| `npm ci`, `typecheck`, `lint` (0 warnings), `test` | Pass — 18 files, 100 tests |
| `npm run build` | Pass — entry chunk 34.5 KB gzip, TV chunk 9.7 KB, mobile 8.6 KB |
| Backend | `/panda/page/home` returns real data; `/panda/calendar?ids=` live |
| Blueprints | Same 7 files and modified dates as `docs/BLUEPRINTS.md`; no new blueprint since the last cycle (the two `tvnewblueprint.pdf` copies are still identical, D-23) |

### Shipped (do not redo)

v1.0.0–v1.0.9 rebuild, player, Android shell, updater, performance rounds; v1.1.0 personalised Home; v1.1.1 smart search; v1.1.2 cast/crew/collections; v1.1.3 Watchlist 2.0; v1.1.4 Continue Watching 2.0; v1.1.5 Player 2.0; v1.1.6 performance round 3.

### Defects found

| # | Defect | Where | Fix in |
|---|---|---|---|
| A2-1 | Details of a title that is not released yet shows **Watch Now** / **Watch First Episode**, which opens a player with nothing to play (dead button, §1). | `lib/watch.ts` `detailsCtas` | v1.1.7 |
| A2-2 | BLUEPRINT_SPEC 15.4 says the notifications card gives **new-episode reminders for watchlisted shows**; the app only notifies about app updates (D-14), and the card disappears once notifications are on instead of saying "You're all caught up". | `mobile/MMySpace.tsx`, `App.tsx` | v1.1.7 |
| A2-3 | The Android WebView has no `Notification` API, so in the APK the card is hidden and no alert is ever shown. | Android shell | v1.1.7 (native bridge) |
| A2-4 | movieapi already serves `/panda/calendar` (commit `257338f`, "Release calendar (v1.1.7)"), but the app never calls it — v1.1.7 was started and not finished. | frontend | v1.1.7 |
| A2-5 | TV My Space has no way to see upcoming episodes of followed shows. | `tv/TvMySpace.tsx` | v1.1.7 |
| A2-6 | §4.G: adaptive icon has no monochrome layer; no notification icon; R8 shrinking is off (`minifyEnabled false`). | Android | v1.1.7 (icons), v1.1.8 (R8 with JS-bridge keep rules) |
| A2-7 | §5: no `GET /sources/ranking` or rolling success score; the report endpoint only logs. No AniList anime mapping. No embed sandbox attribute. | movieapi, player | v1.2.0 |
| A2-8 | §5: no external subtitle search, caption overlay or subtitle settings (§4.E "Subtitles"). | player, Settings | v1.2.1 ✅ resolved |
| A2-9 | §6: no sync code (Settings "Sync code" in §4.E missing). | all | v1.2.3 ✅ resolved |
| A2-10 | §7: no mood/time picks, Surprise me, Panda TV channel, phone-as-remote, idle screensaver, franchise guides or curated collections. | discovery | v1.2.4–v1.2.8 |
| A2-11 | Retired host: no reference to the retired hosting service in code or docs; the Android renderer-crash callback is written with an escaped capital R (D-90). | — | none |

Verified as already meeting the brief: §4.A black TV background with focus backdrop, §4.B trailer engine (5 s, preload, sound unlock, IFrame params `controls=0 disablekb=1 rel=0 iv_load_policy=3 playsinline`, loop before end, fallback chain), §4.C logos, §4.D poster wall and profile zoom, §4.F typed client / SWR / persistent cache / dedupe, §5 CineSrc with commands + Vidy events, sleep timer and "Still watching?" (v1.1.5).

### Not defects (kept as decided)

Stale remote branches (D-15), Vercel URLs behind deployment protection (D-26), track switching inside the source player (D-33, D-81).

---

## Audit 1 — before the rebuild (commit `b3fd30c`)

### Panda.fun (frontend + Android wrapper)

| Area | Finding | Action |
|---|---|---|
| Web app | Several generations of UI experiments (orbs, "metal" search, movy-style details) layered on each other; no single design system; did not resemble the blueprint. | Rebuilt from scratch against `docs/BLUEPRINT_SPEC.md` (React 19 + Vite, TS strict). |
| Branches | 60+ remote feature/fix branches (`feat/android-tv-*`, `fix/image-loading-*`, `feat/panda-hybrid-experience`, …). The "My Panda hub" work was already merged into `main`; the others were superseded experiments targeting code that no longer exists. | Nothing valid left unmerged; see DECISIONS D-15. |
| Data | Mixed calls to `apikinoma.vercel.app`, a fallback host and direct TMDB. | All data now comes from `titan717/movieapi` (`/api/v1/panda/*`). |
| Playback | Single hard-coded embed, no fallback, no resume, no next-episode. | Unified player with the CineSrc / Vidy source registry, switcher, auto fallback, resume, countdown. |
| Updates | Android read a raw `update/latest.json` committed by CI; web had no update screen. | Android and web read the latest GitHub Release; `update/latest.json` removed. |
| Android | Leftover Retrofit/Compose catalogue (`KinomaApiService`, anime models) unused by the WebView shell; Back key re-implemented navigation; strings branded "MyPanda". | Dead code removed; Back delivered to the web app as Escape; branding fixed; bridge extended (version code, exit, install). |
| CI | Only the release workflow plus stale workflows from deleted branches. | Added `ci.yml` (typecheck, lint, unit, build, Playwright TV + mobile). |
| Secrets | Keystore only in GitHub Secrets (good). No secrets in the repo. | Kept. |

### movieapi (backend)

| Area | Finding | Action |
|---|---|---|
| Endpoints | Generic TMDB proxies; no page composition, no title bundle with seasons/cast/trailers/similar, no Top 10 per language, no multi-provider play route. | Added the `panda` module (`aa6e4bd`, `c235b18`): `/panda/page/{home,movies,tv,kids,new}`, `/panda/title/{type}/{id}`, `/panda/title/tv/{id}/season/{n}`, search, discover, trending, top10, genres, categories, `/panda/play/{type}/{id}`. |
| Hosting | Vercel (`apikinoma.vercel.app`), auto-deploy from `main`; `/health` OK. | Merged to `main`, redeployed, verified live. |
