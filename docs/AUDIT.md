# Phase 1 — Audit

Snapshot of the repositories when the mission started (before the rebuild in commit `b3fd30c`).

## Panda.fun (frontend + Android wrapper)

| Area | Finding | Action |
|---|---|---|
| Web app | Several generations of UI experiments (orbs, "metal" search, movy-style details) layered on each other; no single design system; did not resemble the blueprint. | Rebuilt from scratch against `docs/BLUEPRINT_SPEC.md` (React 19 + Vite, TS strict). |
| Branches | 60+ remote feature/fix branches (`feat/android-tv-*`, `fix/image-loading-*`, `feat/panda-hybrid-experience`, …). The "My Panda hub" work was already merged into `main`; the others were superseded experiments targeting code that no longer exists. | Nothing valid left unmerged; see DECISIONS D-15. |
| Data | Mixed calls to `apikinoma.vercel.app`, a fallback host and direct TMDB. | All data now comes from `titan717/movieapi` (`/api/v1/panda/*`). |
| Playback | Single hard-coded embed, no fallback, no resume, no next-episode. | Unified player with CineSrc / VidSrc / mirror, switcher, auto fallback, resume, countdown. |
| Updates | Android read a raw `update/latest.json` committed by CI; web had no update screen. | Android and web read the latest GitHub Release; `update/latest.json` removed. |
| Android | Leftover Retrofit/Compose catalogue (`KinomaApiService`, anime models) unused by the WebView shell; Back key re-implemented navigation; strings branded "MyPanda". | Dead code removed; Back delivered to the web app as Escape; branding fixed; bridge extended (version code, exit, install). |
| CI | Only the release workflow plus stale workflows from deleted branches. | Added `ci.yml` (typecheck, lint, unit, build, Playwright TV + mobile). |
| Secrets | Keystore only in GitHub Secrets (good). No secrets in the repo. | Kept. |

## movieapi (backend)

| Area | Finding | Action |
|---|---|---|
| Endpoints | Generic TMDB proxies; no page composition, no title bundle with seasons/cast/trailers/similar, no Top 10 per language, no multi-provider play route. | Added the `panda` module (`aa6e4bd`, `c235b18`): `/panda/page/{home,movies,tv,kids,new}`, `/panda/title/{type}/{id}`, `/panda/title/tv/{id}/season/{n}`, search, discover, trending, top10, genres, categories, `/panda/play/{type}/{id}`. |
| Hosting | Render, auto-deploy from `main`; `/health` OK. | Merged to `main`, redeployed, verified live. |
