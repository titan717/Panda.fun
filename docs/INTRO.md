# Launch intro (Intro Manager, v1.4.0; IntroBumper since v1.4.2)

The launch intro is configured in one place: `src/lib/intro/config.ts` (`INTRO`). The overlay that plays it is
`src/components/Intro.tsx`; the rules (startup replay, reduced motion, fallback, timeouts) live in
`src/lib/intro/manager.ts` and are tested in `src/test/v140-intro.test.tsx`.

## IntroBumper (v1.4.2, the shipped default)

Since v1.4.2 both `INTRO.tv` and `INTRO.mobile` are `{ kind: "bumper" }`: the approved 4 s Panda.fun canvas bumper
(`panda-intro-canvas.html`, ported unchanged to `src/lib/intro/bumperFrame.ts`), drawn by
`src/components/IntroBumper.tsx`. The same component is the **pre-movie bumper** in the Player
(`src/components/PreMovieBumper.tsx`, rules in `src/lib/intro/premovie.ts`). Tests: `src/test/v142-bumper.test.tsx`,
`src/test/v142-score.test.ts`, `e2e/v142.spec.ts`.

- **Lazy**: the renderer (`bumperFrame`), the score (`bumperScore`) and the logo are separate chunks/assets loaded
  when the bumper mounts; nothing is in the main bundle. The logo is `src/assets/intro/panda-intro-logo.webp`
  (1000×1000, extracted from the approved HTML; no base64 in TypeScript).
- **Own clock**: one start time taken at mount drives the picture, the sound and the timeout, so a slow chunk load
  skips the start rather than pushing the end out. Device pixel ratio is capped at 2; it follows window resizes.
- **Timings** (bumper seconds): rising bar from 0.4 s, triangle beats at 1.55 s and 1.85 s, collapse and logo reveal
  from 2.25 s, black by 4.0 s. It ends at 4.0 s and **never stays up longer than 4.2 s** (`INTRO.bumper.hardMs`),
  even if the canvas, the logo or the animation frames fail. As the launch intro it hands off at once at the end (the
  last frame is black); if it cannot render, the branded still is shown instead.
- **Score** (Web Audio, synthesised, no files): thin rising tone from 0.4 s, kicks at 1.55 s and 1.85 s (the second
  softer), a C-major chime chord at 2.25 s and an air swell at 2.3 s, all over by 3.9 s. It plays only when sound is
  on (`panda:muted`), the volume is above 0 and the device allows audio (always in the Android app; on the web after
  the first key, tap or click, so a browser cold start is silent). Its level follows Settings › volume.
- **Reduced motion**: the final logo frame (bumper time 3.8 s) is drawn once, with no animation loop and no sound,
  for `staticMs` (1.2 s), then fades.
- **Pre-movie bumper**: plays over the Player when a title opens, while the stream loads underneath (the embed is not
  delayed). It ends at 4 s, as soon as real playback starts or playback fails, or when skipped (Skip / OK / Back
  after 1 s; Back never leaves the Player while it is up). It does not play again for an in-player episode change
  (Next Episode, Up Next, Episodes), on `?resumed=1`, or when `panda:v1:bumper` is `"off"` in sessionStorage or
  localStorage (the e2e suites use this).
- The old placeholder video config is kept as `INTRO_TV_VIDEO` (`public/intro/intro-tv.mp4`); switching back is one
  line in `config.ts` (`tv: INTRO_TV_VIDEO`). The video rules below apply to it.
- Visual check: `npx vite --port 5179`, then `node scripts/intro/screens.mjs <panda-intro-canvas.html> <outdir>`
  renders the port and the original at the same times (1920×1080 and 390×844) and writes a pixel diff report.

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
  bumper's final logo frame when the platform uses the bumper, otherwise the branded still (mascot + wordmark on black) for `staticMs` (1.2 s); `"skip"` plays nothing.
- **Broken or missing video** (error event, `play()` refused, or not playing after `startTimeoutMs` = 1.5 s): the
  branded still for 1.2 s instead.
- **Hard timeout**: the app is never blocked longer than `durationMs + hardPadMs` (duration + 2 s) for a video or
  the animation, or 4.2 s for the bumper, whatever fails.
- Only the active platform's video is in the DOM, with `preload="auto"`; the other platform never downloads it.
- Videos are muted (autoplay policy) and play `playsInline`.
- **One brand moment per cold start (v1.5.0)**: the pre-movie bumper is skipped while the launch intro is on screen
  and for `INTRO_GRACE_MS` (20 s) after it ends (`src/lib/intro/premovie.ts`, `src/lib/launch.ts › introEndedAt`),
  so a cold start straight into the Player (a deep link, a resume notification) shows the launch intro once, not the
  intro followed by a second bumper. The bumper itself still never delays playback: the stream loads underneath and
  the bumper leaves as soon as the video starts or fails. Test: `src/test/v142-bumper.test.tsx` (grace).

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
