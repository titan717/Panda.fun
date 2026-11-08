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
