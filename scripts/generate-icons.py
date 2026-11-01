#!/usr/bin/env python3
"""Generate all Panda.fun web and Android raster icons from the SVG source files."""
from pathlib import Path
import io
import shutil
import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
PUBLIC = ROOT / "public"
RES = ROOT / "android/app/src/main/res"

def render(source: Path, target: Path, width: int, height: int | None = None):
    target.parent.mkdir(parents=True, exist_ok=True)
    cairosvg.svg2png(url=str(source), write_to=str(target), output_width=width, output_height=height or width)

icon = ASSETS / "panda-icon.svg"
banner = ASSETS / "panda-tv-banner.svg"

render(icon, PUBLIC / "panda-192.png", 192)
render(icon, PUBLIC / "panda-512.png", 512)
# Derive the maskable export from the same canonical icon. The mark is
# scaled into the centered Android/PWA safe zone on a full-bleed black canvas.
base = Image.new("RGBA", (512, 512), (5, 5, 5, 255))
mark = Image.open(PUBLIC / "panda-512.png").convert("RGBA")
safe_mark = mark.resize((398, 398), Image.Resampling.LANCZOS)
base.alpha_composite(safe_mark, ((512 - 398) // 2, (512 - 398) // 2))
base.save(PUBLIC / "panda-512-maskable.png", format="PNG")
render(icon, PUBLIC / "apple-touch-icon.png", 180)
render(icon, PUBLIC / "favicon-32x32.png", 32)

favicon = Image.open(PUBLIC / "favicon-32x32.png").convert("RGBA")
favicon.save(PUBLIC / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32)])

density_sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for density, size in density_sizes.items():
    for name in ("ic_launcher.png", "ic_launcher_round.png"):
        render(icon, RES / f"mipmap-{density}" / name, size)

render(banner, RES / "drawable" / "tv_banner.png", 320, 180)
render(banner, RES / "drawable-xhdpi" / "tv_banner.png", 320, 180)
render(banner, RES / "drawable-xhdpi" / "banner.png", 320, 180)
shutil.copyfile(ASSETS / "panda-icon.svg", PUBLIC / "icon.svg")
print("Generated Panda.fun web icons, adaptive-icon fallbacks and TV banners.")
