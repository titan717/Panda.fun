# Audit

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
| A2-8 | §5: no external subtitle search, caption overlay or subtitle settings (§4.E "Subtitles"). | player, Settings | v1.2.1 |
| A2-9 | §6: no sync code (Settings "Sync code" in §4.E missing). | all | v1.2.3 |
| A2-10 | §7: no mood/time picks, Surprise me, Panda TV channel, phone-as-remote, idle screensaver, franchise guides or curated collections. | discovery | v1.2.4–v1.2.8 |
| A2-11 | Render: no `onrender`/Render hosting reference in code; only the Android platform API `onRenderProcessGone` (D-24). | — | none |

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
