# Panda.fun Blueprint Rebuild

## Source of truth

- Mobile blueprint: Panda-blueprint.pdf (32 pages), attached to this conversation.
- TV blueprint: pending a processable compressed PDF or image export.

## Mobile screens

1. Home: For You hero, UPGRADE pill, Continue Watching, category tabs, content rails.
2. Title details: backdrop, metadata, Watch Now, genres, synopsis, Watchlist/Share/Download/Rate.
3. Series details: season tabs, episode cards, View More/Less, More Like This.
4. Search: recent searches, Clear All, popular searches, results.
5. Profile: profiles, notifications, Continue Watching, My Space.
6. Settings: account, subscription/devices, downloads, language, parental controls, help, logout.

## Implementation principles

- Mobile and TV share data, routing, and playback logic.
- Design values live in CSS custom properties in src/styles/blueprint.css.
- TV focus is explicit, visible, and keyboard/D-pad accessible.
- No fabricated backend data: missing endpoints are documented, not simulated.
- Legacy CSS and unused components are removed only after their replacements are wired.

## Commit sequence

1. Design tokens and shared UI foundation.
2. Home and content rails.
3. Details and series/episodes.
4. Search and library.
5. Profile and settings.
6. Watch/player and real progress.
7. TV layout and D-pad focus.
8. Cleanup, documentation, PR, and deployment preparation.
