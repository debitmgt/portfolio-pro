#!/usr/bin/env python3
"""
render_v2.py â€” drop-in replacement for the rendering half of
build_monthly_videos_auto.py.

What changed and why:

1. The old layout gave all 25 rows equal height (68px). The 23 blurred rows
   carried no information but ate 78% of the screen, forcing ticker and
   return type down to ~26px. Here the revealed rows get 250px and the
   blurred rows collapse to 30px strips, so the numbers can be ~4x larger.

2. The old "scroll" phase was dead code: the table was 1890px against a
   1920px screen, so `scrollable` was always 0 and 35% of every video was a
   still frame. Replaced with a real animation â€” rows expand, returns count
   up, CTA slides in.

3. The heavy 190px orange header bar is replaced with the wordmark asset
   plus a thin accent rule.

Set THEME = LIGHT at the bottom of the palette block to go back to a white
background; every colour below is read from that one dict.
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math
import urllib.request
import json

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

# â”€â”€â”€ Fonts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

# â”€â”€â”€ Geometry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


# â”€â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


# â”€â”€â”€ Rows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


# â”€â”€â”€ Frame â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def fetch_price_history(symbol, end_date, api_key, days=380):
    url = (
        "https://api.twelvedata.com/time_series"
        + "?symbol=" + symbol + "&interval=1day&outputsize=" + str(days)
        + "&end_date=" + end_date + "&apikey=" + api_key
    )
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            data = json.loads(resp.read())
        values = data.get("values")
        if not values:
            return None
        values = list(reversed(values))
        closes = [float(v["close"]) for v in values]
        if len(closes) < 30:
            return None
        return closes
    except Exception:
        return None

def rescale_to_match_return(closes, target_return_pct):
    first, last = closes[0], closes[-1]
    actual_log_return = math.log(last / first)
    target_log_return = math.log(1 + target_return_pct / 100)
    if actual_log_return == 0:
        return closes
    scale = target_log_return / actual_log_return
    base_log = math.log(first)
    return [math.exp(base_log + (math.log(c) - base_log) * scale) for c in closes]

CARD_TEXT_DARK = (20, 22, 28)
CARD_TEXT_MUTED = (107, 114, 128)

def draw_chart_card(img, d, ticker, name, target_return_pct, rescaled_closes, trace_progress):
    CARD_W, CARD_H = 820, 460
    cx0 = (W - CARD_W) // 2
    cy0 = (H - CARD_H) // 2
    cx1 = cx0 + CARD_W
    cy1 = cy0 + CARD_H

    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle([cx0 + 6, cy0 + 10, cx1 + 6, cy1 + 10], radius=24, fill=(0, 0, 0, 60))
    img.alpha_composite(shadow)

    d.rounded_rectangle([cx0, cy0, cx1, cy1], radius=24, fill=(255, 255, 255, 255))

    n = len(rescaled_closes)
    idx = max(1, min(n - 1, int(round(trace_progress * (n - 1)))))
    current_return = (rescaled_closes[idx] / rescaled_closes[0] - 1) * 100
    colour = THEME["gain"] if current_return >= 0 else THEME["loss"]

    _text(d, (cx0 + 40, cy0 + 40), ticker, F_TICKER_SM, CARD_TEXT_DARK)
    _text(d, (cx0 + 40, cy0 + 100), "1-year return", F_NAME, CARD_TEXT_MUTED)

    pct_txt = signed(current_return)
    ptw, _ = _measure(d, pct_txt, F_RETURN_SM)
    _text(d, (cx1 - 40 - ptw, cy0 + 40), pct_txt, F_RETURN_SM, colour)

    chart_x0 = cx0 + 40
    chart_x1 = cx1 - 40
    chart_y0 = cy0 + 150
    chart_y1 = cy0 + 150 + 260
    chart_w = chart_x1 - chart_x0
    chart_h = chart_y1 - chart_y0

    lo, hi = min(rescaled_closes), max(rescaled_closes)
    span = (hi - lo) or 1

    visible = rescaled_closes[:idx + 1]
    points = []
    for i, c in enumerate(visible):
        x = chart_x0 + chart_w * i / max(1, n - 1)
        y = chart_y1 - (c - lo) / span * chart_h
        points.append((x, y))

    if len(points) >= 2:
        d.line(points, fill=colour, width=4, joint="curve")
    if points:
        lx, ly = points[-1]
        r = 7
        d.ellipse([lx - r, ly - r, lx + r, ly + r], fill=colour)

def render_frame(rows, tier_label, month_label, visible_ranks, part_num,
                 total_parts, t, chart_data=None):
    img = Image.new("RGBA", (W, H), THEME["ground"] + (255,))
    d = ImageDraw.Draw(img)

    draw_header(img, d, tier_label, month_label, len(rows))

    grow = min(max(t / 0.18, 0.0), 1.0)
    ease = 1 - (1 - grow) ** 3

    count = min(max(t / 0.30, 0.0), 1.0)
    count_ease = 1 - (1 - count) ** 2

    n_big = len(visible_ranks)
    big_h = ROW_SMALL + (ROW_BIG - ROW_SMALL) * ease

    total = n_big * big_h + (len(rows) - n_big) * ROW_SMALL + (len(rows) - 1) * GAP
    y = LIST_TOP + max(0, (LIST_BOTTOM - LIST_TOP - total) / 2)

    for row in rows:
        if row["rank"] in visible_ranks:
            draw_big_row(d, y, row, big_h, ease, row["ret"] * count_ease)
            y += big_h + GAP
        else:
            draw_small_row(d, y, row)
            y += ROW_SMALL + GAP

    HOLD_START, HOLD_END = 0.30, 0.80
    if chart_data and chart_data.get("stocks") and HOLD_START <= t <= HOLD_END:
        stocks = chart_data["stocks"]
        hold_progress = (t - HOLD_START) / (HOLD_END - HOLD_START)
        n_stocks = len(stocks)
        slot = 1.0 / n_stocks
        slot_idx = min(n_stocks - 1, int(hold_progress / slot))
        slot_progress = (hold_progress - slot_idx * slot) / slot

        trace_progress = min(1.0, slot_progress / 0.88)

        rank, ticker, name, ret, rescaled_closes = stocks[slot_idx]
        if rescaled_closes:
            draw_chart_card(img, d, ticker, name, ret, rescaled_closes, trace_progress)

    cta = min(max((t - 0.80) / 0.10, 0.0), 1.0)
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

    py = H - 6
    d.rectangle([0, py, W, H], fill=THEME["hairline"])
    seg = W / total_parts
    d.rectangle([0, py, seg * (part_num - 1) + seg * min(max(t, 0.0), 1.0), H], fill=THEME["accent"])

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
