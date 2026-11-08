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

## v1.0.8 round (2026-11-08)

- Netflix and Disney+ Kids profiles cap titles by maturity rating, not only by genre, and block deep links to anything above the cap. Panda's Kids profiles now check the rating and show a clear blocked screen.
- Netflix moves a finished episode's Continue Watching tile to the next episode. Panda now does the same and labels it "Next Episode".
- Google TV's watchlist and Netflix's My List on TV can be filtered and edited with the remote. Panda's My Space now has Movies/Shows filters, three sort orders and a remove mode.
- Netflix's Manage Profiles is a plain list; Prime Video shows profile activity. Panda shows each profile's saved and in-progress counts.

## v1.0.9 round (2026-11-08)

- YouTube and Netflix on the web open instantly on a repeat visit because their app shell is cached. Panda now has a service worker for the shell, scripts and artwork.
- Netflix and Prime Video on 4K TVs load sharper artwork than on 1080p. Panda now steps artwork up one size on 4K screens only.
- Netflix resumes a stalled stream when the connection returns and YouTube shows a "Back online" notice. Panda does both now, and also retries every row that failed while offline.

## v1.1.0 round (2026-11-08)

- Netflix's "Because you watched" and Prime Video's "Top picks for you" are the rows people use most to find something new. Panda now builds both from the profile's own history, Watchlist and ratings, on the device.
- Netflix and Disney+ show "Coming Soon" on the main Home screen, not only in a separate tab. Panda's Home now has a Coming Soon row.
- Netflix's thumbs down removes a title from your rows. Panda's dislike now does the same everywhere on Home.

## v1.1.1 round (2026-11-08)

- Netflix and Prime Video both forgive typos and match actor names in search. Panda now corrects misspellings and puts an actor's best-known titles first.
- Google TV understands phrases like "90s action movies". Panda's search now turns language, decade, genre and type words into a filtered list.
- Disney+ and Netflix show genre shortcuts on the empty search screen. Panda shows Browse by Genre chips there, and they respect Kids profiles.

## v1.1.2 round (2026-11-08)

- Prime Video (X-Ray) and Apple TV let you open an actor and see what else they are in. Panda's Cast now opens a person page with their best-known titles.
- Apple TV and Plex show directors and writers next to the cast. Panda lists key crew after the actors.
- Plex and Apple TV group film series. Panda shows a movie's collection in order, with the one you are viewing marked.
- Google TV shows a rating with its source. Panda shows the TMDB rating with its vote count.

## v1.1.3 round (2026-11-08)

- Letterboxd and Plex let you keep many named lists. Panda now has up to 12 lists per profile next to the Watchlist, with one-press name suggestions for the TV remote.
- Netflix and Prime Video open a quick menu when you long-press a title on a phone. Panda's long-press opens quick actions: play, save to lists, move to top, mark as watched and remove.
- Google TV and Apple TV let you mark something as watched. Panda's "Mark as watched" takes it off the Watchlist and counts it for "Because you watched".
- Plex shows list covers built from posters. Panda's list cards show a three-poster collage.
