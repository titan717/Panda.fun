#!/usr/bin/env python3
"""Step 3 of the brand pipeline: export web assets, PWA/favicons, Android launcher icons and TV banners.

    python3 scripts/brand/cutout.py brand-src /tmp/brand-cut
    python3 scripts/brand/build.py /tmp/brand-cut

Inputs are the full-resolution RGBA cut-outs from cutout.py. Every output path below is referenced by name
elsewhere (src/lib/brand.ts, index.html, manifest, AndroidManifest.xml) — keep the names when regenerating.
"""
import base64
import io
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PUB = os.path.join(ROOT, "public")
BRAND = os.path.join(PUB, "brand")
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
DENS = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
GLOW = (96, 30, 168)  # deep violet behind the mark so the black ears read on a black icon


def fit(im, w=None, h=None):
    r = min((w or 10 ** 9) / im.width, (h or 10 ** 9) / im.height, 1.0)
    return im.resize((max(1, round(im.width * r)), max(1, round(im.height * r))), Image.LANCZOS) if r < 1 else im


def webp(im, name, **kw):
    path = os.path.join(BRAND, name)
    im.save(path, "WEBP", quality=kw.get("q", 90), alpha_quality=100, method=6)
    print(f"{os.path.relpath(path, ROOT)}  {im.width}x{im.height}  {os.path.getsize(path) // 1024} KB")


def png(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, "PNG", optimize=True)
    print(f"{os.path.relpath(path, ROOT)}  {im.width}x{im.height}  {os.path.getsize(path) // 1024} KB")


