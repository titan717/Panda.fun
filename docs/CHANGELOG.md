# Changelog

Every stable release of Panda.fun. The same notes ship in each GitHub Release and in Settings › What's New.

## 1.2.0

- **New Anime page**: Categories › Anime (and "See all" on the TV Shows page's Anime row on phones) opens a page built from AniList: what is trending, the current season, all-time favourites, anime films and what's coming next. Cards show when the next episode airs ("Ep 6 in 2d") or the AniList score and studio, and every card opens the normal Panda title page.
- **Vidy Anime source**: Japanese animation can now also play from Vidy's anime player, which follows AniList's seasons and episode numbering. Panda matches each TMDB season to the right AniList entry, so season 2 episode 3 opens season 2 episode 3.
- **Automatic source choice**: Settings › Sources has a new default, Automatic, which starts with the source that is working best for Panda viewers right now. Picking CineSrc or Vidy still works as before. Choosing a different source inside the player only changes that play.
- **Community ranking**: every play that starts, and every problem you report, feeds a shared ranking (a Wilson score where older results fade over 72 hours). Settings › Sources shows the ranking with a bar per source, and the player's source lists show how reliable each one is ("97% reliable", "Reported 4× today", "Not responding") together with what it can do (Panda controls, quality, resume, anime catalogue).
- **Report an Issue everywhere**: the Report button now also appears on phones and on sources with their own controls. Pick "Video won't play", "Wrong title or episode", "Audio and video out of sync" or "Subtitles"; the first three also switch to the next source for you. Only the source, the title id and the issue are sent.
- **Faster first load**: validators for pages you open later (cast, anime, calendar, source status) moved out of the start-up code, so the entry JavaScript is smaller than in 1.1.9 (26.0 → 25.9 KB gzip) even with the new features.

Ads that a provider draws inside its own video still cannot be removed from outside its player; Panda's ad shield keeps blocking popups, redirects and app launches as before.

## 1.1.9

- **Personalize Home**: a new section in Help & Settings lets each profile reorder Home (Continue Watching, Top Picks, Top 10, Because You Watched, Shows You Watched and Panda's rows), hide whole sections or single rows such as Coming Soon, and reset everything in one step. On TV the up and down arrows keep focus, so a row can be pushed several places with repeated presses.
- **Compact cards**: Settings › Display › Card size › Compact fits more titles in every row and grid, on TV (250 × 333 posters instead of 300 × 400) and on phones (four posters across instead of three). Standard keeps the blueprint size and is still the default.
- **Trailers your way on TV**: a new "Trailers behind rows" switch keeps trailers on the hero and Details but stops them behind the rows while you browse.
- **Smaller, faster Android app**: release builds are now shrunk and optimised with R8, so the download is 61 % smaller (11.7 MB → 4.5 MB) and starts with less code to load. The web bridge and update checker are kept intact.
- **Smoother feel**: pages fade in instead of popping, and on phones posters, tiles and buttons press in slightly under your finger.
- **Faster first load**: the Home row builder no longer loads before the profile picker, and the player's prompt styles load with the player (entry JavaScript 28.9 → 26.0 KB, styles 22.1 → 21.6 KB gzip).

## 1.1.8

- **Who's watching, redesigned**: the profile picker now matches the blueprint, with your profiles standing on a glowing horizon line, an upright band of posters behind them, and brighter names that light up as you move.
- **Collection pages**: open any movie collection from Details (the "View collection" tile on TV, the collection title on phones) to see every part in order, play the next one you haven't finished, and add the whole collection to your Watchlist in one step.
- **Continue Watching fills the screen**: on TV the grid now uses four columns at every size, and titles without wide artwork show their poster instead of a blank tile, on TV and phones.
- **What's New and updates that always load**: release notes now come with the app, update checks fall back to Panda's own server when GitHub is busy, notes are easier to read with a bold headline per change, and on TV the text is sized for the couch and scrolls with the remote.
- **Clearer empty and error screens**: empty Watchlist, Continue Watching, Coming Up and error screens are centred, with a larger icon and a pill button, sized for the TV and for phones.
- **Easier filters on phones**: filter chips that run past the edge of the screen now fade out, so it's clear you can scroll for more.
- **Faster start**: the first download is smaller again (entry JavaScript 29.6 → 28.9 KB, styles 22.65 → 22.1 KB gzip).

## 1.1.7


- **Ad shield**: tapping or clicking a video no longer opens ad tabs, popups or redirects. Sources run in a sandbox, the first tap never reaches the provider page, and on Android new windows, off-site navigation and known ad and tracker hosts are blocked. Settings › Sources › Ad shield shows how many were stopped. Honest limit: ads drawn inside a provider's own video stream cannot be removed from an embedded player; sources that keep showing them are ranked lower automatically.
- **New TV sidebar**: the rail now matches the blueprint. It opens as an overlay panel with labels, sub-items for TV Shows, Movies and New & Hot, a glowing highlight on the current section, and Right or Back returns you exactly where you were.
- **Release calendar and reminders**: a new Calendar page lists new episodes and upcoming releases for everything you follow. Tap Remind on any upcoming title, and allow notifications to hear about new episodes.
- **Badges and "for you" rows**: posters show NEW EPISODE, OUT NOW or a bell for titles you are reminded of, and New & Hot gains "New Episodes for You" and "Coming Up for You".
- **Search to the blueprint**: on phones, Recent Searches with posters and "Popular Searches in" tabs (India, Hot & New, Movies, Shows); on TV, a 6-column results grid.
- **Player panels to the blueprint**: the TV Quality and Audio & Subtitles panels use the blueprint's blue sheet and glossy focus pill, new top-bar icons, and a warning icon for Report an Issue.
- **Help & Settings to the blueprint**: plain rows with inset dividers on phones, a Notifications header in My Space, and "Continue Watching for <your name>".
- **Faster start**: the first download is smaller than in 1.1.6 (entry JavaScript 34.4 → 29.6 KB, styles 22.95 → 22.65 KB gzip). Calendar, lists and page styles now load only when needed.

## 1.1.6


- **Smart preloading**: on mobile, posters start loading the moment you touch them, and Details warms the source connection, skip markers and the current season in the background.
- **Network aware**: preloading pauses on Data Saver, 2G and when the Data Saver quality is selected.
- **New setting**: Settings › Data & storage › Preload titles (Smart / Wi-Fi only / Off), saved per profile.
- **Lighter mobile player**: the TV-only player controls are now split into their own bundle (11.2 → 8.1 KB gzip).
- **Bounded memory on TV**: the in-memory cache is capped at 240 entries, and a TV memory soak test confirms no DOM or listener leaks.


## 1.1.5


- **Skip Intro / Skip Recap**: a pill appears during published intro and recap markers (IntroDB), plus intros Panda learns per show when you skip them yourself.
- **Next-episode card** slides in when the credits start, with a countdown and one-press play.
- **Playback speed 0.5×–2×** in the TV Quality panel and the mobile options sheet, remembered per profile.
- **Sleep timer**: 15 / 30 / 45 / 60 min or End of episode, followed by an "Are you still watching?" check.
- **Settings › Playback**: Skip intros and recaps automatically, default playback speed, and Forget learned intros.


## 1.1.4

- Per-episode progress bars, time left and Watched pills — every episode resumes at its own spot.
- "New Episode • S3 E1": finished shows return to Continue Watching on the day the next episode airs.
- Long-press an episode on mobile to mark it watched or unwatched, or mark episodes 1–N at once.
- All / Movies / Shows filter chips on the Continue Watching page.


## 1.1.3


- My Lists: make up to 12 named lists per profile (Weekend, Date Night and more) alongside your Watchlist, each with a poster collage cover.
- Save to: once you have lists, the + on any title lets you tick the Watchlist and any of your lists in one place.
- Quick actions: press and hold a poster on your phone, or use Edit in My Space on TV, to play, save to lists, move to the top, mark as watched or remove.
- List pages with filters (Movies or Shows), sorting, rename and delete.
- TV My Space now has Watchlist, My Lists and Continue Watching tabs.


## 1.1.2


- Cast and crew pages: open any actor or director to see their photo, biography, birth details and best-known titles.
- Key crew (director, writers, composer) now appear after the cast on every title.
- Movie collections: a new Collection tab on TV and a collection row on mobile list every film in the franchise in release order.
- Rating vote counts such as "37K ratings" next to the score.


## 1.1.1


- Smarter search: type "hindi movies", "90s action movies" or "korean shows" and Panda turns it into a filtered list.
- Typos are forgiven: "intersteller" finds Interstellar and says so.
- Search an actor's name to see their best-known movies and shows first.
- New result filters: genre chips found in your results, plus a sort chip (Best match, Newest, Top rated).
- Browse by Genre chips on the empty search screen (Kids profiles see only family genres), and a Clear history chip for recent searches.
- The Android TV device check now relaunches the app if the emulator restarts Google Play services mid-test.


## 1.1.0


- Home now has "Top Picks for you", built from what you watch, save and rate.
- New "Because You Watched…" rows suggest titles like the ones you just finished.
- A "Coming Soon" row on Home shows upcoming releases with their dates.
- Titles you give a thumbs down no longer appear on Home, in the Top 10 or in the hero.
- Upcoming titles show "Coming <date>" instead of a play icon.
- The update dialog on Android now shows clear release notes.


## 1.0.9


- The web app opens almost instantly on repeat visits and keeps working offline: the app, its scripts and the artwork you've seen are now saved on your device.
- Posters and backdrops are sharper on 4K TVs.
- When your connection comes back, Panda says "Back online", reloads anything that failed and restarts a stalled video from where it stopped.
- Long Home pages on phones scroll more smoothly.
- Fixed a build check that blocked the 1.0.8 Android release.


## 1.0.8


- Kids profiles now block titles with mature ratings and show a "Not available on Kids profiles" screen with Go back and Switch profile.
- Finishing an episode moves Continue Watching on to the next episode, labelled "Next Episode".
- My Space on TV adds Movies/Shows filters, sorting (Recently added, A–Z, Release date) and a Remove items mode for Watchlist and Continue Watching.
- Manage Profiles shows each profile's Watchlist and in-progress counts.
- The profile name field on TV opens the keyboard only when you press OK.
- A new automatic check protects the phone and tablet layouts at seven screen sizes.


## 1.0.7


- New Display settings: screen size on TV, text size, reduce motion and high contrast, saved per profile.
- New Sources settings show live status and response time for each source, next to your preferred source.
- Playback adds a preferred quality, and Data & Storage shows space used and can clear watch history.
- Voice search with the remote's mic now uses Android's built-in speech recogniser.
- Search on TV no longer pops the keyboard when you arrive: press OK to type, Enter jumps to the results, and a Clear button removes the query in one press.
- Episodes that haven't aired yet show "Coming <date>" instead of a play button.


## 1.0.6


- Row cards now open into the title's backdrop when focused, exactly as in the TV blueprint.
- Faster browsing: images for upcoming rows, neighbouring backdrops and the next hero are warmed up in advance.
- Fixed artwork that sometimes stayed invisible after it was already cached.
- New shimmer placeholders on cards and a three-row loading skeleton on Home.
- Screen-reader labels for rows and cards.
- The UPDATE button shows a dot when a new version is available.
- The phone app no longer opens in the TV layout.


## 1.0.5


- New Panda.fun identity: fresh launcher icons, adaptive icon, Android TV banner and splash screen, all generated from the Panda mark.
- Seamless start-up: the native splash, the boot screen and the app splash now match exactly, so there is no flash between them.
- What's New: after an update, a sheet shows what changed. You can reopen it any time from Settings > What's New.
- 59% smaller first load (131 KB down to 54 KB gzip), because screens now load on demand and the app runs on a lighter runtime.
- Update notes in Check for Updates now show only the section for the version you are installing.


## 1.0.4


A completely new TV player, built to the TV PLAYER blueprint:

- **Clean, minimal player screen**: the title sits top-left, the Quality and Audio & Subtitles buttons sit top-right, with a thin progress track, time remaining and a Watch Next button. The controls fade away while you watch and come back on any remote key.
- **Remote-first seeking**: press Left/Right on the track to scrub. Holding the key speeds up from 10 s to 30 s to 60 s, a 3-tile seek preview shows where you will land, and OK or a short pause jumps there. OK toggles play/pause.
- **Quality and Source panel**: choose Auto, 4K, Full HD, HD or Data Saver (saved per profile), or switch between CineSrc and Vidy. Playback reopens where you left off.
- **Audio & Subtitles panel**: two columns, as in the blueprint. Audio offers Original or Sound off; Subtitles offers Off, or opens the source player's own subtitle menu at the same position.
- **Watch Next**: a row of the rest of the season and the start of the next one, or similar titles for movies, with an up-next countdown.
- **Report an Issue**: tell us if a video won't play, is the wrong title, is out of sync or has subtitle problems. The report is sent to the Panda backend and the player fixes it right away by switching source or opening the native controls.
- **Opening advisory and language chips**, such as "Rated A · Drama · Thriller" and "✓ English Original", shown for the first seconds of playback.
- **Back works layer by layer**: panel → seek → controls → exit.


## 1.0.3


- **Trailers with sound.** Stay on a title on TV Home, a row or the details page and its trailer starts after 5 seconds (it buffers 3 seconds ahead). The backdrop crossfades into the video, the title art shrinks and the synopsis fades. Sound turns on after your first remote press or profile pick, fades in and out, and only one trailer ever plays. Moving focus, opening the player or leaving the app stops it at once. If a trailer can't play, the next one is tried, then the backdrop stays.
- **Sound toggle and per-profile trailer settings.** New Settings > Trailers: autoplay, sound, volume (25–100 %) and start delay (3–12 s). These, like the other playback choices, are now saved for each profile. A mute toggle sits on the hero and on mobile title pages.
- **New Who's watching screen.** A wall of real posters drifts behind the profiles in tilted columns at different speeds, with no poster shown twice. Picking a profile zooms its avatar toward you while Home, the hero details and the trailer player load in the background, so Home appears ready (about 0.85 s after the press).
- **Low-memory TVs** get fewer wall columns and a slow backdrop zoom instead of video trailers.
- **Fixes:** the full-screen Trailers & More viewer now plays with sound at your trailer volume and closes at the end; trailers no longer keep playing when the app goes to the background.


## 1.0.2


- **New backend:** the app now talks to `apikinoma.vercel.app` through one typed client with response checks, request de-duplication, retries with backoff and timeouts. Render hosting is gone from both repos.
- **Instant warm start:** rows are kept in IndexedDB, so Home appears straight away on the next launch, even before the network answers.
- **New playback sources:** CineSrc first, Vidy as automatic fallback, with a live health check (`/panda/sources/health`). Old VidSrc mirrors are removed.
- **True-black TV:** the TV interface now sits on pure black, and the focused title's backdrop fades in over 300 ms with a vignette.
- **Safer WebView:** embedded players can no longer open popups or new windows.
- **Blueprint docs:** blueprint index, full player/home/details spec, gaps list, source comparison with a real movie and episode test, performance log and release checklists.


## 1.0.1

- Maintenance release; see the [GitHub Release](https://github.com/titan717/Panda.fun/releases/tag/v1.0.1) for the full list of merged changes.

## 1.0.0

- First stable release: the TV-first navigation, mobile home, search and remote focus work merged before 1.0 ([GitHub Release](https://github.com/titan717/Panda.fun/releases/tag/v1.0.0)).
