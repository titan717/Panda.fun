# Launch intro (Intro Manager, v1.4.0)

The launch intro is configured in one place: `src/lib/intro/config.ts` (`INTRO`). The overlay that plays it is
`src/components/Intro.tsx`; the rules (startup replay, reduced motion, fallback, timeouts) live in
`src/lib/intro/manager.ts` and are tested in `src/test/v140-intro.test.tsx`.

## Rules

- Plays on a **cold start only**, following `replay` in the config:
  - `"every-cold-start"` (the shipped default): every time the app process starts on a TV or phone, or a new browser
    tab opens. Finishing or skipping writes a per-tab/per-process mark (sessionStorage `panda:v1:intro-session`), so
    a reload, a deep link in the same tab, coming back from the background, rerenders and in-app navigation never
    replay it. An Android activity recreation (`?resumed=1`, e.g. rotation or theme change) never plays it.
  - `"once-per-version"`: only the first cold start after install or after `version` changes. Completion is kept in
    localStorage under `panda:v1:intro` (also written in the default mode, so switching modes is seamless).
- **Skippable** after `skipAfterMs` (1 s): a Skip button appears (focused on TV); OK/Enter and Back skip on TV.
  Until then keys are held back so nothing moves underneath.
- **Reduced motion** (system setting or Settings › Display › Reduce motion): `reducedMotion: "static"` shows the
  branded still (mascot + wordmark on black) for `staticMs` (1.2 s); `"skip"` plays nothing.
- **Broken or missing video** (error event, `play()` refused, or not playing after `startTimeoutMs` = 1.5 s): the
  branded still for 1.2 s instead.
- **Hard timeout**: the app is never blocked longer than `durationMs + hardPadMs` (duration + 2 s), whatever fails.
- Only the active platform's video is in the DOM, with `preload="auto"`; the other platform never downloads it.
- Videos are muted (autoplay policy) and play `playsInline`.

## Files

| Platform | File | Aspect / size | Fit | Config |
| --- | --- | --- | --- | --- |
| TV (and desktop TV layout) | `public/intro/intro-tv.mp4` | 16:9, 1920×1080 (or 1280×720) | `contain` on black | `INTRO.tv` |
| Phone / tablet | `public/intro/intro-mobile.mp4` (not shipped yet) | 9:16, 1080×1920 (720×1280 fine) | `cover` (keep the subject in the centre 1:1 safe area; edges get cropped on tablets) | `INTRO.mobile` |
| Shared fallback | any | — | — | `INTRO.shared` (used when a platform entry is `null`) |

The current TV file is a **placeholder** (5 s, 1280×720, H.264 High, ~1 MB). Phones currently use the built-in
CSS mascot animation (`mobile: { kind: "animation" }`, 2.2 s) built from `BRAND.mascot` and `BRAND.wordmark`.

## Encoding requirements

- Container **MP4**, video **H.264** (High or Main profile, level ≤ 4.1), `yuv420p`, constant 24–30 fps,
  `+faststart` (moov atom first, so playback starts before the download finishes).
- **No audio track** needed (the intro plays muted); strip it to save bytes.
- Length **≤ 5 s on TV, ≤ 2.5 s on phones**. First and last frames should be black (or near black) so the fade
  in/out is seamless.
- **Max size: 1.5 MB TV, 800 KB phone** (it ships inside the APK and is downloaded on first run).
- Served from our own origin: CSP `media-src 'self' blob:` already allows `/intro/*.mp4`; do not use a CDN URL.

Example:

```sh
ffmpeg -i master.mov -an -c:v libx264 -profile:v high -level 4.1 -pix_fmt yuv420p -r 30 \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black" \
  -crf 24 -preset slow -movflags +faststart public/intro/intro-tv.mp4
# phone (portrait)
ffmpeg -i master-portrait.mov -an -c:v libx264 -profile:v high -level 4.1 -pix_fmt yuv420p -r 30 \
  -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" \
  -crf 26 -preset slow -movflags +faststart public/intro/intro-mobile.mp4
```

## Replacing an intro (checklist)

1. Encode as above and put the file in `public/intro/` (`intro-tv.mp4` and/or `intro-mobile.mp4`).
2. In `src/lib/intro/config.ts`:
   - TV: keep `tv: { kind: "video", src: \`${base}intro/intro-tv.mp4\`, width, height, fit: "contain" }` and update
     `width`/`height` if they changed.
   - Phone video: change **one line** to
     `mobile: { kind: "video", src: \`${base}intro/intro-mobile.mp4\`, width: 1080, height: 1920, fit: "cover" }`.
   - Set `durationMs.tv` / `durationMs.mobile` to the real lengths (the hard timeout is this + 2 s).
3. **Bump `version`** (e.g. `"2026.12-1"`). With the default `replay: "every-cold-start"` the new file plays on the next
   app start anyway; with `"once-per-version"` the bump is what makes devices that saw the old intro play the new
   one once.
4. `npm run typecheck && npm run lint && npm test && npm run build`, then check on a TV/emulator and a phone.

Brand images used by the still and the phone animation come only from `src/lib/brand.ts` (`BRAND.mascot`,
`BRAND.wordmark`); if a file is missing the still shows the "Panda.fun" text instead.
