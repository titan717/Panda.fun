# Player

The player is Panda's own UI on top of a provider's embed. Every control on screen is Panda's; the provider's own controls are hidden wherever the provider allows it (`ADAPTERS[source].hideControls`). This file lists what each embed actually exposes, what Panda builds on top of it, and what cannot be done. The TV PLAYER blueprint is the reference for layout (DECISIONS D-138).

## What each embed exposes

Researched against the providers' own documentation on 2026-11-09 and checked against real embed traffic in the e2e stand-ins.

| | CineSrc ([docs](https://cinesrc.st/docs)) | Vidy / Vidy Anime ([vidy.st](https://vidy.st/)) | VidLink ([vidlink.pro](https://vidlink.pro/)) |
|---|---|---|---|
| URL parameters | `seek`, `t`/`time`, `autoplay`, `muted`, `color`, `controls`, `back`, `autonext`, `autoskip`, `prioritize`, `lastserver`, `continueprompt`, `quality`, `febbox` | `color`, `progress`, `autoplay`, `nextEpisode`, `episodeSelector`, `autoplayNextEpisode` | `primaryColor`, `secondaryColor`, `icons`, `iconColor`, `title`, `poster`, `autoplay`, `nextbutton`, `player`, `startAt`, `sub_file`, `sub_label`, `fallback_url`, `fallback` |
| Events (postMessage to Panda) | `ready`, `play`, `pause`, `timeupdate`, `seeking`, `seeked`, `ended`, `volumechange`, `ratechange`, `loadedmetadata`, `nextepisode`, `skipintro`, `sourceused`, `close`, `error`, `response` | `PLAYER_EVENT` (`timeupdate`, `play`, `pause`, `ended`) and `MEDIA_DATA` as JSON strings | `PLAYER_EVENT` (`play`, `pause`, `seeked`, `ended`, `timeupdate`) and `MEDIA_DATA` (same format as Vidy; the backend sets `events: "vidy"`) |
| Commands (Panda to embed) | `play`, `pause`, `seek`, `setVolume`, `setMuted`, `setPlaybackRate` (0.25–2), plus getters | none | none |
| Audio tracks, subtitle tracks, quality levels, buffer level, orientation | not exposed | not exposed | not exposed (`sub_file` only hands one subtitle file in) |

Every message is accepted only when `event.source` is the player's own iframe and `event.origin` matches the source's registered origin (`parseMessage(source, origin, data)`).

## What Panda builds on top

| Feature | CineSrc | Vidy | VidLink | How |
|---|---|---|---|---|
| Custom chrome (seek bar, title, panels) | yes | yes (progress only) | yes (progress only) | provider controls hidden; Panda's chrome over the frame |
| Play / pause, seek, ±10 s, accelerating seek | yes | no | no | `play`/`pause`/`seek` commands; Vidy and VidLink keep their own controls for these |
| First-frames screen ("Buffering the first seconds…" with %) | yes | yes | yes | estimate, see below |
| Seek-bar chapters (Recap, Intro, Credits) and skip buttons | yes | markers only | markers only | `/panda/segments` (IntroDB) plus intros learnt on this device; skipping needs `seek` |
| Next episode countdown, episode list, Watch Next | yes | yes | yes | Panda's own data; Vidy and VidLink episode changes reload the embed |
| Source switcher, Report broken source | yes | yes | yes | Panda's source registry |
| Quality picker | yes | – | – | CineSrc `quality` URL parameter (reloads at the current position) |
| Speed | yes | – | – | `setPlaybackRate` |
| Picture fit (Fit / Fill / Stretch) | yes | – | – | scales the frame (D-151) |
| Volume steps and Sound off | yes | – | – | `setVolume`, `setMuted` |
| Mute memory | yes | – | – | `panda:muted`, applied on the first message of every load |
| Subtitles (Panda's renderer) | yes | yes | yes | needs a clock (`timeupdate`); VidLink also gets `sub_file` |
| Lock controls (phones) | yes | yes | yes | Panda's tap layer |
| Sleep timer, Still watching? | yes | yes | yes | Panda's clock |
| Picture-in-picture | Android app on phones and tablets | same | same | native PiP (D-127); browsers cannot put a cross-origin iframe in PiP |

Panda hides every control a source cannot honour instead of showing it disabled: the Quality panel has no quality list for Vidy, the Audio column has no volume row without commands, and so on.

## Audio limits (D-154)

None of the three embeds exposes its audio tracks, so **track and language selection, a per-profile default audio language, volume boost above 100 %, night mode / loudness normalisation and an audio sync offset cannot be built**: the media element lives inside a cross-origin frame, so Panda cannot reach it or route it through Web Audio. What is possible is built: volume in 10 % steps, Sound off and its memory. CineSrc's own server picker sometimes offers dubbed servers; they stay in CineSrc's own menu, reachable from the Audio & Subtitles panel with "Choose in source player".

## First-frames screen (D-150)

No embed reports buffering progress, so the percentage is an honest estimate, never a fake 100 %:

- before a source is chosen it creeps from 0 to 10 % ("Finding the best source…");
- then it follows `10 + 85 · (1 − e^(−t/τ))` with `τ` = this device's median time to first frame for that source divided by 1.5 (falling back to measured defaults: CineSrc 2.6 s, Vidy 1.5 s, Vidy Anime 2.0 s, VidLink 8.0 s), capped at 95 %;
- it jumps to 100 % only when the embed reports `ready` or the first progress, then fades out over 500 ms.

The screen is `role="progressbar"` with `aria-valuenow`, shows the title, "Season X, Episode Y · episode title" and the source name, and has a Back button on touch screens.

## Picture fit (D-151)

Fill and Stretch scale the iframe with a CSS transform, assuming the stream is 16:9 (the embeds do not report the video size). Fill zooms until no bars remain; Stretch scales one axis. The choice is remembered on the device (`panda:fit`) and applied only with Panda's own controls on TV or in landscape.

## Phones in portrait (D-152)

In portrait the frame is a centred 16:9 box instead of filling the screen. CineSrc shows a "Rotate your phone" dialog when its frame is taller than wide, and that dialog sat under Panda's tap layer where it could not be dismissed.

## Remote keys (TV)

| Key | Action |
|---|---|
| OK / Enter | play / pause, or the focused control |
| Left / Right | seek; held or tapped quickly the step grows 10 → 20 → 30 → 60 s (D-140) |
| Up / Down | move between the seek bar and the controls |
| Menu (ContextMenu) | opens the quick panel (Quality, source, speed, picture), even while the chrome is still loading |
| Play/Pause, Play, Pause, Fast-forward, Rewind | media keys |
| Back | closes the open panel, then hides the chrome, then leaves the player |

## Tests

`src/test/v124*.test.ts`, `src/test/v126.test.ts` (logic) and `e2e/v124-player.spec.ts`, `e2e/v126.spec.ts`, `e2e/subtitles.spec.ts` (stand-in CineSrc embed that reports `ready`, progress and records the commands it receives).
