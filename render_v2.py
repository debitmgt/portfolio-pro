#!/usr/bin/env python3
"""
render_v2.py — drop-in replacement for the rendering half of
build_monthly_videos_auto.py.

What changed and why:

1. The old layout gave all 25 rows equal height (68px). The 23 blurred rows
   carried no information but ate 78% of the screen, forcing ticker and
   return type down to ~26px. Here the revealed rows get 250px and the
   blurred rows collapse to 30px strips, so the numbers can be ~4x larger.

2. The old "scroll" phase was dead code: the table was 1890px against a
   1920px screen, so `scrollable` was always 0 and 35% of every video was a
   still frame. Replaced with a real animation — rows expand, returns count
   up, CTA slides in.

3. The heavy 190px orange header bar is replaced with the wordmark asset
   plus a thin accent rule.

Set THEME = LIGHT at the bottom of the palette block to go back to a white
background; every colour below is read from that one dict.
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1080, 1920
FPS = 30

DARK = {
    "ground":      (20, 22, 28),
    "surface":     (28, 31, 39),
    "surface_up":  (38, 42, 51),
    "paper":       (246, 247, 249),
    "muted":       (156, 163, 175),
    "accent":      (255, 106, 0),
    "gain":        (14, 169, 104),
    "loss":        (224, 57, 62),
    "hairline":    (44, 48, 57),
    "scrim":       (20, 22, 28, 216),
}

LIGHT = {
    "ground":      (255, 255, 255),
    "surface":     (246, 247, 249),
    "surface_up":  (238, 240, 244),
    "paper":       (20, 22, 28),
    "muted":       (107, 114, 128),
    "accent":      (255, 106, 0),
    "gain":        (14, 169, 104),
    "loss":        (224, 57, 62),
    "hairline":    (226, 229, 234),
    "scrim":       (255, 255, 255, 216),
}

THEME = DARK

# ─── Fonts ──────────────────────────────────────────────────────────────────
# Anton is the intended display face. Impact is the fallback because it ships
# with every Windows install and is also condensed and heavy, so the layout
# holds even if Anton was never installed.
WIN = "C:\\Windows\\Fonts\\"
NIX = "/usr/share/fonts/truetype/dejavu/"

_DISPLAY = [
    WIN + "Anton-Regular.ttf", "./fonts/Anton-Regular.ttf",
    "/usr/share/fonts/truetype/anton/Anton-Regular.ttf",
    WIN + "impact.ttf",
    WIN + "arialbd.ttf", NIX + "DejaVuSans-Bold.ttf",
]
_MONO = [
    WIN + "consolab.ttf", "./fonts/IBMPlexMono-Medium.ttf",
    NIX + "DejaVuSansMono-Bold.ttf", WIN + "arialbd.ttf",
]
_MONO_REG = [
    WIN + "consola.ttf", "./fonts/IBMPlexMono-Regular.ttf",
    NIX + "DejaVuSansMono.ttf", WIN + "arial.ttf",
]
_SANS = [WIN + "segoeui.ttf", WIN + "arial.ttf", NIX + "DejaVuSans.ttf"]


def _font(cands, size):
    for p in cands:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except OSError:
                continue
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


F_TIER      = _font(_DISPLAY, 82)
F_TICKER    = _font(_DISPLAY, 92)
F_TICKER_SM = _font(_DISPLAY, 62)
F_RETURN    = _font(_MONO, 78)
F_RETURN_SM = _font(_MONO, 54)
F_RANK      = _font(_MONO, 38)
F_SUB       = _font(_MONO_REG, 30)
F_NAME      = _font(_SANS, 30)
F_CTA       = _font(_DISPLAY, 52)
F_CTA_SUB   = _font(_MONO_REG, 28)
F_WORD      = _font(_DISPLAY, 46)

LOGO_PATH = "./assets/ownfolio-wordmark.png"

# ─── Geometry ───────────────────────────────────────────────────────────────
PAD_X       = 48
TOP         = 56
LIST_TOP    = 348
LIST_BOTTOM = 1688
ROW_BIG     = 250
ROW_SMALL   = 30
GAP         = 5


def _text(d, xy, s, font, fill, anchor=None):
    d.text(xy, s, font=font, fill=fill, anchor=anchor)


def _measure(d, s, font):
    b = d.textbbox((0, 0), s, font=font)
    return b[2] - b[0], b[3] - b[1]


def signed(v, dp=1):
    return f"{'+' if v >= 0 else '\u2212'}{abs(v):.{dp}f}%"


def ret_colour(v):
    return THEME["gain"] if v >= 0 else THEME["loss"]


# ─── Header ─────────────────────────────────────────────────────────────────
def draw_header(img, d, tier_label, month_label, n_rows):
    y = TOP
    drew_logo = False
    if os.path.exists(LOGO_PATH):
        try:
            logo = Image.open(LOGO_PATH).convert("RGBA")
            target_w = 360
            logo = logo.resize(
                (target_w, max(1, int(logo.height * target_w / logo.width))),
                Image.LANCZOS,
            )
            img.alpha_composite(logo, (PAD_X, y))
            y += logo.height + 30
            drew_logo = True
        except OSError:
            pass
    if not drew_logo:
        _text(d, (PAD_X, y), "OWNFOLIO.NET", F_WORD, THEME["accent"])
        y += 66

    _text(d, (PAD_X, y), tier_label.upper(), F_TIER, THEME["paper"])
    y += 96
    _text(d, (PAD_X, y), f"1-YEAR RETURN  \u00b7  {month_label}  \u00b7  TOP {n_rows}",
          F_SUB, THEME["muted"])
    y += 46
    d.rectangle([PAD_X, y, PAD_X + 96, y + 5], fill=THEME["accent"])


# ─── Rows ───────────────────────────────────────────────────────────────────
def draw_small_row(d, y, row):
    """A collapsed, uninformative strip. Keeps its return colour so the
    green-to-red gradient down the list still shows the shape of the tier."""
    d.rounded_rectangle([PAD_X, y, W - PAD_X, y + ROW_SMALL], radius=5,
                        fill=THEME["surface"])
    c = ret_colour(row["ret"])
    faded = tuple(int(a + (b - a) * 0.42) for a, b in zip(THEME["surface"], c))
    d.rounded_rectangle([PAD_X + 18, y + 10, PAD_X + 96, y + 21], radius=3,
                        fill=THEME["hairline"])
    d.rounded_rectangle([PAD_X + 118, y + 11, PAD_X + 470, y + 20], radius=3,
                        fill=THEME["hairline"])
    d.rounded_rectangle([W - PAD_X - 106, y + 10, W - PAD_X - 20, y + 21],
                        radius=3, fill=faded)


def draw_big_row(d, y, row, height, reveal, shown_ret):
    """`reveal` 0..1 drives opacity of the contents; `shown_ret` is the
    counting-up figure so the number animates rather than appearing."""
    d.rounded_rectangle([PAD_X, y, W - PAD_X, y + height], radius=18,
                        fill=THEME["surface_up"],
                        outline=THEME["accent"] if reveal > 0.5 else None,
                        width=3)
    if reveal <= 0.02:
        return

    cy = y + height / 2
    big = height > 150

    f_tick = F_TICKER if big else F_TICKER_SM
    f_ret = F_RETURN if big else F_RETURN_SM

    _text(d, (PAD_X + 34, cy - 20), f"#{row['rank']}", F_RANK, THEME["accent"])

    tx = PAD_X + 150
    _text(d, (tx, cy - (52 if big else 36)), row["ticker"], f_tick, THEME["paper"])
    if big:
        _text(d, (tx + 4, cy + 44), row["name"][:26], F_NAME, THEME["muted"])

    txt = signed(shown_ret)
    tw, _ = _measure(d, txt, f_ret)
    _text(d, (W - PAD_X - 34 - tw, cy - (34 if big else 26)), txt, f_ret,
          ret_colour(row["ret"]))


# ─── Frame ──────────────────────────────────────────────────────────────────
def render_frame(rows, tier_label, month_label, visible_ranks, part_num,
                 total_parts, t):
    """t is 0..1 through the video."""
    img = Image.new("RGBA", (W, H), THEME["ground"] + (255,))
    d = ImageDraw.Draw(img)

    draw_header(img, d, tier_label, month_label, len(rows))

    # Reveal ramp: rows stay collapsed for the first 18%, expand over the
    # next 22%, then hold. Numbers count up during the expansion.
    grow = min(max((t - 0.18) / 0.22, 0.0), 1.0)
    ease = 1 - (1 - grow) ** 3

    n_big = len(visible_ranks)
    big_h = ROW_SMALL + (ROW_BIG - ROW_SMALL) * ease

    total = n_big * big_h + (len(rows) - n_big) * ROW_SMALL + (len(rows) - 1) * GAP
    y = LIST_TOP + max(0, (LIST_BOTTOM - LIST_TOP - total) / 2)

    for row in rows:
        if row["rank"] in visible_ranks:
            draw_big_row(d, y, row, big_h, ease, row["ret"] * ease)
            y += big_h + GAP
        else:
            draw_small_row(d, y, row)
            y += ROW_SMALL + GAP

    # CTA slides up over the last 30%
    cta = min(max((t - 0.70) / 0.12, 0.0), 1.0)
    if cta > 0:
        bar_h = 210
        by = H - bar_h * cta
        overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)
        od.rectangle([0, by, W, H], fill=THEME["surface"] + (255,))
        od.rectangle([0, by, W, by + 4], fill=THEME["accent"] + (255,))
        img.alpha_composite(overlay)

        ranks_text = " & ".join(f"#{r}" for r in sorted(visible_ranks))
        line = f"PART {part_num} OF {total_parts}  \u00b7  RANK {ranks_text}"
        tw, _ = _measure(d, line, F_CTA)
        _text(d, ((W - tw) / 2, by + 44), line, F_CTA, THEME["paper"])
        sub = "Full list free \u00b7 link in bio"
        sw, _ = _measure(d, sub, F_CTA_SUB)
        _text(d, ((W - sw) / 2, by + 118), sub, F_CTA_SUB, THEME["muted"])

    # Series progress across the 13 episodes
    py = H - 6
    d.rectangle([0, py, W, H], fill=THEME["hairline"])
    d.rectangle([0, py, W * part_num / total_parts, H], fill=THEME["accent"])

    return img.convert("RGB")


def build_episode_list(rows):
    """Part 1 = (rank 1, rank N). Then working inward: (2, N-1), (3, N-2),
    and finally the middle rank alone. For 25 rows this gives 13 parts.
    Unchanged from the original script."""
    ranks = sorted(r["rank"] for r in rows)
    episodes = [(ranks[0], ranks[-1])]
    lo, hi = 1, len(ranks) - 2
    while lo < hi:
        episodes.append((ranks[lo], ranks[hi]))
        lo += 1
        hi -= 1
    if lo == hi:
        episodes.append((ranks[lo],))
    return episodes
