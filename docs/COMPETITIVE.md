# Competitive notes

Reviewed each release. Ideas are only adopted when they fit the blueprints.

## v1.0.2 round (2026-11-08)

| App | Observation | What Panda takes from it |
|---|---|---|
| Netflix | Preview autoplay is a per-profile setting and is not supported on some older TVs ([Netflix Help](https://help.netflix.com/en/node/2102)). | Trailer autoplay and sound are per-profile settings; low-memory TVs get a slow backdrop zoom instead of video (v1.0.3). |
| Apple TV (tvOS 26) | New Liquid Glass design, cinematic poster art and easier profile choice ([Apple Support](https://support.apple.com/en-us/106336)); personalised "Genius Browse" in tvOS 26.4 ([Apple guide](https://support.apple.com/en-mide/guide/tv/atvb457e13ae/26/tvos/26)). | Glossy pill focus from the player blueprint; quick profile switching from the rail avatar. |
| Disney+ | January 2026 redesign with a refreshed look, easier navigation and personal recommendations ([Disney+](https://www.disneyplus.com/explore/articles/disney-plus-app-redesign-new-features)). | Personalised home rows (v1.1.0). |
| Streamyfin | Jellyfin client with downloads, skip intro and credits, and trickplay images ([Jellyfin clients](https://jellyfin.org/downloads/clients/all/)). | Skip intro uses CineSrc's `skipintro` event (v1.1.5); trickplay needs frames that embeds don't give (D-25). |
| Nuvio | Open-source player that keeps library, profiles and watch progress in sync across phone, desktop and TV ([Nuvio FAQ](https://nuvio.tv/faq)). | Continue Watching stored per profile (v1.0.8). |
| Plex | The redesigned app drew complaints for removed features on Apple TV and Android TV ([user report](https://unveroleone.com/blog/plex-new-app-rollback-alternatives)). | Never remove a working feature during a redesign; the mobile non-regression suite guards this. |

## v1.0.3 round (2026-11-08)

| App | What we checked | What we adopted |
|---|---|---|
| Netflix TV | Hero/row trailers start after a dwell, title logo shrinks, synopsis fades, sound on after first interaction. | Same staging: 5 s dwell (configurable), 3 s preload, logo scale 0.72, synopsis fade. |
| Disney+ / Hotstar TV | Profile picker over a dark, slowly moving artwork wall. | Drifting tilted poster wall, mostly black under a vignette. |
| Prime Video TV | Mute toggle on the hero, remembered between sessions. | Per-profile trailer sound toggle on the hero and mobile details. |

## v1.0.4 round (2026-11-08)

- Netflix and Prime Video (TV): their players use one thin track with time remaining on the right, no visible play button (OK toggles), and accelerating scrubbing with thumbnail previews. Panda copies the blueprint version of this: a 3-tile seek strip and 10/30/60 s steps while a key is held.
- Prime Video and Disney+: the source/quality/audio settings live in right-side sheets that dim the video instead of stopping it. Panda's Quality and Audio & Subtitles sheets follow the blueprint gradient sheets.
- YouTube TV / Apple TV: Back closes the innermost layer first (panel → scrub → chrome → exit). Panda uses the same order.
- Netflix's "Report a problem" sends the playback context automatically. Panda's Report an Issue sends source and position, then fixes the problem right away by switching source.

## v1.0.5 round (2026-11-08)

- Netflix, Prime Video and YouTube on Android TV all show a branded full-bleed splash from the very first frame (window background), then hand over to the app with no colour jump. Panda now does the same: native window, boot HTML and React splash share one gradient.
- Netflix and Disney+ show a one-time "What's new" card after an update and never on a fresh install. Panda copies this (D-39).
- Lightweight TV apps such as Jellyfin's Android TV client and Kodi web remotes keep first-load bundles small to stay fast on cheap Amlogic boxes. Panda's first load is now ~54 KB gzip of JS.

## v1.0.6 round (2026-11-08)

- Netflix on Android TV expands the focused row tile into a wide card showing the title's backdrop, logo, metadata and synopsis. The Panda blueprint shows the same, and Panda now renders the real backdrop instead of a dimmed poster.
- Netflix, Prime Video and Google TV prefetch the artwork next to the focused tile, so a fast scroll never shows blank tiles. Panda now warms the next rows' posters and the neighbouring backdrops.
- Google TV and Netflix announce tiles to TalkBack with title, type and position. Panda cards now read "Title, year, Movie/Series, rating, n of m", and each row is labelled by its heading.
- Shimmering placeholders shaped like the real layout, not a spinner, are standard (YouTube, Netflix). Panda's TV home skeleton now mirrors the hero, poster and landscape rows, and each card shimmers until its art is decoded.

## v1.0.7 round (2026-11-08)

- Android TV and Google TV offer system-wide text scaling and high-contrast text; Netflix and Prime Video follow the system font scale on TV. Panda now has its own Text size, Screen size, Reduce motion and High contrast settings per profile, because a WebView ignores parts of the system setting.
- Google TV and Netflix start voice search from the remote's mic button through the system recogniser. Panda's mic now does the same inside the app.
- Netflix's TV search does not pop a keyboard when you arrive; you browse suggestions first. Panda's field now waits for OK before opening the keyboard, and has a Clear button so deleting a query with a remote is one press.
- Netflix and Prime list upcoming episodes with their release date, not as playable tiles. Panda now shows "Coming <date>" and blocks play.
- Stremio and Kodi-style apps show provider status; Panda's Sources settings show live health and latency for CineSrc and Vidy.

