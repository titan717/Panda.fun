# Panda.fun brand assets

Source of truth: the brand PDF ("mascot and logo assests.pdf", 4 pages of raster artwork, exported as
`art-000.jpg` … `art-003.jpg`). There is **no vector source**: every asset below is a segmented, edge-cleaned
raster cut-out of the PDF artwork. The mascot is never redrawn — only an alpha channel is computed; colours are
the original pixels.

Palette: black `#000000` surfaces, white, purple `#8b2cff`, magenta `#d42cff`, violet `#4d1cff`
(`BRAND.colors` in `src/lib/brand.ts`). Purple and magenta are accents only.

## Inventory

| File | Size | From | Use |
|---|---|---|---|
| `public/brand/mascot.webp` | 785×800 | PDF p1 (`art-000`, 3D panda waving with the purple play button) | Landing hero, `<Mascot pose="play">` |
| `public/brand/mascot-wave.webp` | 779×800 | PDF p4 (`art-003`, flat waving panda on white) | `<Mascot pose="wave">`. Its black limbs vanish on pure black — use it on light or mid-tone surfaces |
| `public/brand/mascot-peek.webp` | 640×609 | PDF p2 (`art-001`, panda peeking over the wordmark) | Error / empty states, `<Mascot pose="peek">`. The paws end in a flat cut where the wordmark started (by design) |
| `public/brand/mark.webp` / `mark.png` | 256×256 | PDF p2 head (`art-001`) | Small square mark: nav rail, avatars, boot splash, Android splash |
| `public/brand/glyph.png` | 256×256 | derived from the mark | One-colour silhouette for themed icons and notifications |
| `public/brand/logo-horizontal.webp` | 1200×377 | PDF p3 (`art-002`) | Landing nav/footer, About |
| `public/brand/logo-vertical.webp` | 796×800 | PDF p2 (`art-001`) | Landing closer |
| `public/brand/wordmark.webp` | 1000×177 | PDF p3 text (`art-002`) | Settings footer, mobile header pill |
| `public/brand/og-image.png` | 1200×630 | p1 mascot + p3 logo on black | `og:image` / `twitter:image` for `/` and `/welcome` |
| `public/favicon.ico` (16/32/48), `favicon-32x32.png`, `icon.svg` | | mark on black + violet glow | Browser tab. `icon.svg` embeds a PNG as a `data:` URI (allowed by `img-src 'self' data: blob:`) |
| `public/apple-touch-icon.png`, `pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-512x512.png` | | mark on black | PWA / iOS. Maskable keeps the mark inside the 80 % safe zone |
| `public/tv-banner-320x180.png` | 320×180 | mark + wordmark | TV banner (web copy) |
| `android/app/src/main/res/mipmap-*/ic_launcher*.png`, `ic_launcher_background/foreground.png` | | mark | Launcher, round and adaptive icon |
| `android/app/src/main/res/drawable-*/ic_launcher_monochrome.png`, `ic_stat_panda.png` | | glyph | Themed (Android 13) icon, notification icon |
| `android/app/src/main/res/drawable-{x,xx,xxx}hdpi/tv_banner.png` | 320×180 / 480×270 / 640×360 | mark + wordmark | Android TV launcher banner (`@drawable/ic_tv_banner`) |
| `android/app/src/main/res/drawable-{x,xx}hdpi/splash_mark.png` | | mark | Native cold-start window (black) |

Resource names are unchanged from what `AndroidManifest.xml` and the adaptive-icon XML reference.

## Replacing an asset

- In the app: every component goes through `src/components/Brand.tsx` (`<BrandLogo variant="horizontal|vertical|wordmark|mark" />`,
  `<Mascot pose="wave|play|peek" />`), which reads paths and intrinsic sizes from `src/lib/brand.ts` (`BRAND`, `BRAND_SIZE`).
  To swap a logo, overwrite the file under `public/brand/` with the same name (update `BRAND_SIZE` if the aspect ratio changes),
  or point the one path in `src/lib/brand.ts` somewhere else.
- The landing page (`welcome/index.html`) and `index.html` reference `/brand/*` directly (plain HTML, no bundler import).
- Changing the boot splash `<style>` in `index.html` changes its CSP hash: update `vercel.json` and
  `android/app/src/main/java/com/kinoma/tv/ui/MainActivity.kt` (`scripts/vite-integrity.mjs` fails the build otherwise).

## Regenerating

```sh
pip install "rembg[cpu]" pillow numpy scipy
python3 scripts/brand/segment.py brand-src              # only when the art changes; masks are committed in scripts/brand/masks/
python3 scripts/brand/cutout.py brand-src /tmp/brand-cut  # full-resolution RGBA cut-outs
python3 scripts/brand/build.py /tmp/brand-cut             # writes public/brand, favicons, PWA icons, Android res
```

`brand-src/` is the folder holding `art-000.jpg` … `art-003.jpg` exported from the PDF (not committed).

Notes:
- Segmentation uses `birefnet-general-lite` + `isnet-general-use`. Full `birefnet-general` needs more than 8 GB RAM; each
  image runs in its own process because BiRefNet on CPU leaks memory between images.
- The panda's black ears, arms and feet are the same black as the PDF backdrop, so models drop them. `cutout.py` recovers the
  silhouette from the purple rim light (rim contour → close → fill holes), and un-premultiplies edges against the known
  backdrop so there is no dark or white halo.
- Icons sit on black with a deep violet radial glow so the black ears still read on a black launcher.
