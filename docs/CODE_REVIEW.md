# Code review log

One review per release (MASTER V4 §10). Each entry lists what was read, what was found and how it was fixed.

## v1.2.4

Read: `src/components/Trailer.tsx`, `src/lib/youtube.ts`, `src/lib/hooks.ts` (trailer stage), `src/pages/Player.tsx` (new states), `src/lib/shield.ts`, `src/lib/player.ts`, `scripts/source-adscore.mjs`, backend `src/panda/ranking.ts`.

| Finding | Fix |
|---|---|
| A trailer that left `play` (focus moved) was only hidden, not paused: it kept playing, and with sound if it had been unmuted, until unmounted. | `play=false` now cancels the pending reveal, pauses, mutes and hides (D-143). |
| The trailer was unmuted at `playVideo()`, so sound could be heard while the frame was still hidden. | Sound is applied only after the reveal; before that the player is muted at volume 0. |
| A YouTube ENDED event hid the frame before looping, which flashed the backdrop. | Loops keep the frame visible; the stall watchdog ignores 2.5 s after a loop seek. |
| A reveal timer from an earlier play could show the frame after play was turned off and on again. | Reveal timers carry a generation number and are cancelled on every hide, stop, key change and unmount. |
| A stuck `setTimeout` retry after start was never cleared on unmount. | Stored and cleared. |
| The ad-score script trusted play events from VidLink even while it showed "Please Disable Sandbox". | The script reads each frame's text and marks the row refused. |
| The backend ranking tiers were a hard-coded table, so the weekly measurement could not change them. | The backend reads `tiers` from `docs/sources/adscore.json` on main (6 h cache, played-only). |
| e2e specs set a non-existent pref `autoplayTrailers`; the real key is `trailerAutoplay`. | New specs use `trailerAutoplay`. |
