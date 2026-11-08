# Panda.fun Blueprint Specification

Source blueprints (Google Drive, read-only):

| File | Drive ID | Contents |
| --- | --- | --- |
| `tv1.pdf` | `1593CTtoHc4i3OULqk6lb4-wAUaI6Wd2-` | 35 photos of the TV app (details, episodes, trailers, My Space, categories, splash, profiles) |
| `tv2.pdf` | `1AzhBs53VXLd5GoYlID8NODi69V3AomRS` | 32 photos of the TV app (home hero, rows, sidebar, search, details) |
| `mobile.pdf` | `1DC7jJT8Ig8LczLBM7aUsTkDtKImbioo4` | 32 screenshots of the phone app at 1080×2400 (360×800 dp, density 3) |

The blueprints show a commercial streaming app. Panda.fun copies its layout, spacing, type, focus language and behaviour, and swaps all third-party brand marks for Panda's own (see `DECISIONS.md` D-001). Values are given in design pixels: **TV at a 1920×1080 canvas**, **mobile in CSS px at 360 px wide** (blueprint px ÷ 3). Every value below exists as a token in `src/styles/tokens.css` and every numbered item is verified in `docs/FINAL_REPORT.md`.

Image references use `tv1#12` = `tv1.pdf` image 12 (0-based), `m#5` = `mobile.pdf` image 5.

---

## 1. Global

