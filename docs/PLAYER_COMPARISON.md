# Player comparison — CineSrc vs Vidy

The mission names `cinesrc.st` and `vidsty.st`. `vidsty.st` does not resolve (NXDOMAIN, checked 2026-11-08), so the second source is **Vidy** (`vidy.st` → `www.vidy.st`), the same `.st` embed family movieapi already used (D-22). No `vidsrc.*` lookalikes are used.

Docs: [CineSrc](https://cinesrc.st/docs) · [Vidy](https://vidy.st)

## Live test (2026-11-08)

Headless Chromium, autoplay allowed, iframe 1280×720, 25 s per run. Titles: movie **Fight Club** (TMDB 550) and episode **Game of Thrones S1E1** (TMDB 1399). Screenshots are in `docs/screenshots/sources/`.

| Run | First event | Ready | Playing | Duration reported | Time updates / 25 s |
|---|---|---|---|---|---|
| CineSrc movie 550 | 2.25 s `sourceused` | 2.46 s | 2.48 s | 7984 s | 85 |
| CineSrc TV 1399 S1E1 | 2.55 s | 2.77 s | 2.89 s | 3156 s | 83 |
| Vidy movie 550 | 1.33 s `MEDIA_DATA` | — (no ready event) | 2.54 s | 8349 s | 173 |
| Vidy TV 1399 S1E1 | 1.36 s | — | 1.39 s | 3695 s | 179 |

Both play the real title. Vidy starts slightly faster; CineSrc is the only one that can be controlled from our own UI.

## Capabilities

| | CineSrc | Vidy |
|---|---|---|
| URL | `/embed/movie/{id}`, `/embed/tv/{id}?s=&e=` | `/movie/{id}`, `/tv/{id}/{s}/{e}` |
| Start position | `t=` seconds | `progress=` seconds |
| Autoplay with sound | `autoplay=true` (+`muted`) | `autoplay=true` |
| Theme colour | `color=%23hex` | `color=hex` |
| Hide native controls | `controls=false` | no |
| Quality hint | `quality=1080/720/480` | no |
| Provider auto-next | `autonext=false` (we run our own) | `autoplayNextEpisode` off by default |
| Events | `cinesrc:ready/play/pause/timeupdate/seeked/ended/volumechange/loadedmetadata/nextepisode/close/error` | JSON string `{type:"PLAYER_EVENT", data:{event, timestamp, duration}}` + `MEDIA_DATA` |
| Commands | `{type:"cinesrc:command", command, args}`: play, pause, seek, setVolume, setMuted, setPlaybackRate, getters | none |
| Audio / subtitle switching | inside the embed only | inside the embed only |
| Embeddable | yes | yes (CSP is only `upgrade-insecure-requests`) |

## How the player uses them

- **Registry:** movieapi `SOURCE_ADAPTERS` (`/api/v1/panda/play`) and `src/lib/player.ts` `ADAPTERS` hold the URL builder, event protocol and capabilities of each source. Order: CineSrc, then Vidy.
- **Health:** `/api/v1/panda/sources/health` probes each source (6 s timeout, cached 5 min). Unhealthy sources drop to the end of the list.
- **Fallback:** if a source does not report ready or play within 15 s, or emits an error, the next one loads at the same position and a toast says "Switched to Vidy".
- **Preference:** the last source picked by hand is remembered and tried first.
- **Controls:** with CineSrc our overlay drives play, pause, seek, volume and speed. With Vidy only the embed's own controls work, so our overlay shows just Back, the source switcher and episodes.
- **Sandbox:** iframes get `allow="autoplay; fullscreen; encrypted-media"` and `referrerpolicy="origin"`. Popups opened by embeds are blocked by the Android WebView (`setSupportMultipleWindows(false)`).

## Choice

CineSrc is the primary source: it reports events, takes commands, can hide its own controls (needed for the TV PLAYER blueprint chrome) and accepts a quality hint. Vidy is the automatic fallback.

## v1.0.4 custom TV chrome

On TV, CineSrc loads with `controls=false` and Panda draws the TV PLAYER blueprint chrome itself (`src/tv/TvPlayerChrome.tsx`), driving the embed through the `cinesrc:command` postMessage API (play, pause, seek, setMuted) and reading `timeupdate`/`play`/`pause`/`ended`. Vidy accepts no commands, so it keeps its own controls and the chrome shows title, panels and Watch Next with a hint to use the source controls. Mobile keeps the v1.0.3 player unchanged.
