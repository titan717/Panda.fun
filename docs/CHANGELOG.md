# Changelog

Every stable release of Panda.fun. The same notes ship in each GitHub Release and in Settings › What's New.

## 1.2.8

- **Rows you can scroll with a mouse**: on a computer, rest the pointer on any row and arrows appear at its edges. Click one to move the row by a page, so every card is reachable without a keyboard. The arrows only show on the side that has more to see, and never on TVs or phones.
- **The mouse wheel follows the remote**: on Home, a title's page and My Space, each wheel step moves to the next or previous row, just like pressing Down or Up, so the big artwork and the selected title always stay in step. Settings, Search and long lists still scroll normally.
- **Player keyboard shortcuts**: Space or K plays and pauses, J and L jump 10 seconds back or forward, M turns the sound off and on, F goes full screen and C switches subtitles. Press ? in the player for a card that lists them all; Back or Esc closes it.
- **Easier taps on phones**: small links such as "All Episodes", "Edit" and "Help & Settings", the What's New tag, filter chips and the "more" button on cards now respond to taps across a 44-pixel area, so taps stop missing, while they look exactly the same.

## 1.2.7

- **A real subtitles panel**: open Subtitles in the player for three tabs. Tracks switches language in one press, finds more languages, marks hearing-impaired (SDH) tracks and can show a second language above the first. Style changes size, colour, background, edge and height with a live preview over the video. Timing moves subtitles earlier or later in 0.1-second steps; hold the button to move faster.
- **Subtitles remember each title**: the track, timing and second language you chose come back next time you open that title, for each profile. The CC button on remotes and keyboards (or the C key) turns subtitles on and off anywhere in the player.
- **Same choices in Settings**: Settings › Subtitles has the colour, background, edge, height and second-language options too, plus "Reset subtitle look".
- **Kids profiles you can trust**: the PIN is now stored hashed, five wrong tries lock entry for 30 seconds (longer each time), and Manage profiles, Edit profile and Parental controls all ask for the PIN first. Before, a child could switch Kids off from Manage profiles.
- **Safer phone remote**: pairing now gives each phone a session that ends after 2 hours unused or 24 hours in total, the TV only answers phones on your home network, and fast repeated requests are slowed down. Pair again by scanning the QR on Connect Phone.
- **Safer updates and storage**: before installing an update, the app now checks it is Panda, newer than what you have, and signed with the same key. Connections to Panda's server and GitHub are pinned to their certificate authorities, and app data is no longer included in device backups. Use Sync to move your library to another device.

Phones paired with 1.2.6 or older need to scan the QR on the TV's Connect Phone screen once.

## 1.2.6

- **A new first-frames screen**: while a video starts, the player shows the title, "Season 1, Episode 2 · episode title" and "Buffering the first seconds…" with a percentage that follows how fast that source usually starts on your device, then fades into the video.
- **Chapters on the seek bar**: recap, intro and credits are marked on the seek bar on TV and phones, and the seek bubble names the part you are about to land in.
- **Picture fit**: Fit, Fill or Stretch in the Quality panel under "Picture", remembered on the device. On TV the remote's Menu key now opens this quick panel straight away.
- **Volume and Sound off you can trust**: volume steps in the Audio column, and a player left on Sound off opens muted next time. Volume, speed and mute are now applied every time, even when the video starts very quickly.
- **Lock on phones**: the lock button hides every control so pocket taps do nothing; tap and "Tap to unlock", or press Back.
- **Portrait phones play properly**: in portrait the video sits in a 16:9 frame, so CineSrc's "Rotate your phone" box no longer blocks the screen. Loading placeholders on Lists and Anime show on phones again.
- **Safer app**: the Android app's native functions can no longer be reached by video providers' or ads' frames, the website now runs under a strict security policy with integrity checks, and every release ships a software bill of materials. Details in docs/SECURITY.md.

None of the video sources let Panda choose audio tracks, boost the volume or shift audio timing, so those controls are not shown; docs/PLAYER.md lists what each source allows.

## 1.2.5

