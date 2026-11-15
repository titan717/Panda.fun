# Playback health and automatic fallback (v1.4.0)

Code: `src/lib/playback/` (`registry.ts`, `fallback.ts`, `health.ts`), used by `src/pages/Player.tsx`. Tests: `src/test/v140-playback.test.ts`.

## No source picker

There is no visible source-selection interface on any platform. The v1.3 source pills, the TV player's Source panel, the stall dialog's "Switch source" button and Settings' "Preferred video source" are removed. A stored preference from v1.3 is ignored (`preferredSource` is forced to `auto` on load). The player picks the provider and moves to the next one by itself. Viewers see "Trying another player…" and never a provider name.

## Provider order per platform (`SOURCE_POLICY`)

| Platform (`playbackPlatform()`) | Movies & shows | Anime | Notes |
|---|---|---|---|
| TV (Android TV app, TV user agents, TV layout) | CineSrc | CineSrc | Only CineSrc. No other provider is reachable through settings or old routes |
| Mobile (Android phone app, touch phones) | Vidy → CineSrc | Vidy Anime → CineSrc | VidLink removed |
| Browser (desktop) | CineSrc, Vidy (ordered by the community ranking) → VidLink last resort | Vidy Anime → CineSrc → VidLink | Same providers as v1.3; VidLink only when the others fail |

The browser keeps v1.3's providers because the directive asks to preserve the existing browser behaviour and not apply TV-only restrictions to it. VidLink is kept only as a last resort because it opens popups (tier 3 in `SOURCES.md`).

## What counts as "playing"

An iframe `load` event is **not** treated as playback. The fallback reducer (`fallback.ts`) only declares success when the provider's player events show the clock advancing by at least 0.4 s, or reaching the resume point. A provider fails on an error event, a missing payload, going offline, or a timeout: 15 s by default, 18 s for CineSrc, 14 s for Vidy. A provider that keeps reporting progress (buffering) gets one extra 10 s grace. Vidy and VidLink need a tap on their own play button. They get 30 s after the frame loads and again after each interaction (focus moving into the frame), so a viewer reading the title card is not skipped past.

## Failure records (`health.ts`)

A record is written **only when every eligible provider failed** for a title on a platform, never for a single provider failure and never for network or offline errors. The key is `platform:type:tmdbId` in `localStorage["panda:v1:playhealth"]`. Each record holds contentId, contentType, platform, profileId, season, episode, attempted providers, reason, failedAt, failures, lastVerified, suppressedUntil and recovery status.

Suppression is temporary: 24 h, then ×3 on each repeat, capped at 7 days. A repeat only escalates once the previous cooldown has ended, so several failed attempts in one evening count once. **Series:** one broken episode does not hide a show. The show is left out of recommendations only if Season 1 Episode 1 failed, if at least two different episodes failed (kept in the record's `episodes` list), or if the failure had no episode information. While suppressed, the title is left out of recommendations for that platform only (it stays searchable and playable). When suppression ends, the record becomes "revalidating". The next successful start clears it ("recovered"). Records older than 30 days are forgotten, and at most 400 are kept. Settings › Playback health shows the live status of this device's players and an "On this device" summary of these records (how many titles failed on every player, how many are held back, how many recovered), with **Clear playback problems** to forget them. No provider can be chosen there.
