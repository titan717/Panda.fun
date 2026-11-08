# Phase 2 — Plan

1. **Spec** — turn the 99 blueprint photos (tv1, tv2, mobile) into `docs/BLUEPRINT_SPEC.md` and design tokens (`src/styles/tokens.css`).
2. **Backend** — add the Panda aggregation routes to movieapi so every screen needs one request (page, title, season, search, play). Merge to `main`, let Vercel redeploy, verify.
3. **Foundation** — Vite + React 19 + TS strict; `lib/` for API (SWR, retry, cache), store (profiles, My List, progress, prefs in `localStorage`), device/input detection, key mapping (incl. webOS 461 / Tizen 10009), spatial navigation (`@bbc/tv-lrud-spatial`).
4. **TV views** — rail, hero with trailer, rows with focus expansion, details (tabs, seasons, cast, similar, trailers), search, categories, My Space.
5. **Mobile views** — bottom nav, hero carousel, rows, Top 10, search (recent, popular, results, filters), details, categories, My Space.
6. **Shared pages** — splash, profiles (select/manage/edit), My List, Continue Watching, Player, Settings (+ Check for Updates), About, Privacy, Terms, error/empty/offline states.
7. **Player** — one component, three sources, switcher, auto fallback, resume, next-episode countdown, remembered source/volume, remote keys.
8. **Android** — WebView shell loads the bundled build; GitHub-Releases updater with checksum; signed release workflow.
9. **QA** — Playwright screenshots at every required viewport, compare against blueprint, fix, repeat; CI smoke.
10. **Ship** — merge to `main`, Vercel production (Git integration), signed release `v1.0.0`, README and docs.
