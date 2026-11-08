# Blueprint gaps

Things the app needs that no blueprint shows, and how each is filled. Each choice copies the nearest blueprint screen.

| # | Gap | Filled with |
|---|---|---|
| G-1 | Settings sections (Trailers, Sources, Display, Data & storage) | Mobile Help & Settings list style (§15.6) on TV as a two-pane list with the glossy pill focus (§20.3). |
| G-2 | Who's watching poster wall | Black background, posters at 35 % opacity under a vignette; avatar row and focus ring from the mobile profile screen. |
| G-3 | Seek preview frames | Iframe embeds expose no frames (D-25): the 3-tile strip shows timestamps over the title backdrop, each tile with a different crop of the backdrop (v1.0.4). |
| G-4 | Audio & Subtitles content | Shows the tracks the source reports; CineSrc and Vidy keep track switching inside the embed, so the panel offers Original / Sound off and "Choose in source player", which reopens the embed with its own track menu at the same position (D-33). |
| G-5 | Error, offline and empty states | Black screen, centred 64 px icon, one line of text and a "Try again" pill. |
| G-6 | Update progress and What's New | Right sheet with the Quality-panel gradient (§20.9), progress bar styled like the player track (§20.4). Implemented in v1.0.5 (`src/pages/WhatsNew.tsx`). |
| G-7 | Source health UI | Rows in Settings › Sources with a coloured dot (green / amber / red) and last-check time. |
| G-8 | IMDb rating badge | The blueprint shows a yellow "IMDb 7.8" pill. The API has only the TMDB vote average, so the glass badge shows a star with the TMDB score (D-43). |
| G-9 | Person (cast and crew) page | No blueprint screen (v1.1.2). Built from blueprint parts: TV page title size, 300 × 450 portrait with card radius, Details overview text style, "Known For" in the standard 200 × 300 poster grid. Mobile: back bar, 112 × 168 portrait, 3-column poster grid (D-65). |
| G-10 | Collection tab | The blueprint tab bar shows four tabs; a fifth "Collection" tab appears only for movies in a collection, styled exactly like the others (D-67). |
| G-11 | My Lists and quick actions | No blueprint screen (v1.1.3). The list card reuses the landscape card size, radius, title and ice-blue subtitle; the quick-action and Save-to sheets reuse the blueprint sheet; checkboxes use the white-on-dark selected style of the filter chips (D-71, D-72). |
| G-12 | Player 2.0 controls | The TV PLAYER blueprint has no speed, sleep-timer, skip or next-episode screens (v1.1.5). Speed reuses the Quality sheet's group label and pill shapes; Sleep Timer is a bottom-row pill styled like Watch Next and opens the same deep-blue right sheet; Skip Intro and the next-episode card use the blueprint's white focus fill and glass card; "Are you still watching?" uses the Quality sheet gradient (D-77–D-80). |
| G-13 | Connect Phone (sidebar) | Shown in the blueprint sidebar; Panda.fun has no phone pairing yet, so the item is omitted (D-95). Planned with the sync-code work on the roadmap. |
| G-14 | Collection page | No blueprint screen (v1.1.8). Built from the Details visual language: backdrop hero with the left scrim, uppercase kicker, page-title size, white primary button and translucent secondary, poster grid with part labels (D-106). |
| G-15 | Empty and error states | Neither TV nor phone blueprints show an empty state. Icon in a glass disc, title, one line of help and one primary action, centred in the free space (D-105). |
| G-16 | Anime page | No blueprint screen (v1.2.0). Built like the Collection page (G-14): backdrop hero with the left scrim, uppercase kicker, page-title size, white primary and translucent secondary buttons; rows are standard blueprint poster rows with a one-line caption (airing countdown in ice blue, else score and studio). |
| G-17 | Source reliability and Report an Issue on phones | The TV PLAYER blueprint shows Report an Issue only in the TV chrome. Phone and own-controls sources get a "Report" chip and a bottom sheet with the same four issues; source rows get a reliability dot and a one-line capability note under the blueprint's source name. |
