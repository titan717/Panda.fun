#!/usr/bin/env python3
"""Step 1 of the brand pipeline: run the segmentation models over the PDF artwork.

Writes scripts/brand/masks/<art>-<model>.png (8-bit soft masks). The masks are committed so the rest of the
pipeline (cutout.py, build.py) is reproducible without the ~200 MB models. Re-run only when the source art changes.

    pip install "rembg[cpu]"
    python3 scripts/brand/segment.py brand-src            # folder holding art-000.jpg … art-003.jpg

Each image runs in its own process: BiRefNet on CPU leaks enough memory that a second image OOMs an 8 GB box.
(The full `birefnet-general` model needs > 8 GB RAM; `birefnet-general-lite` + `isnet-general-use` are used instead.)
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = {"birefnet-general-lite": "birefnet-lite", "isnet-general-use": "isnet"}
ARTS = ["art-000", "art-001", "art-002", "art-003"]


def one(src: str, art: str, model: str, out: str) -> None:
    from PIL import Image
    from rembg import new_session, remove

    im = Image.open(os.path.join(src, f"{art}.jpg")).convert("RGB")
    remove(im, session=new_session(model), only_mask=True).convert("L").save(out, optimize=True)


if __name__ == "__main__":
    if len(sys.argv) == 5 and sys.argv[1] == "--one":
        one(*sys.argv[2:5], out=os.path.join(HERE, "masks", f"{sys.argv[3]}-{MODELS[sys.argv[4]]}.png"))
        sys.exit(0)
    src = sys.argv[1] if len(sys.argv) > 1 else "brand-src"
    os.makedirs(os.path.join(HERE, "masks"), exist_ok=True)
    for art in ARTS:
        for model in MODELS:
            print(f"segment {art} with {model}", flush=True)
            subprocess.run([sys.executable, __file__, "--one", src, art, model], check=True)