- **TV rows follow your focus again**: moving right along a row now always scrolls it, including the Top 10 row, and the focused card stops at the safe margin instead of running off the right edge of the screen.
- **Bigger, cleaner Top 10 numbers**: the outlined numerals on TV and phones share one look, sit behind their posters, and "10" gets its own room instead of being covered or overlapping its poster. The digit 1 no longer has a foot.
- **Calmer Home rhythm on phones**: one type scale for headers and row titles, even 24 px spacing between rows, long row titles end in "…" on one line, and the row arrow has a full 44 px tap target.
- **Cards that answer**: with a mouse or trackpad, posters lift and brighten on hover; with a keyboard, the focus ring is drawn on the artwork itself; on touch, cards dim and shrink slightly while pressed.
- **Quicker start on phones**: the TV home, rows and search styles now load only on TV, so phones download about 4 KB less before the first screen.

**Please check on a real TV**: open a title on the TV home and let its background trailer start. The YouTube title, channel picture and logo should no longer flash before the video appears (the fix from 1.2.4). YouTube's bot check blocks real playback in Panda's test environment, so this could only be verified with a stand-in player there. If you still see the flash, tell me on which screen.

## 1.2.4

- **No more YouTube flash on trailers**: background trailers on the TV home, title pages and rows, and on phone title pages, now stay hidden and silent for two seconds after they start, until YouTube's title, channel picture and logo have gone. Then the video fades in and the sound rises gently. Trailers also start a second in, so nothing is lost, and they keep playing on screen when they loop.
- **Trailers stop when you move on**: moving focus away before a trailer appears now pauses and mutes it as well, so a hidden trailer can no longer keep playing in the background.
- **VidLink as a source**: VidLink joins CineSrc and Vidy for movies, shows and anime, with resume and Panda's cleaned subtitles handed to it. Every source now shows an ad tier (1 is cleanest) measured by Panda; Automatic always tries the cleanest tier first and the community ranking only reorders sources inside a tier. VidLink is tier 3 (it opens pop-ups), so it is only used when cleaner sources fail and never picked by itself on TV.
- **Player states**: "Buffering…" appears when the video stops moving; if it is stuck for 12 seconds a card offers Retry, Switch source and Report, and switches to the next source by itself after a 10-second countdown. Coming back to a title asks "Resume from 23:14" or "Start over".
- **Faster seeking on TV**: holding or tapping left/right on the remote speeds up from 10 to 20, 30 and 60 seconds a step, and a bubble shows where you will land and how far you moved. Settings shows how fast videos start on this device ("Starts in 1.8 s").
- **Phone as a TV remote**: on Android TV, Connect Phone in the sidebar shows a QR code; scan it with a phone on the same Wi-Fi to get a remote with a d-pad, typing, volume and "open on TV". Only phones with the pairing code can control the TV, and nothing leaves your home network.
- **Share links and deep links**: Share on a title page sends a link that opens the title in the Panda app (or on the web), and the sync QR now opens Restore from code directly.
- **Clean trailer frames**: trailers play from youtube-nocookie.com inside a locked-down frame that cannot open windows, follow links or take focus; clicks and keys over a trailer do nothing.

VidLink loads ads and trackers of its own (about 20 requests per play) and refuses Panda's sandbox, so in a browser Panda cannot stop its pop-ups; in the Android app the ad shield blocks them. The phone remote needs the Panda app on Android TV.

## 1.2.3

- **Sync code, no account needed**: Settings › Sync Code › Create sync code backs up this device and shows a 12-character code like 7KQ2-M9TX-4HRB, in big letters and as a QR. The code uses only letters and numbers that cannot be mixed up (no I, L, O or U), so it is easy to read off a TV.
- **Restore on another device**: on your other phone, tablet or TV open Settings › Sync Code › Restore from code and type the code (spaces, dashes and lower case are fine; O, I and L are read as 0, 1 and 1). Your profiles, lists, Watchlist, ratings, reminders, settings and watch progress arrive, merged with what that device already has. A device's unused starter profiles make way for the restored ones. After 5 wrong codes the field locks for 15 minutes.
- **Keeps itself in sync**: linked devices sync by themselves shortly after start, 20 seconds after a change, every 10 minutes and when the app goes to the background, and Sync now does it at once. Each title, list, rating and setting is merged on its own, and the newest change wins; when something was changed on two devices since the last sync, Settings says how many items that was and that the newest change was kept. Layout, notification and update choices stay on each device.
- **Encrypted on your device**: everything is encrypted with AES-256-GCM using a key made from your code (PBKDF2, 150,000 rounds) before it leaves the device. The server only stores ciphertext under an id derived from the code, and wrong guesses are rate-limited and locked out.
- **Show, regenerate or revoke**: Show my code brings the code and QR back any time; Regenerate code moves your data to a new code and stops the old one; Revoke code deletes the backup from the server and turns sync off. Other devices learn about it on their next sync.
- **Quicker start**: the first download is a little smaller than in 1.2.2 (the release-notice check now loads only when it is needed); the sync code loads with Settings, never on the first screen.
- **Fix**: on TV with a mouse or air-mouse, closing a sheet no longer moves focus to whatever row happened to sit under the resting pointer; only moving the pointer moves focus.