def square(im, pad=0.0):
    side = round(max(im.size) * (1 + pad))
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    out.alpha_composite(im, ((side - im.width) // 2, (side - im.height) // 2))
    return out


def backdrop(w, h, glow=True):
    """Black with a soft violet radial glow centred slightly above the middle."""
    bg = Image.new("RGBA", (w, h), (0, 0, 0, 255))
    if glow:
        y, x = np.mgrid[0:h, 0:w].astype(np.float32)
        d = np.sqrt(((x - w / 2) / (w * 0.62)) ** 2 + ((y - h * 0.42) / (h * 0.62)) ** 2)
        t = np.clip(1 - d, 0, 1) ** 1.25
        t *= np.clip((0.8 - y / h) / 0.3, 0, 1)  # fade out low so the peek mascot's flat base melts into black
        arr = np.zeros((h, w, 4), np.uint8)
        for i, c in enumerate(GLOW):
            arr[..., i] = (c * t).astype(np.uint8)
        arr[..., 3] = 255
        bg = Image.fromarray(arr, "RGBA")
    return bg


def icon(mark, size, scale, shape="square", glow=True, transparent=False):
    """mark centred at `scale` of the canvas. shape: square (full bleed) | rounded | circle."""
    ss = 4 if size < 128 else 2
    big = size * ss
    canvas = Image.new("RGBA", (big, big), (0, 0, 0, 0)) if transparent else backdrop(big, big, glow)
    m = mark.resize((round(big * scale), round(big * scale)), Image.LANCZOS)
    canvas.alpha_composite(m, ((big - m.width) // 2, (big - m.height) // 2 + round(big * 0.01)))
    if shape != "square":
        mask = Image.new("L", (big, big), 0)
        d = ImageDraw.Draw(mask)
        if shape == "circle":
            d.ellipse((0, 0, big - 1, big - 1), fill=255)
        else:
            d.rounded_rectangle((0, 0, big - 1, big - 1), radius=round(big * 0.2), fill=255)
        canvas.putalpha(Image.fromarray(np.minimum(np.asarray(canvas.getchannel("A")), np.asarray(mask))))
    return canvas.resize((size, size), Image.LANCZOS)


def banner(logo, w, h):
    bg = backdrop(w * 2, h * 2, glow=False)
    lg = fit(logo, w * 2 * 0.86, h * 2 * 0.62)
    bg.alpha_composite(lg, ((bg.width - lg.width) // 2, (bg.height - lg.height) // 2))
    return bg.resize((w, h), Image.LANCZOS).convert("RGB")


def glyph(mark):
    """Single-colour panda glyph (themed icon / notification): silhouette minus the dark patches inside the face."""
    a = np.asarray(mark).astype(np.float32)
    alpha = a[..., 3] / 255
    lum = a[..., :3].mean(2)
    white = (lum > 150) & (alpha > 0.5)
    face = ndi.binary_fill_holes(ndi.binary_closing(white, iterations=3))
    holes = face & (lum < 110) & (alpha > 0.5)
    holes = ndi.binary_opening(holes, iterations=2)
    out = np.clip(alpha - ndi.gaussian_filter(holes.astype(np.float32), 1.0), 0, 1)
    rgba = np.zeros(a.shape, np.uint8)
    rgba[..., :3] = 255
    rgba[..., 3] = (out * 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def main(cut):
    os.makedirs(BRAND, exist_ok=True)
    L = lambda n: Image.open(os.path.join(cut, f"{n}.png")).convert("RGBA")
    mascot, wave, peek = L("mascot"), L("mascot-wave"), L("mascot-peek")
    logo_h, logo_v, word = L("logo-horizontal"), L("logo-vertical"), L("wordmark")

    # ---- web brand library (public/brand) ----
    webp(fit(mascot, 800, 800), "mascot.webp")
    webp(fit(wave, 800, 800), "mascot-wave.webp")
    webp(fit(peek, 640, 640), "mascot-peek.webp")
    webp(fit(logo_h, 1200), "logo-horizontal.webp")
    webp(fit(logo_v, 800, 800), "logo-vertical.webp")
    webp(fit(word, 1000), "wordmark.webp")
    mark = square(peek, 0.04)
    webp(fit(mark, 256, 256), "mark.webp")
    png(fit(mark, 256, 256), os.path.join(BRAND, "mark.png"))

    og = backdrop(1200, 630, glow=False)
    lg = fit(logo_h, 1000, 330)
    og.alpha_composite(lg, ((1200 - lg.width) // 2, (630 - lg.height) // 2))
    png(og.convert("RGB"), os.path.join(BRAND, "og-image.png"))

    # ---- favicons / PWA ----
    png(icon(mark, 180, 0.84).convert("RGB"), os.path.join(PUB, "apple-touch-icon.png"))
    png(icon(mark, 192, 0.84), os.path.join(PUB, "pwa-192x192.png"))
    png(icon(mark, 512, 0.84), os.path.join(PUB, "pwa-512x512.png"))
    png(icon(mark, 512, 0.66), os.path.join(PUB, "pwa-maskable-512x512.png"))  # inside the 80 % safe circle
    png(banner(logo_h, 320, 180), os.path.join(PUB, "tv-banner-320x180.png"))
    fav = [icon(mark, s, 0.96, "rounded") for s in (16, 32, 48)]
    fav[2].save(os.path.join(PUB, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)], append_images=fav[:2])
    png(fav[1], os.path.join(PUB, "favicon-32x32.png"))
    buf = io.BytesIO()
    icon(mark, 64, 0.96, "rounded").save(buf, "PNG", optimize=True)
    with open(os.path.join(PUB, "icon.svg"), "w") as f:  # raster mark wrapped in SVG (CSP img-src allows data:)
        f.write('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 64">'
                f'<image width="64" height="64" href="data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"/></svg>\n')

    # ---- Android ----
    g = glyph(mark)
    png(g.resize((256, 256), Image.LANCZOS), os.path.join(BRAND, "glyph.png"))
    for d, s in DENS.items():
        mip = os.path.join(RES, f"mipmap-{d}")
        png(icon(mark, round(48 * s), 0.86, "rounded"), os.path.join(mip, "ic_launcher.png"))
        png(icon(mark, round(48 * s), 0.8, "circle"), os.path.join(mip, "ic_launcher_round.png"))
        # adaptive: 108 dp canvas, 66 dp safe zone → mark at 0.64 keeps the ears inside any mask shape
        png(icon(mark, round(108 * s), 0.64, transparent=True), os.path.join(mip, "ic_launcher_foreground.png"))
        png(backdrop(round(108 * s), round(108 * s)).convert("RGB"), os.path.join(mip, "ic_launcher_background.png"))
        dr = os.path.join(RES, f"drawable-{d}")
        png(icon(g, round(108 * s), 0.6, transparent=True), os.path.join(dr, "ic_launcher_monochrome.png"))
        png(icon(g, round(24 * s), 0.96, transparent=True), os.path.join(dr, "ic_stat_panda.png"))
    png(fit(mark, 180, 180), os.path.join(RES, "drawable-xhdpi", "splash_mark.png"))
    png(fit(mark, 270, 270), os.path.join(RES, "drawable-xxhdpi", "splash_mark.png"))
    for d, (w, h) in {"xhdpi": (320, 180), "xxhdpi": (480, 270), "xxxhdpi": (640, 360)}.items():
        png(banner(logo_h, w, h), os.path.join(RES, f"drawable-{d}", "tv_banner.png"))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/brand-cut")