1.1 Font family: geometric grotesque sans (Inter Variable, self-hosted). Weights used: 400, 500, 600, 700, 800.
1.2 Mobile background `#0F1014` (sampled m#5, m#20: rgb 15,16,20). Mobile cards/surfaces `#16181F`, raised `#1F2129`, hairline `rgba(255,255,255,0.08)`.
1.3 TV background: deep navy `#07111F` with a blue haze; gradient `radial-gradient(120% 90% at 70% 0%, #0E2A4A 0%, #081628 55%, #050C17 100%)` (tv2#20, tv1#10).
1.4 Primary text `#FFFFFF`; secondary `#A7B0C6` (mobile meta, TV meta); tertiary `#7D8598`.
1.5 TV accent ("ice") `#BFE6FF` for active tab text, row titles glow, focus rings: border `2px solid rgba(214,238,255,0.92)` plus glow `0 0 0 1px rgba(150,205,255,.35), 0 0 22px rgba(110,180,255,.45)`.
1.6 Brand gradient (primary CTA, TV): `linear-gradient(90deg, #1B5FD6 0%, #2F6FE0 45%, #7A3FD0 78%, #D2337E 100%)` (tv1#6, tv1#8, tv2#23).
1.7 Mobile primary CTA on details: solid near-white `#F4F9FF` with `#0F1014` text, radius 8, height 44 (m#15).
1.8 Mobile glass button (hero "Watch Now"): `rgba(255,255,255,0.10)` fill, `1px rgba(255,255,255,0.10)` border, radius 10, height 44 (m#1).
1.9 Radii: poster 6 (mobile) / 10 (TV); hero card 18 (mobile) / 22 (TV); pills 999; buttons 8–10; chips 8.
1.10 Motion: focus scale 1.0 → 1.06 over 180 ms `cubic-bezier(.2,.8,.2,1)`; expand-card 260 ms; page fades 200 ms; all disabled under `prefers-reduced-motion`.
1.11 No third-party brand marks anywhere. The Panda mark (white panda face) replaces the star mark; the "Panda" wordmark replaces the product wordmark.

## 2. Splash (tv1#32)

2.1 Full-screen diagonal gradient: deep blue `#0B2A6B` top-left → `#13306E` centre → crimson `#7A1430` bottom-right band, soft.
2.2 Centered mark (≈180 px at 1080p) above the wordmark "Panda" (≈84 px, weight 500, colour `#CFE3F2`).
2.3 Shown for ~1.4 s on cold start while profiles and the home payload load; never blocks longer than data needs (max 2.5 s).

## 3. Who's watching (tv1#33, tv1#34)

3.1 Title "Who's watching?" centred at top, 56 px, weight 700, soft white glow.
3.2 Background: a vertical poster wall (dimmed to 35 %, blurred edges, vignette) centred behind the title, built from real trending posters.
3.3 A thin horizon arc crosses the screen at ~62 % height: `linear-gradient(90deg, transparent, #2B6BFF 30%, #8C4BFF 60%, #FF3D8B 85%, transparent)`, 2 px, slight upward curve.
3.4 Avatars sit on the arc: 120 px circles, 56 px apart. Kids avatar: pink→violet gradient with bold "KIDS" lettering; user avatars: blue gradient with a smiley face; "+" add: translucent circle `rgba(120,140,190,.35)` with a white plus.
3.5 Labels under avatars (24 px, `#C9D3E6`); focused avatar scales to 1.12, label becomes white + bold, an animated arc ring spins around it.
3.6 Selecting an avatar zooms it to centre (tv1#34) and fades into Home.
3.7 Mobile equivalent: same composition scaled (avatars 84 px), touch to select.

## 4. TV navigation rail (tv2#11, tv2#12, tv1#22, tv1#28)

4.1 Collapsed width 112 px; transparent over content. Top: Panda mark (40 px) at (40, 28); under it a small pill "UPDATE" (pink-to-violet 1.5 px outline, 14 px text, radius 6) — replaces "UPGRADE" and opens Check for Updates.
4.2 Icons (28 px, `#D4DCEC` at 70 %) vertically centred: Search, Home, TV, Movies, Categories; selected route icon is white. Bottom: profile avatar dot (28 px) = My Space.
4.3 On focus the rail expands to 360 px with labels (26 px, weight 600) and a dark gradient overlay `linear-gradient(90deg, rgba(4,10,20,.96) 0%, rgba(4,10,20,.85) 60%, transparent 100%)` over the content.
4.4 Labels in expanded state: Search, Home, TV, Movies, New & Hot, Categories, My Space. Focused item: white text + soft pill highlight `rgba(255,255,255,0.10)` radius 10; current page item keeps a white icon.
4.5 Left from leftmost content focuses the current page's rail item; Right from the rail returns focus to the last focused content element.

### 4.6–4.16 Sidebar re-measured for v1.1.7 (supersede 4.1–4.4)

Measured from tv1#15 (collapsed), tv1#22 and tv2#11/#12 (expanded on Home and Categories) and blueprinttvpanda#21. TV units (`--tu`, 1 tu = 1 px at 1920 × 1080).

| # | Property | Blueprint | Panda.fun |
|---|---|---|---|
| 4.6 | Collapsed state | No panel, transparent over true black; logo top, pill under the logo, top-level icons only, avatar at the bottom | Same. Sub-items (TV, Movies, New & Hot) are hidden, out of the focus order and `aria-hidden` when collapsed |
| 4.7 | Collapsed width / icon column | Icons centred ≈ 71–83 tu from the left; content starts ≈ 160–178 tu | `--rail-w` 140 tu; icon centre 79 tu; content keeps its `--content-x` |
| 4.8 | Expanded width | ≈ 21 % of the screen ≈ 400 tu (4.3's 360 was low) | `--rail-w-open` 400 tu (tested at 1280, 1920 and 3840 wide) |
| 4.9 | Expanded panel | Near-opaque dark navy, slightly lighter than black, thin light line on its right edge, overlays the content (content does not move) | `#0d111c → #06080e` vertical gradient, 1 tu `rgba(190,215,255,.16)` edge, soft drop shadow; overlay — the e2e test checks `#main` does not move |
| 4.10 | Order | Connect Phone, Search, Home, ‹TV, Movies, Sports›, Categories … My Space | Search, Home, ‹TV, Movies, New & Hot›, Categories … My Space (D-95, D-96) |
| 4.11 | Logo and pill | Collapsed: pill under the logo; expanded: pill beside the logo on the same line | Logo 60 tu at (52, 28); UPDATE pill 32 tu tall at (28, 106) moves to beside the logo with a transform |
| 4.12 | Rows | Pitch ≈ 93–94 tu; list vertically centred; labels ≈ 28 tu weight 600; icons ≈ 28–30 tu; sub-items indented ≈ 70 tu | `--rail-row` 94 tu, centred on the screen; labels 28 tu / 600; icons 30 tu; sub-items +70 tu |
| 4.13 | Current item | White bold label, filled white icon, soft blue bloom | White bold label, filled icon (Home, Categories, New & Hot have filled shapes), blue drop-shadow on the icon; when collapsed on TV/Movies/New & Hot the Home icon is lit |
| 4.14 | Focus | Bold white label over a soft blue glow band, no box outline | Radial blue glow band (`--tv-rail-glow`), bold white label; no dividers |
| 4.15 | Animation | Not visible in stills | 240 ms `cubic-bezier(.2,.8,.2,1)`; only transform and opacity animate (panel slides in from −100 %, items move between the collapsed and expanded positions with translateY, labels fade and slide 12 tu); 0 ms with reduced motion (D-97) |
| 4.16 | Bottom item | Avatar dot and "My Space" | Active profile's avatar and "My Space"; switching profile re-renders the avatar and applies that profile's settings |

Behaviour (tested in `e2e/tv-sidebar.spec.ts` at 1280 × 720, 1920 × 1080 and 3840 × 2160): Left from the leftmost content item opens the sidebar on the current section; Up/Down walk UPDATE → Search → Home → TV → Movies → New & Hot → Categories → My Space and stop at the ends (no exits up, down or left); Right or Back closes it and returns focus to the exact item you left; Enter navigates and the sidebar closes. Back inside the sidebar never leaves the page.

Result (v1.1.7, 3 passes): pass 1 fixed the My Space row being pulled into the list by the expanded transform; pass 2 enlarged the logo and pill to the blueprint ratio and moved the pill beside the logo; pass 3 replaced the pill-shaped focus box with the blueprint's glow band and made the panel opaque so rows no longer show through.

## 5. TV Home hero (tv2#0–#4, tv1#7, tv1#15, tv1#29, tv1#30)

5.1 Hero card at x=150 → 1500, y=70 → 700 (1350 × 630), radius 22, `1.5px solid rgba(170,215,255,.55)` border when focused, glow as 1.5.
5.2 Backdrop fills the card (cover), with bottom-left scrim `linear-gradient(0deg, rgba(5,10,20,.92) 0%, rgba(5,10,20,.55) 35%, transparent 65%)` and left scrim.
5.3 Badges at top-left (24, 24): glass pills `rgba(20,30,48,.72)`, 1px `rgba(255,255,255,.18)`, radius 8, 18 px weight 600 text, icon left. Data-driven: "#N in Trending Today", "Newly Added" (release < 60 days), "IMDb x.x"/rating.
5.4 Title logo at bottom-left (max 420 × 150), fallback to 64 px weight 800 title text.
5.5 Meta line 20 px weight 600 `#E6ECF5`: `Year • Runtime/Seasons • Cert • Genre • Genre • N Languages`; certification inside a 1px outlined box radius 4.
5.6 Overview 20 px `#C8D1E0`, max 3 lines, width ≤ 820.
5.7 Next 2 hero items peek at right as stacked cards (heights 86 % and 74 %, radius 18) behind the active card.
5.8 Pagination dots centred under the card: 8 px dots `rgba(255,255,255,.35)`, active is a 28 px pill white.
5.9 Trailer: after focus rests 2.5 s on the hero, the item's YouTube trailer fades in inside the card (backdrop crossfade 600 ms), title info stays; a speaker icon appears top-right. Leaving the hero, changing slide or opening details stops and destroys the player.
5.10 Left/Right on hero changes slide; auto-advance every 8 s when no trailer is playing.
5.11 Below the hero: first row title peeks ("Continue Watching for {Profile}") at y≈760.

## 6. TV Home rows (tv2#5–#12, tv1#31)

6.1 When focus enters the rows the hero collapses; the focused item's backdrop fills the top-right 60 % × 55 % of the screen with left and bottom fades.
6.2 The active row sits with its title at y≈310 (28 px, weight 700, ice glow); the previous row is hidden above; the next row's title peeks at the bottom.
6.3 Cards: posters 200 × 300, gap 18, radius 10. The focused item expands to a wide info card 640 × 300 (glass `rgba(12,24,42,.78)`, 1.5 px ice border, radius 14) containing badges, title logo (max 300 × 90), meta, 3-line overview.
6.4 Top 10 rows: huge outlined numerals (190 px, weight 800, stroke 2 px `rgba(255,255,255,.75)`, fill gradient) sit to the left of each poster.
6.5 Landscape rows (Continue Watching, Latest Episodes): 360 × 202 cards, title below (20 px weight 600), sub line in ice (`45m left`, `Next Episode`, `S1 E5`), progress bar 4 px on the image bottom.
6.6 Focus moves horizontally inside a row and vertically between rows; each row remembers its last focused card.
6.7 Rows on Home: Continue Watching for {Profile}, Shows You Watched (from history), Top 10 in India Today – {Language} (with language from settings), then backend rails.

## 7. TV Details (tv1#6, #8, #9, #14, #16; tv2#23–#27)

7.1 Full-bleed backdrop on the right 75 %, left scrim `linear-gradient(90deg, #050B16 0%, rgba(5,11,22,.92) 30%, rgba(5,11,22,.4) 55%, transparent 75%)`, bottom scrim.
7.2 Content column x=120, width 760: title logo (max 420 × 160) → "IMDb 7.8" (18 px, weight 700, ice) → meta (20 px): `2022 • [U/A 16+] • 2h 56m • 4 Languages`, TV: `2026 • [U/A 16+] • 1 Season • 5 Languages`.
7.3 Overview 20 px `#D5DCE8`, 3 lines max. Genres line 18 px weight 700 separated by thin `|` dividers.
7.4 Language chips: selected chip `✓ English Original` (pill, `rgba(120,175,215,.35)` fill, ice text); other languages plain 18 px text with 28 px gaps.
7.5 Primary CTA: 420 × 60 brand-gradient button, radius 8, play glyph + label: "Watch Now" (movie), "Watch First Episode  S1 E1", "Watch Next  S1 E5", "Resume  S1 E5" (TV, from history). Secondary (when a later season exists): translucent `rgba(255,255,255,.14)` "Watch Latest Season  S2 E1" stacked above.
7.6 Square buttons 60 × 60 radius 8 translucent: watchlist (`+` / `✓`), rate (heart). Rate opens a glass popover (Love / Like / Not for me) with the focused option highlighted (tv1#8).
7.7 Trailer: 3 s after landing, the YouTube trailer plays full-bleed behind the content (tv1#9, tv1#14); backdrop restores on end or when focus moves to the tabs.
7.8 Bottom tabs at y≈1010: "Episodes | More Like This | Trailers & More | Cast" (24 px weight 600); Down from the CTA focuses the tabs; focused tab = ice-outlined pill with translucent fill (tv1#4, tv1#13).
7.9 Entering a tab slides to the tab page: tab bar at top (y=70), 1 px divider `rgba(190,225,255,.25)`, content below.
7.10 Episodes: left season list (x=120, 26 px), focused season pill `Season 1   13 Eps`; episode list rows: 16:9 still 300 × 168 radius 10 with play glyph bottom-left, title 24 px weight 700, `S1 E1 • 10 Apr 2015 • 52m` 18 px, 2-line synopsis 18 px `#C5CEDD`; focused row thumbnail gets the ice border. While loading, skeleton blocks of the same geometry (tv2#31).
7.11 More Like This: poster row 200 × 300 (tv1#12). Trailers & More: 16:9 cards 300 × 168 with duration badge bottom-right and title below (tv1#10). Cast: circular portraits 160 px with name/character.

## 8. TV Search (tv2#13–#19)

8.1 Top bar: mic circle 64 px (`rgba(180,210,240,.25)`, voice input where the platform supports it) + search field 1280 × 64 radius 10, fill `rgba(70,140,200,.45)`, placeholder "Search" 24 px.
8.2 Recent searches as chips with a clock icon (`rgba(90,160,210,.35)` fill, radius 8, 20 px text), max 6.
8.3 "Popular Searches" title; 6-column poster grid 200 × 300, gap 20, badges at bottom ("NEW SEASON", "NEW EPISODE", "NEW RELEASE") as small magenta→violet pills.
8.4 Typing filters live (debounced 350 ms); results replace the grid, "No results for “x”" empty state with suggestion chips.

## 9. TV Categories (tv1#22–#27)

9.1 Page title (64 px, weight 700) at top-left; a hero artwork occupies the right half fading left/bottom; it updates to the focused tile's art.
9.2 Rows: "Popular Genres", "Popular Languages", "Browse" (TV / Movies / New & Hot), each with landscape tiles 300 × 170 radius 10, tinted with a colour wash and the label bottom-left (26 px, weight 600). Focused tile: lighter tint + ice border.
9.3 Selecting a tile opens a browse grid (title + filters for type and sort + infinite grid).

## 10. TV My Space (tv1#17–#21)

10.1 Header: profile name/plan line at top-left; at top-right "Check for Updates" (replaces Upgrade) and "Help & Settings" buttons (translucent, radius 8).
10.2 "Profiles" row with circular avatars (Kids, profiles, Add).
10.3 Bottom tabs "Watchlist | Continue Watching" (same pill tab style) → poster grid / landscape cards with `45m left` / `Next Episode`.

## 11. Mobile shell (m#0–#12)

11.1 Status-bar safe area respected (`env(safe-area-inset-top)`).
11.2 Top brand pills (only on Home at scroll 0): two 50 %-width pills, height 44, radius 12, gap 8, 12 px side margins. Left: dark navy `#0B1640` with 2 px `#3B6CFF` border and the Panda wordmark; right: `linear-gradient(90deg,#FF1F3D,#FF5A1F 60%,#FFB21F)` with "NEW & HOT" in heavy italic white (replaces the second brand; opens New & Hot).
11.3 Section header "For You" (18 px, weight 700) with a gold-outlined "WHAT'S NEW" badge (`#E2B455`, 10 px weight 800, radius 4) on the right.
11.4 When scrolled, the top pills hide and the header shows the Panda mark at left and the badge at right on a `#0F1014` bar.
11.5 Bottom nav height 64 + safe-area; items Home (Panda mark), Search, My Space (avatar); active item shows its label (11 px weight 600) and a soft glow; the top edge is a 1 px glowing arc `radial-gradient(60% 6px at 50% 0, #2D7BFF, transparent)`.
11.6 Floating pill above the nav (left 12, bottom 76): `TV | Movies | Categories  ^` in a glass pill (`rgba(28,32,58,.92)`, 1px `rgba(120,140,255,.35)`), height 40, radius 999, 14 px weight 600; right of it a 40 px round search/mic button with blue gradient. Choosing a category shows a compact chip "Movies ×" (m#9–#12); × returns to For You.

## 12. Mobile Home (m#0–#12)

12.1 Hero carousel: card width = 100 % − 56 px, aspect 0.72 (≈304 × 420 at 360 w), radius 18, next card peeks at right (scale .92, 60 % opacity), swipe with scroll-snap, auto-advance 6 s.
12.2 Inside card: top-left badge pill (glass, 11 px weight 600), bottom scrim, title logo (max 76 % × 96), meta `2026 • 5 Languages • Comedy • Drama` 12 px `#C8CEDA`, row: glass "▶ Watch Now" (flex 1) + 44 px square "+" (watchlist toggle, shows ✓ when added).
12.3 Rows: title 17 px weight 700 at 12 px margin; posters 31 % width (≈104 × 150), gap 6, radius 6; landscape cards 46 % width 16:9 with title below and ⋮ menu; Continue Watching cards show progress bar (3 px, `#1F80E0`) and "5m left".
12.4 Top 10 row: language chips (`Malayalam` selected = outlined `1px #fff` with `rgba(255,255,255,.1)` fill; others plain `#1F2129`), posters with big outlined numerals (64 px) at bottom-left.
12.5 Badges on posters: "TOP 10" (magenta corner tag top-right), "NEWLY ADDED"/"NEW EPISODES" (violet pill bottom-centre), data-driven.

## 13. Mobile Search (m#13, m#14, m#18, m#29)

13.1 Search bar: height 44, radius 12, fill `#1F2129`, 1px `rgba(255,255,255,.08)`, search icon left, mic right (voice input when supported), placeholder "Search for 'hindi movies'". While typing an × clear button replaces the mic.
13.2 "Recent Searches" + "Clear All" (`#4DA3FF`, 13 px) → landscape thumbnails with 2-line titles.
13.3 "Popular Searches in" + chips (↗ Trending, Hot & New, Movies, Shows) with icons; selected chip outlined; mosaic grid (3 cols, first tile spans 2×2).
13.4 Typed results: suggestion chip row (recent queries matching), top result card (poster 84 × 120 + title 20 px weight 700 + `2025 • 2 Seasons • HBO` + `IMDb 8.4`), buttons "▶ Watch Latest Season"/"▶ Watch Now" (white) and "All Episodes"/"Details" (grey `#2A2D36`), then "More Like This" row and "More Results" 2-column landscape grid.

## 14. Mobile Details (m#15–#28)

14.1 Full-screen page; header row (after scroll) title 18 px weight 700 + × close at right.
14.2 Top media 16:9: trailer autoplays muted inline after 1.2 s; "TRAILER UNAVAILABLE" label (top-left, 10 px tracking) when none, backdrop shown instead.
14.3 Title logo centred (max 80 % × 110) or 30 px weight 800 title; meta centred `2022  [U/A 16+]  2h 29m  4 Languages` (13 px weight 600; cert in a `#2A2D36` box radius 3).
14.4 Full-width CTA (1.7) "▶ Watch Now" / "▶ Resume S1 E3" / "▶ Watch First Episode".
14.5 Genres line 13 px weight 700 with `|` separators (horizontal scroll); overview 13 px `#8F98AB`, 3 lines.
14.6 Action row (4 equal columns, icon 22 px + 11 px label `#A7B0C6`): Watchlist (+ / ✓ Added in blue), Share (Web Share API / copy link), Episodes or Trailer, Rate (popover Not for me / Like / Love; toast "We will show more of this" / "We will show less of this"; label becomes "Rated").
14.7 TV shows: season tabs (underline 2 px white under active, 15 px weight 600), episode list (still 128 × 72 radius 6 with play glyph, title 14 px weight 600, `S1 E1 • 15 Jan 2023 • 1h 1m` 12 px, synopsis 12 px 3 lines), "View More / View Less" pill (`#22252E`, 12 px) after 4 episodes.
14.8 "More Like This" 3-column poster grid; "Trailers & More" landscape cards with duration.
14.9 "All Episodes" page: header "← Title", season tabs, full episode list (m#20–#23).

## 15. Mobile My Space & Help & Settings (m#30, m#31)

15.1 My Space header: Panda mark left, "⚙ Help & Settings" right.
15.2 App card (replaces subscription card): `#1A1D27` radius 10, "Panda v1.x" + "You're on the latest version"/"Update available", gradient pill button "Update" (`linear-gradient(90deg,#2F80ED,#56CCF2)`).
15.3 "Profiles" + "✎ Edit": avatar row (60 px circles) with names; "Add".
15.4 Notifications card: "YOU'RE ALL CAUGHT UP" + "Enable notifications to stay updated" + "Allow" grey button (Notification API; new-episode reminders for watchlisted shows).
15.5 Continue Watching row; Watchlist row.
15.6 Help & Settings list: rows with 22 px icon, 15 px weight 600 title, 12 px subtitle, chevron: Profiles & Account (manage profiles), Playback (preferred source, autoplay next, trailer autoplay), App Language & Content Languages, Parental Controls (Kids PIN), Help & Support (About), Check for Updates; "Switch Profile" in `#4DA3FF` centred; footer links "Privacy Policy · Terms of Use" and "App Version x.y.z".

## 16. Player

16.1 Full-screen black; iframe fills the viewport.
16.2 Overlay (auto-hides after 4 s of inactivity): top gradient with ← back, title, `S1 E2 · Episode name`; right: source switcher pills (CineSrc / Vidy) with the active one filled.
16.3 Bottom: Episodes drawer button (TV shows), Next Episode button, volume − / + (CineSrc only).
16.4 Loading state over the backdrop with spinner and source label; auto-fallback to the next source if the active one doesn't report ready within 15 s or errors; toast "Switched to Vidy".
16.5 Next-episode countdown card (bottom-right, 10 s ring) on episode end: "Up Next · S1 E3 · Title" with "Play Now" / "Cancel".
16.6 Back (any back key) closes the player and returns to details, saving progress.

## 17. Settings, About, legal, updates

17.1 TV and mobile share content; TV renders as a two-column settings screen (list left, panel right) with focusable rows; mobile renders the list from 15.6.
17.2 Check for Updates: current version, latest GitHub Release tag/date/notes, states: checking, up to date, update available (Download & Install with progress %), downloading, ready to install, offline, error (with Retry).
17.3 About: version, backend status (`/health`), data attribution (TMDB), licence notes.

## 18. States

18.1 Skeletons mirror final geometry (hero card, poster row, episode rows) with a 1.4 s shimmer (static under reduced motion).
18.2 Offline banner "You're offline. Showing saved content." top-centre; cached SWR data stays visible.
18.3 Error state: icon, "Something went wrong", detail line, Retry button (focusable).
18.4 Empty states: My List "Your watchlist is empty" + "Browse Movies" button; Continue Watching "Start watching to see it here"; Search no results.
18.5 Broken images fall back to a gradient tile with the title text.

## 19. Calibrated TV geometry (supersedes sizes above)

The first pass of sections 5–9 was estimated from contact sheets. Measuring the full-resolution photos (tv2#1, tv2#9, tv1#2, tv1#6) against the 1920 × 1080 canvas gave these values, which are what `src/styles/tokens.css` and `tv.css` implement. All values are TV units (`tu`, 1 tu = 1 px at 1920 × 1080; scaled with `--tu` for 1280 × 720 and 3840 × 2160).

| Element | Value |
|---|---|
| Content left edge (after rail) | 160 |
| Overscan-safe margin | 48 top/bottom, 64 right (5 % rule) |
| Hero card | 1400 × 760 at y 56, radius 22 |
| Poster card | 300 × 400, radius 10, gap 12 |
| Focused poster expansion | 820 wide (info card), same height |
| Landscape card | 400 × 225 |
| Row title | 32, weight 700 |
| Primary CTA ("Watch Now") | 620 × 76, square secondary buttons 74 × 74 |
| Episode still | 380 × 214 |
| Search grid | 6 columns |

## 20. TV Player (tvplayerblueprint.pdf — wins for every player decision)

20.1 Background true black; video full-bleed. Chrome fades in on any remote key and hides after 4 s idle.
20.2 Top-left: title in white, 28 px weight 700 at 1080p; episode line below in 18 px `rgba(255,255,255,.7)`.
20.3 Top-right: two buttons "Quality Auto" and "Audio & Subtitles". Unfocused = text with icon, no fill. Focused = glossy pill (white 18 % fill, 2 px white border, 999 px radius).
20.4 Bottom: thin full-width progress track (4 px, white 30 %), played part white, round white knob (16 px; 22 px when focused). Remaining time `HH:MM:SS` right-aligned above the track.
20.5 Below-left of the track: "Watch Next" button (same pill focus as 20.3).
20.6 Start-of-playback advisory, top-left for ~6 s: 4 px vertical cyan bar (`#20C4E8`) + "Rated U/A 16+" (22 px bold) + descriptors line (16 px, 70 % white).
20.7 Language chips bottom-centre at start: active "✓ English Original" outlined pill, others plain text.
20.8 Watch Next overlay: bottom 45 % of the screen, dark gradient; header "Watch Next", 1 px divider, row of 16:9 cards (radius 8 px). Focused card: 3 px white rounded border, centred play triangle, title + genres below.
20.9 Quality panel: right sheet ~45 % width, deep-blue vertical gradient (`#0B1E4A` → `#050B1E`), options "Auto", "4K · up to 2160p", "Full HD · up to 1080p", "HD · up to 720p", "Data Saver"; selected has a check; "Report an Issue" pinned at the bottom.
20.10 Audio & Subtitles panel: right sheet ~60 % width, two columns (Audio | Subtitles), same gradient.
20.11 Seek preview: strip of 3 thumbnails above the track with timestamps (10 s steps); the centre one larger with a white border. Iframe embeds cannot supply frames — see D-25 / BLUEPRINT_GAPS.
20.12 Back: closes an open panel first, then hides chrome, then exits the player saving progress.

## 21. TV Home (blueprinttvpanda.pdf)

21.1 Background `#000`. Left rail: star logo, "UPGRADE" pill, icons (connect phone, search, home, categories), avatar at the bottom.
21.2 Hero: large rounded card (radius 16 px) with a "Blockbuster" badge, backdrop, title logo, meta line "Year • Runtime • Cert • Genres • N Languages" + quality chips (4K / VISION / 5.1), synopsis (2 lines), pagination dots below.
21.3 Second row title: "Continue Watching for <profile name>".
21.4 Row focus: the focused item's backdrop fills the top of the screen (300 ms crossfade, vignette to black on left and bottom). The focused card expands to a wide 16:9 card with 3 px white border showing IMDb badge, title logo, meta and synopsis; neighbouring posters sit to its right.

## 22. TV Details (tvnewblueprint.pdf)

22.1 Tabs "Episodes | More Like This | Trailers & More" with the glossy pill focus.
22.2 Season pill "Season 2  7 Eps". Episode cards: play icon, blue progress bar, "S2 E1 • 13 Apr 2025 • 58m" + synopsis.
22.3 Rate popover: Love / Like / Not for me.
22.4 CTA "Watch Now" with blue→magenta gradient (`#1F80E0` → `#C2187A`), square "+" and "♡" buttons; language chips; genres separated by "|"; "IMDb 8.4" line; meta "2025 • A • 2 Seasons • 5 Languages • 4K • 5.1".
