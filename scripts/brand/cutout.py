#!/usr/bin/env python3
"""Step 2 of the brand pipeline: turn the PDF artwork into transparent, edge-cleaned cut-outs.

    python3 scripts/brand/cutout.py brand-src /tmp/brand-cut      # writes full-resolution RGBA PNGs

Why not just use the model masks? The artwork is black-and-white panda on a PURE black background (art-000/1/2):
the black ears, arms and feet are the same RGB(0,0,0) as the backdrop, and both models drop them. Every black part
is, however, outlined by the purple rim light, so the silhouette is recovered as
    (any pixel brighter than the JPEG noise floor  ∪  model masks)  → close → fill holes → largest parts,
i.e. the rim light becomes a closed contour and the black interior inside it is kept. Wordmark text sits on pure
black, so it is keyed on brightness relative to the local text colour (no hole filling, so the counters of
"P", "a", "d" stay transparent). Edges are un-premultiplied against the known backdrop (black, or white for
art-003) so there is no dark/white halo on grey. Pixels are never repainted: only alpha is computed, and edge
colours are the original colours divided by alpha.
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))


def load(src, art):
    rgb = np.asarray(Image.open(os.path.join(src, f"{art}.jpg")).convert("RGB")).astype(np.float32)
    masks = [np.asarray(Image.open(os.path.join(HERE, "masks", f"{art}-{m}.png")).convert("L")).astype(np.float32) / 255
             for m in ("birefnet-lite", "isnet")]
    return rgb, masks


def disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r


def keep_large(mask, min_px):
    lab, n = ndi.label(mask)
    if n == 0:
        return mask
    sizes = ndi.sum(mask, lab, range(1, n + 1))
    keep = np.zeros(n + 1, bool)
    keep[1:] = sizes >= min_px
    return keep[lab]


def soft_edge(hard, sigma=0.9):
    """Anti-aliased alpha from a binary silhouette, pulled in ~0.5 px so the fade to the backdrop is excluded."""
    a = ndi.gaussian_filter(hard.astype(np.float32), sigma)
    return np.clip((a - 0.5) * 2.2 + 0.5, 0, 1)


def unpremultiply_black(rgb, alpha):
    """observed = alpha·fg + (1-alpha)·black  →  fg = observed / alpha (edge pixels only)."""
    out = rgb.copy()
    edge = (alpha > 0.02) & (alpha < 0.98)
    out[edge] = np.clip(rgb[edge] / alpha[edge, None], 0, 255)
    return out


def enclosed(fg, reach=120, dirs=24, need=18, scale=2):
    """Pixels surrounded by the figure: at least `need` of `dirs` rays hit `fg` within `reach` px.

    This closes the gaps where the rim light fades out (e.g. under an ear or a raised arm) without webbing the
    concave notches between ear and head, which are open to the outside on one side.
    """
    small = fg[::scale, ::scale]
    hits = np.zeros(small.shape, np.int16)
    steps = reach // scale
    h, w = small.shape
    pad = np.pad(small, steps)
    for k in range(dirs):
        t = 2 * np.pi * k / dirs
        dx, dy = np.cos(t), np.sin(t)
        hit = np.zeros(small.shape, bool)
        for s in range(1, steps + 1):
            ox, oy = int(round(dx * s)), int(round(dy * s))
            hit |= pad[steps + oy:steps + oy + h, steps + ox:steps + ox + w]
        hits += hit
    inside = hits >= need
    return np.kron(inside, np.ones((scale, scale), bool))[:fg.shape[0], :fg.shape[1]]


def mascot_on_black(rgb, masks, region=None, floor=None):
    """floor: row index where the figure is cut flat (the vertical logo's mascot sits on the wordmark)."""
    bright = rgb.max(2) > 12
    model = np.maximum(*masks) > 0.35
    fg = bright | model
    if region is not None:
        fg &= region
    fg = keep_large(ndi.binary_opening(fg, structure=disk(1)), 400)
    seed = fg.copy()
    if floor is not None:
        cols = np.nonzero(fg[floor - 160:floor].any(0))[0]
        seed[floor, cols.min():cols.max() + 1] = True
    fg = fg | enclosed(seed)
    fg = ndi.binary_closing(fg, structure=disk(3))
    fg = ndi.binary_fill_holes(fg)
    if floor is not None:
        # The paws resting on the cut line have rim light only on top: everything below a column's first
        # figure pixel (within the paw band) down to the cut is figure.
        band = fg[floor - 210:floor]
        first = np.where(band.any(0), band.argmax(0), band.shape[0])
        rows = np.arange(band.shape[0])[:, None]
        fg[floor - 210:floor] |= rows >= first[None, :]
        fg[floor:] = False
    # smooth the contour (JPEG noise in the fading rim light makes it ragged)
    fg = ndi.gaussian_filter(fg.astype(np.float32), 3.5) > 0.5
    fg = keep_large(fg, 4000)
    alpha = soft_edge(fg)
    # Bright edges (white fur, purple rim, purple shape) fade into the black backdrop over ~2 px; take alpha from
    # that fade instead of the geometric silhouette so no dark ring shows on grey/light surfaces.
    m = rgb.max(2)
    depth = ndi.distance_transform_edt(fg)
    local = ndi.maximum_filter(m * (depth > 2), size=9)
    ratio = np.clip(m / np.maximum(local, 1), 0, 1)
    outer = (depth <= 2.5) & (local > 70)
    alpha = np.where(outer, np.minimum(alpha, np.clip((ratio - 0.15) / 0.75, 0, 1)), alpha).astype(np.float32)
    return unpremultiply_black(rgb, alpha), alpha


def text_on_black(rgb, region):
    """Key text on pure black: alpha = brightness / local text brightness; colour = original / alpha."""
    m = rgb.max(2) * region
    local = ndi.maximum_filter(m, size=9)
    alpha = np.where(local > 60, np.clip(m / np.maximum(local, 1), 0, 1), 0).astype(np.float32)
    alpha[alpha < 0.04] = 0
    alpha = np.clip((alpha - 0.04) / 0.92, 0, 1)
    solid = keep_large(alpha > 0.5, 150)
    alpha *= ndi.binary_dilation(solid, structure=disk(3))
    return unpremultiply_black(rgb, alpha), alpha


def mascot_on_white(rgb, masks):
    a = masks[0]  # BiRefNet-lite is clean on the white-background flat panda
    fg = keep_large(ndi.binary_fill_holes(a > 0.5), 4000)
    alpha = np.clip(a, 0, 1) * ndi.binary_dilation(fg, structure=disk(3))
    alpha = np.where(ndi.binary_erosion(fg, structure=disk(3)), 1.0, alpha).astype(np.float32)
    alpha = np.clip((alpha - 0.08) / 0.84, 0, 1)
    out = rgb.copy()
    edge = (alpha > 0.02) & (alpha < 0.98)
    # observed = alpha·fg + (1-alpha)·white
    out[edge] = np.clip((rgb[edge] - (1 - alpha[edge, None]) * 255) / alpha[edge, None], 0, 255)
    return out, alpha


def save(path, rgb, alpha, pad=8):
    ys, xs = np.nonzero(alpha > 0.01)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, alpha.shape[0])
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, alpha.shape[1])
    rgba = np.dstack([rgb, alpha * 255]).round().clip(0, 255).astype(np.uint8)[y0:y1, x0:x1]
    rgba[rgba[..., 3] == 0, :3] = 0
    Image.fromarray(rgba, "RGBA").save(path)
    print(f"{path}: {x1 - x0}x{y1 - y0}")


