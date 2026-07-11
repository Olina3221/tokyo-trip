"""Generate PWA app icons (torii gate + 東京) without external assets."""
from PIL import Image, ImageDraw, ImageFont


def make_icon(size: int, path: str, rounded: bool = False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # vertical gradient background: deep indigo -> plum
    top = (31, 42, 92)      # #1F2A5C
    bot = (120, 30, 60)     # #781E3C
    for y in range(size):
        t = y / size
        r = int(top[0] * (1 - t) + bot[0] * t)
        g = int(top[1] * (1 - t) + bot[1] * t)
        b = int(top[2] * (1 - t) + bot[2] * t)
        d.line([(0, y), (size, y)], fill=(r, g, b, 255))

    # torii gate (red)
    red = (229, 57, 53, 255)
    s = size / 100.0
    # top beam (kasagi) slightly wider
    d.rounded_rectangle([12 * s, 22 * s, 88 * s, 31 * s], radius=3 * s, fill=red)
    # second beam (nuki)
    d.rectangle([18 * s, 37 * s, 82 * s, 44 * s], fill=red)
    # two pillars
    d.rectangle([26 * s, 22 * s, 36 * s, 82 * s], fill=red)
    d.rectangle([64 * s, 22 * s, 74 * s, 82 * s], fill=red)

    img.save(path)
    print("wrote", path, size)


make_icon(192, "icons/icon-192.png")
make_icon(512, "icons/icon-512.png")
make_icon(180, "icons/apple-touch-icon.png")
