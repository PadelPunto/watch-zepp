#!/usr/bin/env python3
"""Draws the ball of the start-screen logo as the tablet button (Padel Punto Panel).

The images sit exactly over the ball of img/logo.png (big logo) and img/logo_small.png (logo with
an open match). Each image is larger than the ball, so the transparent rim makes the tap area
bigger. Without a paired tablet the ball shows the board as an outline; with one it is filled and
a ring goes round the ball. *_press is the pressed look.

Also the small board in the match's top bar (page/match): img/panel_link_on.png (lime, filled:
connected to the tablet) and img/panel_link_off.png (gray outline: searching).

Usage: python3 tools/panel_ball.py   (writes into assets/default.s/img/)
"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "assets/default.s/img"
S = 8  # supersampling
LIME = (212, 245, 60, 255)  # C.ball
LIME_PRESS = (169, 196, 46, 255)  # C.ballPress
BLACK = (0, 0, 0, 255)
MUTED = (139, 147, 155, 255)  # C.muted

# name suffix, image size, ball radius (in the logo's scale)
SIZES = [("", 70, 19.5), ("_s", 52, 14.3)]


def draw(size, r, paired, ball):
    im = Image.new("RGBA", (size * S, size * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = size * S / 2
    k = r / 19.5  # scale of the glyph against the big ball
    if paired:
        rr, wr = (r + 7 * k) * S, max(2, 2.5 * k) * S
        d.ellipse([c - rr, c - rr, c + rr, c + rr], outline=LIME, width=int(wr))
    br = (r + 1) * S  # a little larger, so the seams of the logo ball don't show at the edge
    d.ellipse([c - br, c - br, c + br, c + br], fill=ball)
    w, h, rad = 22 * k * S, 16 * k * S, 3 * k * S
    box = [c - w / 2, c - h / 2, c + w / 2, c + h / 2]
    if paired:
        d.rounded_rectangle(box, radius=rad, fill=BLACK)
        fill = ball
    else:
        d.rounded_rectangle(box, radius=rad, outline=BLACK, width=int(2.4 * k * S))
        fill = BLACK
    bw, bh = 4.2 * k * S, 5.8 * k * S
    for dx in (-4.5 * k * S, 4.5 * k * S):
        d.rounded_rectangle([c + dx - bw / 2, c - bh / 2, c + dx + bw / 2, c + bh / 2], radius=k * S, fill=fill)
    return im.resize((size, size), Image.LANCZOS)


for suffix, size, r in SIZES:
    for paired in (False, True):
        name = "ball_panel" + ("_on" if paired else "") + suffix
        draw(size, r, paired, LIME).save(OUT / f"{name}.png")
        draw(size, r, paired, LIME_PRESS).save(OUT / f"{name}_press.png")
        print(OUT / f"{name}.png")


def link(on):
    w, h = 22, 16
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    m = 1 * S
    box = [m, m, w * S - m, h * S - m]
    cx, cy = w * S / 2, h * S / 2
    if on:
        d.rounded_rectangle(box, radius=3 * S, fill=LIME)
        fill = BLACK
    else:
        d.rounded_rectangle(box, radius=3 * S, outline=MUTED, width=int(2.2 * S))
        fill = MUTED
    bw, bh = 4 * S, 5.4 * S
    for dx in (-4 * S, 4 * S):
        d.rounded_rectangle([cx + dx - bw / 2, cy - bh / 2, cx + dx + bw / 2, cy + bh / 2], radius=S, fill=fill)
    return im.resize((w, h), Image.LANCZOS)


for on in (True, False):
    name = "panel_link_" + ("on" if on else "off")
    link(on).save(OUT / f"{name}.png")
    print(OUT / f"{name}.png")
