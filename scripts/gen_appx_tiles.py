#!/usr/bin/env python3
"""
Generate APPX tile icons required by Microsoft Store.
All tiles use OptiRest eye icon on dark branded background.
Output: build/appx-tiles/
"""

from PIL import Image, ImageDraw, ImageFilter
import os

SRC_ICON = "build/app-icon.png"
OUT_DIR  = "build/appx-tiles"
os.makedirs(OUT_DIR, exist_ok=True)

BG_TOP = (10, 14, 39)   # #0a0e27
BG_BOT = (13, 33, 55)   # #0d2137
ACCENT = (64, 196, 255)

def make_gradient(w, h):
    img = Image.new("RGBA", (w, h))
    for y in range(h):
        t = y / h
        r = int(BG_TOP[0] + t * (BG_BOT[0] - BG_TOP[0]))
        g = int(BG_TOP[1] + t * (BG_BOT[1] - BG_TOP[1]))
        b = int(BG_TOP[2] + t * (BG_BOT[2] - BG_TOP[2]))
        for x in range(w):
            img.putpixel((x, y), (r, g, b, 255))
    return img

def add_glow(base, cx, cy, radius):
    glow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    gr = int(radius * 1.3)
    d.ellipse([cx-gr, cy-gr, cx+gr, cy+gr], fill=(64, 196, 255, 35))
    gr2 = int(radius * 1.05)
    d.ellipse([cx-gr2, cy-gr2, cx+gr2, cy+gr2], fill=(64, 196, 255, 25))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=max(2, radius * 0.25)))
    return Image.alpha_composite(base, glow)

def make_tile(filename, w, h, icon_frac=0.62):
    base = make_gradient(w, h)
    icon_src = Image.open(SRC_ICON).convert("RGBA")

    icon_size = int(min(w, h) * icon_frac)
    icon = icon_src.resize((icon_size, icon_size), Image.LANCZOS)

    cx = w // 2
    cy = h // 2
    base = add_glow(base, cx, cy, icon_size // 2)
    base.paste(icon, (cx - icon_size // 2, cy - icon_size // 2), icon)

    out = os.path.join(OUT_DIR, filename)
    base.convert("RGBA").save(out, "PNG")
    print(f"  ✓ {filename}  ({w}×{h})")

print("Generating APPX tile icons...")

# Required APPX tile sizes for electron-builder
make_tile("StoreLogo.png",          50,  50,  icon_frac=0.70)
make_tile("Square44x44Logo.png",    44,  44,  icon_frac=0.70)
make_tile("Square71x71Logo.png",    71,  71,  icon_frac=0.68)
make_tile("Square150x150Logo.png",  150, 150, icon_frac=0.65)
make_tile("Square310x310Logo.png",  310, 310, icon_frac=0.62)
make_tile("Wide310x150Logo.png",    310, 150, icon_frac=0.58)

print(f"\nAll tiles saved to {OUT_DIR}/")
