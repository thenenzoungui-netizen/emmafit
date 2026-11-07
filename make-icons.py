from PIL import Image, ImageDraw, ImageFont
import os

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
ACCENT = (201, 138, 91)
ACCENT_DARK = (176, 116, 74)
SAGE = (127, 168, 139)
OUT = "icons"

def gradient(size, c1, c2):
    img = Image.new("RGB", (size, size), c1)
    d = ImageDraw.Draw(img)
    for y in range(size):
        f = y / max(1, size - 1)
        col = tuple(int(c1[i] + (c2[i] - c1[i]) * f) for i in range(3))
        d.line([(0, y), (size, y)], fill=col)
    return img

def make(size, padding_ratio=0.0, rounded=True):
    S = size * 4  # supersampling
    base = gradient(S, (210, 152, 106), ACCENT_DARK).convert("RGBA")

    # arc de progression (blanc translucide)
    arc = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    da = ImageDraw.Draw(arc)
    m = int(S * (0.13 + padding_ratio))
    da.arc([m, m, S - m, S - m], start=-90, end=210, fill=(255, 255, 255, 92), width=int(S * 0.05))
    da.arc([m, m, S - m, S - m], start=210, end=270, fill=SAGE + (215,), width=int(S * 0.05))
    base = Image.alpha_composite(base, arc)

    # monogramme EF
    d = ImageDraw.Draw(base)
    font = ImageFont.truetype(FONT, int(S * 0.33))
    txt = "EF"
    box = d.textbbox((0, 0), txt, font=font)
    d.text(((S - (box[2] - box[0])) / 2 - box[0], (S - (box[3] - box[1])) / 2 - box[1] - S * 0.01),
           txt, font=font, fill=(255, 255, 255, 255))

    if rounded:
        mask = Image.new("L", (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.225), fill=255)
        base.putalpha(mask)

    return base.resize((size, size), Image.LANCZOS)

os.makedirs(OUT, exist_ok=True)
make(180).save(f"{OUT}/icon-180.png")
make(192).save(f"{OUT}/icon-192.png")
make(512).save(f"{OUT}/icon-512.png")
make(512, padding_ratio=0.06, rounded=False).save(f"{OUT}/icon-maskable.png")
print("icons ok")