The QR holds the code itself: scanning it with a phone camera lets you copy the code, it does not open Panda yet. Without a configured database the backend keeps backups in TextDB, a free third-party text store that only ever sees the encrypted data; it does not promise how long it keeps files, so a device that has not synced for a long time may need to create a new code. Anyone who has your code can open your backup, so keep it private and revoke it if it gets out.

## 1.2.2

- **"Are you still watching?" after a few episodes**: when episodes play one after another by themselves, Panda now stops after 3 in a row and asks before starting the next one, so a show does not keep playing all night. The dialog says how many episodes you watched and which one is next. Choose 2, 3 or 4 episodes, or Never, in Settings › Playback. Pressing a button, tapping the screen or picking an episode yourself starts the count again.
- **Touch gestures on phones and tablets**: drag sideways on the video to seek (a full swipe moves two minutes), drag up or down on the right half to change the volume and on the left half to change the brightness, and hold a finger on the video to play at 2× until you let go. A readout in the middle of the screen shows the new time, level or speed. Double-tap left or right still jumps 10 seconds. Seek, volume and 2× work on sources whose controls Panda drives (CineSrc); brightness works on every source. Turn gestures off in Settings › Playback.
- **Picture-in-picture in the Android app**: on phones and tablets with Android 8 or newer, the video keeps playing in a small window when you press Home during playback, and a new picture-in-picture button in the player's top bar does the same at any time. Turn the automatic switch off in Settings › Playback.
- **Spoiler protection**: a new Settings › Playback option blurs the pictures and hides the descriptions of episodes you have not started yet, on the title page and in the player's episode list, and the next-episode card shows the show's picture instead of the episode's. Episodes you have watched or started show as before. It is off by default.
- **Quicker start**: the first download is 1.3 KB smaller than in 1.2.1 (profile editing and the new player features load only when they are needed).

Picture-in-picture needs the Android app: browsers and Android TV do not allow a provider's video inside a web page to leave the page. Seek and volume gestures cannot reach a source that keeps its own controls (Vidy), because its player does not accept commands from Panda.

## 1.2.1

- **Panda's own subtitles**: CineSrc and Vidy titles can now show subtitles drawn by Panda on top of the video, in 31 languages. Panda finds the tracks for the exact movie or episode (from the OpenSubtitles catalogue), removes advertising lines from the files and keeps them in step with the video.
- **Subtitles in Audio & Subtitles**: the TV player's Audio & Subtitles panel, and the same panel on phones, now lists every track for the title with its release name, an Off option and "Earlier" / "Later" buttons that move the subtitles by half a second when they are out of sync. "Choose in source player" is still there for the provider's own menu.
- **Settings › Subtitles**: a new section with a live preview. Choose when subtitles turn on (when the audio is in another language, always, or off), your subtitle language and a second language, subtitles for the deaf and hard of hearing (SDH), and four sizes and four styles (drop shadow, dark box, yellow, outline).
- **Per-profile languages**: every profile keeps its own subtitle settings, so a Hindi-speaking profile can get Hindi subtitles on a Korean drama while another profile watches without them. With the default setting, subtitles turn on by themselves only when the audio is not in your language.
- **Better player panels on phones**: Audio & Subtitles, Quality and the other player panels now have their deep-blue background on phones too (they were see-through before), open as a bottom sheet in portrait and use readable sizes in landscape.
- **Captions stay clear of the controls**: subtitles move up when the player controls, the next-episode card or the opening language pill are on screen, so nothing covers them.

Subtitles drawn inside a provider's own video (for example burned-in subtitles) cannot be changed from outside its player. Vidy Anime keeps its own built-in subtitles.

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