def main(src, out):
    os.makedirs(out, exist_ok=True)

    # PDF page 1 — waving panda holding the play button
    rgb, masks = load(src, "art-000")
    save(f"{out}/mascot.png", *mascot_on_black(rgb, masks))

    # PDF page 2 — vertical logo: mascot peeking over "panda.fun"; text starts at y≈890
    rgb, masks = load(src, "art-001")
    h, w = rgb.shape[:2]
    split = 876
    top = np.zeros((h, w), bool); top[:split] = True
    prgb, palpha = mascot_on_black(rgb, masks, top, floor=861)
    save(f"{out}/mascot-peek.png", prgb, palpha)
    trgb, talpha = text_on_black(rgb, ~top)
    vrgb = np.where(top[..., None], prgb, trgb)
    save(f"{out}/logo-vertical.png", vrgb, np.where(top, palpha, talpha))

    # PDF page 3 — horizontal logo: 3D panda + purple shape, then "Panda.fun" from x≈826
    rgb, masks = load(src, "art-002")
    h, w = rgb.shape[:2]
    split = 800
    left = np.zeros((h, w), bool); left[:, :split] = True
    lrgb, lalpha = mascot_on_black(rgb, masks, left)
    trgb, talpha = text_on_black(rgb, ~left)
    save(f"{out}/wordmark.png", trgb, talpha)
    save(f"{out}/logo-horizontal.png", np.where(left[..., None], lrgb, trgb), np.where(left, lalpha, talpha))

    # PDF page 4 — flat waving panda on white
    rgb, masks = load(src, "art-003")
    save(f"{out}/mascot-wave.png", *mascot_on_white(rgb, masks))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "brand-src", sys.argv[2] if len(sys.argv) > 2 else "/tmp/brand-cut")
