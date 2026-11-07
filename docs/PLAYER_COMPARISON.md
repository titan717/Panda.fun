# Player comparison — CineSrc vs VidSrc

Both providers are iframe embeds keyed by TMDB id. movieapi's `/api/v1/panda/play/{type}/{id}?s=&e=&t=` returns every source with its URL, origin and event protocol, and the web `Player` page (`src/pages/Player.tsx`, `src/lib/player.ts`) drives all of them through one interface.

Docs: [CineSrc](https://cinesrc.st/docs) · [VidSrc](https://vidsrc.sh/vidsrc/docs/)

| | CineSrc (`cinesrc.st`) | VidSrc (`vidsrc.sh`) | VidSrc mirror (`vidsrc.to`) |
|---|---|---|---|
| URL | `/embed/movie/{id}`, `/embed/tv/{id}?s=&e=` | `/embed/movie/{id}`, `/embed/tv/{id}/{s}/{e}` | `/embed/movie/{id}`, `/embed/tv/{id}/{s}/{e}` |
| Start position | `t=` seconds | `startAt=` seconds | not supported |
| Autoplay | `autoplay=true` | `autoplay=1` | default |
| Theme colour | `color=` (we pass `#1f80e0`) | — | — |
| Auto next | `autonext=` (we force `false`) | `autonext=` (we force `0`) | — |
| Events to parent | `postMessage` `{type:"cinesrc:*"}`: ready, play, pause, timeupdate, seeked, ended, nextepisode, close, error | `postMessage` `{type:"PLAYER_EVENT", data:{player_status, player_progress, player_duration}}` | none |
| Commands from parent | `{type:"cinesrc:command", command, args}`: play, pause, seek, setVolume | `{player:true, action}`: play, pause, seek±N, mute/unmute | none |
| Volume control | yes (absolute) | mute/unmute only | no |
| Progress sync / resume | yes | yes | no (resume position cannot be read or set) |
| Remote friendliness | Good — `back=close` emits `cinesrc:close` which we map to Back | Good | Usable; only our overlay controls work |
| Response | 200 directly, no redirects | 200 directly | 200 directly |

## How the unified player uses them

- **Order and preference:** `cinesrc → vidsrc → vidsrc-mirror` (`SOURCE_ORDER`). The last source the user picked manually is remembered (Settings › Playback) and tried first.
- **Automatic fallback:** if a source does not report ready within 15 s (`READY_TIMEOUT_MS`) or emits an error, the next source loads at the same position and a toast names the switch. Sources without events (mirror) are treated as ready on iframe load.
- **Switcher:** the "Source" menu in the player lists all three with the active one marked.
- **Resume:** progress events are saved to Continue Watching every few seconds; reopening passes `t` / `startAt`.
- **Next episode:** provider auto-next is disabled so our own 10-second "Next episode" countdown (cancellable, Enter to skip) works the same on every source; previous/next episode buttons in the overlay.
- **Remote keys:** play/pause, fast-forward/rewind (±10 s), Enter, Back (Backspace, Escape, Android Back, webOS 461, Tizen 10009) are mapped to the commands above; Back exits the player.

## Choice

CineSrc is the default: it has the richest event protocol (absolute volume, close event, episode events) and accepts our theme colour. VidSrc is the first fallback with near-equal resume support. The mirror is a last resort and documented as having no progress sync.
