# Ad shield

Panda plays titles inside embeds from two third-party providers (CineSrc primary, Vidy secondary and anime). Both pay for themselves with ads. The ad shield stops what those embeds try to do to the app: popups, new tabs, redirects of the app page, Play Store and app launches, downloads, permission prompts and native dialogs.

What it cannot do: **ads a provider draws inside its own video player (pre-rolls, banners over the picture) cannot be removed through an iframe.** Panda does not claim otherwise in the app or the release notes.

## Research (2026-11-08)

Instrumented headless Chromium (Playwright) loaded each embed, clicked at eight points of the frame (centre, corners, control bar) and logged new pages, top-level navigations, request hosts and console messages.

| Provider | Unsandboxed | Sandboxed (`allow-scripts allow-same-origin allow-presentation`) |
|---|---|---|
| CineSrc `cinesrc.st/embed/...` | Clicks open popup tabs (e.g. `offer.alibaba.com/cps/...`); click trackers `adexchangerapid.com`, `usrpubtrk.com`, `roadster24.com` | Plays normally (`cinesrc:ready`, `play`, `timeupdate` events; video readyState 4). Every popup attempt is refused by the browser ("sandboxed frame whose 'allow-popups' permission is not set") |
| Vidy `www.vidy.st/...` | No popups in 8 clicks; loads video hosts on rotating domains | Refuses to play under **any** sandbox, even with `allow-popups allow-forms allow-modals`: shows "Iframe Sandbox Detected" |

Other documented sources with fewer ads were looked for (embed APIs that publish a postMessage command API and play sandboxed). None met Panda's bar of a documented command API plus TMDB ids plus a stable domain, so no third adapter was added; the ranking (layer 6) is ready for one.

## Layers

| # | Layer | Where | What it does |
|---|---|---|---|
| 1 | Click isolation | `Player.tsx`, `TvPlayerChrome.tsx` | On every source with a command API (CineSrc), the blueprint player chrome is drawn over the embed on TV **and touch**. The iframe has `pointer-events: none` and `tabindex="-1"`, so it never receives a click, tap or key. Panda sends play / pause / seek / volume / speed as postMessage commands. After the embed loads, and whenever the window loses focus to it, focus is handed back to Panda's controls. |
| 2 | Iframe sandbox per adapter | `src/lib/shield.ts` `SANDBOX` | Strictest sandbox that still plays, measured above: CineSrc `allow-scripts allow-same-origin allow-presentation` (no popups, top navigation, forms, modals or downloads). Vidy: none (compatibility mode, layer 5). |
| 3 | Android WebView | `MainActivity.kt` | Multiple-window support is on only so every `window.open` / `target=_blank` reaches `onCreateWindow`, which refuses it (with it off, a popup would replace the app's own page). JS cannot open windows on its own. `shouldOverrideUrlLoading`: any non-http(s) scheme (`intent:`, `market:`, app links) is refused in every frame; the top frame may only be the bundled app; frames may not navigate to blocklisted hosts. Downloads are refused, permission requests (camera, microphone, protected media) and geolocation are denied, and `alert` / `confirm` / `prompt` from embeds are cancelled. |
| 4 | Network blocklist | `shield/AdShield.kt`, `scripts/update-blocklist.mjs` | Requests to a listed host or any of its parent domains get an empty 204 from `shouldInterceptRequest`. The app, its API, TMDB, YouTube, GitHub and the two provider domains are never blocked. The bundled web app gets the same strict CSP and Permissions-Policy as the website (`vercel.json`): only the two providers and YouTube can be framed. |
| 5 | Vidy compatibility mode | `shield.ts` `COMPAT`, `rankSources`, `lastResortOnly` | Vidy cannot be sandboxed, so it runs with its own controls. In the Android app layers 3 and 4 still stop its popups, redirects and launches. On a TV browser (no native shield, no pointer to close a tab) Vidy is never the first pick: it is only used when CineSrc fails, with a toast that says it uses its own controls. On phone browsers it stays available, after CineSrc, with an explicit message that popups are blocked "where your browser allows it", and the page asks before anything navigates the app away. |
| 6 | Counting and ranking | `shield.ts` `recordBlock`, `noise`, `rankSources`; API `POST /panda/report` issue `popups` | Every blocked attempt is counted per source (kind and host only). A source with more than one blocked attempt per play is demoted behind a quieter one. A session with three or more blocked attempts is reported automatically as a `popups` issue, which feeds the server's source ranking (`GET /sources/ranking`). |
| 7 | Release-blocking tests | `e2e/shield.spec.ts`, `scripts/emulator-check.sh` | Playwright, per adapter and per viewport (TV 1920/1280, phone 390/360, tablet 820): open a series, play, click/tap seven points and press remote keys, use Next Episode, press Back. Fails on any new page or top-level navigation outside the app. Also asserts the CineSrc frame is sandboxed, untabbable and pointer-isolated. It runs in CI on every push and as a gate in `build-apk.yml` before the signed APK is built. The emulator check opens a title through a launch intent, presses and taps around the player for a minute and fails if any other activity comes to the front. The app logs blocks to logcat under `PandaShield` (source, kind and host only, never user data). |
| 8 | Settings | Settings › Sources › Ad shield | Read-only: blocked popups, redirects / app launches and (Android) ad requests; the sandbox mode and blocked count of each source; reset counters. |

## Blocklist

- Source: [StevenBlack/hosts](https://github.com/StevenBlack/hosts) unified hosts (adware + malware), MIT licence, (c) Steven Black. Plus Panda's observed provider hosts (`adexchangerapid.com`, `usrpubtrk.com`, `roadster24.com`, `offer.alibaba.com`).
- Refreshed on every release build by `node scripts/update-blocklist.mjs`; if the download fails or would shrink the list below 10,000 hosts, the committed copy (`android/app/src/main/assets/shield/hosts.txt.gz`, ~78,000 hosts, 0.54 MB) is used.
- Loaded off the main thread at app start into a hash set; lookups walk parent domains (O(labels)).

## Honest limits

- In-video ads drawn by the provider are untouched.
- In a desktop or phone browser, Vidy runs unsandboxed: the browser's popup blocker is the only guard there. Panda says so when Vidy plays.
- New ad domains appear constantly; the list is refreshed each release and the counters show what got through to a block, not what was never attempted.
