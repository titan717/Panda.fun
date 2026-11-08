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
