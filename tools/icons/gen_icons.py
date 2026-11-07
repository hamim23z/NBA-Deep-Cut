"""Draws web/public/{favicon,apple-touch-icon,social}.png. Usage: python3 tools/icons/gen_icons.py [OUTDIR]. Needs Pillow and `npm install` in web/ for the fonts."""
import math
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "..", "web", "public"))
FONTS = os.path.join(HERE, "..", "..", "web", "node_modules", "@fontsource")
os.makedirs(OUT, exist_ok=True)

INK, SKY, CREAM, ORANGE, AMBER, MUTED, MOON, DEEP = "#0a0a0a", "#0a060c", "#f4ead6", "#ff6a13", "#ffb347", "#a8a8a8", "#e0d8c8", "#8a3c0a"
SEAM = "#1a0902"
TIERS = ["#6e6e6e", "#a8a8a8", "#ededed", "#ffb020", "#ff6a13", "#ff3b1f"]
TIER_TEXT = ["#ffffff"] + [INK] * 5


def ball(size: int, outline=(26, 9, 2, 255)) -> Image.Image:
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    c = (size - 1) / 2
    r = size / 2 - 0.4
    px = im.load()
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - c, y - c)
            if d > r:
                continue
            seam = abs(x - c) < 0.6 or abs(y - c) < 0.6 or abs(abs(x - c) - r * 0.62) < 0.55 and abs(y - c) < r * 0.7
            px[x, y] = outline if d > r - 1.1 else (26, 9, 2, 255) if seam else (255, 106, 19, 255)
    return im


def scaled(im: Image.Image, k: int) -> Image.Image:
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def icon(cells: int, k: int) -> Image.Image:
    im = Image.new("RGBA", (cells, cells), SKY)
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, cells - 1, cells - 1), outline=ORANGE)
    b = ball(cells - 4, outline=(244, 234, 214, 255))
    im.paste(b, (2, 2), b)
    return scaled(im, k)


def font(name: str, file: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(os.path.join(FONTS, name, "files", file), size)


def social() -> Image.Image:
    press = lambda n: font("press-start-2p", "press-start-2p-latin-400-normal.woff", n)
    vt = lambda n: font("vt323", "vt323-latin-400-normal.woff", n)
    cells_w, cells_h, k = 400, 210, 3
    low = Image.new("RGB", (cells_w, cells_h), SKY)
    d = ImageDraw.Draw(low)
    rnd = random.Random(4)
    for _ in range(90):
        d.point((rnd.randrange(cells_w), rnd.randrange(150)), fill=rnd.choice([CREAM, CREAM, MUTED, AMBER]))
    mx, my, mr = 300, 70, 44
    d.ellipse((mx - mr, my - mr, mx + mr, my + mr), fill=MOON)
    for cx, cy, cr in ((-16, -12, 8), (14, -4, 6), (-4, 18, 10), (22, 22, 5), (-28, 8, 5)):
        d.ellipse((mx + cx - cr, my + cy - cr, mx + cx + cr, my + cy + cr), fill="#b4a992")
    d.rectangle((mx - 22, my + mr - 4, mx + 22, my + mr), fill=ORANGE)
    for i in range(7):
        for x in range(mx - 20 + i // 2, mx + 21 - i // 2):
            if (x + i) % 2 == 0:
                low.putpixel((x, my + mr + 1 + i), (244, 234, 214))
    for y in (70, 110, 150):
        for x in range(232, cells_w, 8):
            d.line((x, y, x + 3, y), fill="#3a3a3a")
    b = ball(26)
    low.paste(b, (mx - 13, 150 - 13), b)
    d.rectangle((0, 188, cells_w, cells_h), fill="#b25e1a")
    d.line((0, 188, cells_w, 188), fill=CREAM)
    img = scaled(low, k).convert("RGB")
    d = ImageDraw.Draw(img)
    d.rectangle((10, 10, 1189, 619), outline=ORANGE, width=8)
    d.text((64, 70), "THE DAILY BASKETBALL SHOT", font=press(14), fill=MUTED)
    d.text((70, 120), "NYLON", font=press(104), fill=DEEP)
    d.text((64, 114), "NYLON", font=press(104), fill=CREAM)
    d.text((64, 270), "CLIMB TO THE MOON.", font=press(20), fill=ORANGE)
    d.text((64, 306), "OR SINK FROM IT.", font=press(20), fill=ORANGE)
    d.text((64, 360), "Seven prompts a day, 25 seconds each.", font=vt(46), fill=CREAM)
    d.text((64, 404), "RARE: the rarer your answer, the more it scores.", font=vt(38), fill=MUTED)
    d.text((64, 440), "COMMON: the more famous, the more.", font=vt(38), fill=MUTED)
    for i, c in enumerate(TIERS):
        x = 64 + i * 72
        d.rectangle((x + 5, 500 + 5, x + 56 + 5, 500 + 56 + 5), fill="#000000")
        d.rectangle((x, 500, x + 56, 500 + 56), fill=c)
        d.text((x + 28, 500 + 28), str(i + 1), font=press(22), fill=TIER_TEXT[i], anchor="mm")
    return img


icon(16, 4).convert("RGBA").save(os.path.join(OUT, "favicon.png"), optimize=True)
icon(45, 4).convert("RGB").save(os.path.join(OUT, "apple-touch-icon.png"), optimize=True)
if os.path.isdir(FONTS):
    social().save(os.path.join(OUT, "social.png"), optimize=True)
else:
    print("skipped social.png: run `npm install` in web/ for the fonts")
print("wrote", OUT)
