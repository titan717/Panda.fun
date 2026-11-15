# Details: seasons and episodes (v1.3.2)

Code: `src/lib/seasons.ts` (pure mapping), `src/tv/TvDetails.tsx` (`EpisodesTab`), `src/mobile/MDetails.tsx` (`EpisodeList`), `src/mobile/MAllEpisodes.tsx`. Tests: `src/test/seasons.test.ts`.

## Labels

- Seasons are always "Season N". Season 0 shows as "Specials", last, and only when it really has episodes.
- The metadata season `name` is never shown. TMDB names some seasons after story arcs (One Piece "East Blue", "Wano Country Arc"; Attack on Titan "The Final Season"; Doctor Who "Series N"); the API passes them through, which is where the old "Arc" labels on TV came from.
- Episodes show "E3 · Title" with the original episode number (One Piece keeps its absolute numbers, e.g. Season 2 starts at E62). Nothing is renumbered or invented; duplicates and episodes from another season are dropped, the rest sorted by number. Gaps in numbering show a short note.
- Empty seasons are hidden unless they have a future air date (shown as upcoming). Unaired episodes show their air date and are not playable.

## Layout

- TV: a vertical season rail (D-pad, ids `season-N`, the selected season has `data-autofocus` and receives focus when entering the rail from the tabs), a header with the season name, episode count, year and the "Resume S2 E5" button (`#ep-resume`), then 16:9 episode cards (`ep-S-E`) with runtime/date, a 2-line overview, progress bar and a "Last watched" badge.
- Phone: horizontal season chips, the same header and resume button, a collapsed list that starts at the last-watched episode, and "View all N episodes" to the full page.
- Missing stills fall back to the backdrop or the `Img` placeholder.
