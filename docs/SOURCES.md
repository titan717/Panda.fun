# Playback sources

Panda uses only documented, publicly offered embed players. It never extracts, downloads or proxies streams. Order of use: ad tier first, then the community ranking inside a tier (D-136).

## Tiers

| Tier | Rule (measured by `scripts/source-adscore.mjs`) | Used |
|---|---|---|
| 1 | Plays inside Panda's strict iframe sandbox with no popup, redirect or app launch | First |
| 2 | Plays only without a sandbox, but opened no popup, redirect or app launch | Next |
| 3 | Opens popups or redirects; in the Android app the native shield consumes them | Labelled "Ads possible"; never chosen automatically on TV; in browsers counted as tier 4 (no shield for an unsandboxed frame) |
| 4 | More than 2 popups/redirects, or never started | Only when every other source failed |

## Measurement 2026-11-09

Each source's real embed was loaded for Fight Club (TMDB 550), Game of Thrones S1E1 (TMDB 1399) and One Piece episode 1 (MAL 21) in a 1280×720 host page with Panda's sandbox, the frame centre was clicked twice like a viewer pressing play, and popups, top-level navigations, `intent:`/`market:` attempts, requests to ad/tracker hosts (StevenBlack unified hosts list) and time to first playback event were counted over 22–25 s. Raw data: [`docs/sources/adscore.json`](sources/adscore.json); screenshots: `docs/screenshots/sources/`.

| Source | Sandbox | Popups | Redirects | Ad/tracker requests | First play | Tier |
|---|---|---|---|---|---|---|
| CineSrc (`cinesrc.st`) | strict, plays | 0 | 0 | 3 (usrpubtrk.com, adexchangerapid.com) | ~3.0–4.3 s | 1 |
| Vidy (`vidy.st`) | refuses, plays without | 0 | 0 | 1 (Cloudflare Insights) | ~1.4 s (anime 6.5 s) | 2 |
| Vidy Anime | as Vidy | 0 | 0 | 1 | 6.5 s | 2 |
| VidLink (`vidlink.pro`) | refuses ("Please Disable Sandbox") | 1–2 on first click | 0 | 20–23 (adsco.re, rapidadexchange.com, usrpubtrck.com, Yandex Metrica, Clarity, Google Tag Manager, Bing) | 8.2 s, or did not start | 3 |

Notes, honestly: Vidy's anime streams carry a burned-in "YIFY-TORRENTS" text in some episodes; VidLink's anime route (MAL 21) did not start within 22 s in either run; VidLink sometimes keeps sending play events behind its sandbox wall, so the script reads the frame text and counts that as "refused". Ad requests are counted, not blocked, in this measurement.

## Weekly update

`.github/workflows/source-adscore.yml` runs every Monday 03:17 UTC (and on demand), commits the new `adscore.json` and screenshots to main, and writes a summary table to the run. The file's `tiers` block is read by the backend (`titan717/movieapi`, `GET /api/v1/panda/sources/ranking`, cached 6 h), which merges it over its built-in table; a measurement only counts for a source that played in that run (D-137).

## In the app

- `src/lib/shield.ts` `rankSources`: tier first (effective tier: unshielded tier ≥ 3 → 4), then community score; `lastResortOnly` keeps tier 4 out of automatic picks.
- Settings › Playback › Community ranking lists every source with its tier badge and measured popups/ad requests; the TV player's source panel and the phone source pills show the tier label.
- VidLink parameters: `autoplay`, `title=false`, `poster`, theme colours, `startAt` (resume), `sub_file`/`sub_label` (Panda's cleaned subtitle, HTTPS only) — from the [VidLink documentation](https://vidlink.pro).
