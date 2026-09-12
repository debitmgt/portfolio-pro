#!/usr/bin/env python3
"""
render_movers.py — monthly "What Moved" Short.

One self-contained ~34s vertical video per month, instead of 13 parts. Pulls
the current and prior month's Top 25 straight from Supabase, works out the
rank changes, and renders the cards described in the storyboard.

Look and feel (palette, fonts, header, wordmark) is imported from render_v2.py
rather than copied, so changing the theme there changes it here too.

Usage
    python render_movers.py                     # latest two periods in the DB
    python render_movers.py --period 2026-09    # pin the current month
    python render_movers.py --demo              # sample data, no DB needed
    python render_movers.py --keep-frames       # leave the PNGs behind

Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local
in the working directory (same file the rest of the pipeline uses).

Requires ffmpeg on PATH.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from collections import defaultdict

from PIL import Image, ImageDraw

from render_v2 import (
    W, H, FPS, THEME, PAD_X, TOP, LOGO_PATH,
    _font, _text, _measure, signed,
    _DISPLAY, _MONO, _MONO_REG, _SANS,
)

# ─── Fonts specific to this format ──────────────────────────────────────────
# render_v2's sizes are tuned for a 25-row list. These cards show 1-5 items at
# a time, so the type can be much larger.
F_HERO       = _font(_DISPLAY, 132)   # the single big word on the hook card
F_HERO_SUB   = _font(_MONO_REG, 40)
F_SECTION    = _font(_DISPLAY, 78)    # "BIGGEST CLIMBERS"
F_BIGTICK    = _font(_DISPLAY, 150)   # spotlight ticker
F_RANKJUMP   = _font(_MONO, 110)      # "#2 → #16"
F_ROW_TICK   = _font(_DISPLAY, 68)
F_ROW_MOVE   = _font(_MONO, 68)
F_ROW_TIER   = _font(_MONO_REG, 34)
F_LABEL      = _font(_MONO_REG, 36)
F_COUNTER    = _font(_MONO, 62)
F_END        = _font(_DISPLAY, 68)
F_END_SUB    = _font(_MONO_REG, 36)
F_DISC       = _font(_MONO_REG, 22)   # persistent bottom disclaimer

DISCLAIMER = "Historical performance only  \u00b7  Not financial advice"

TIER_LABEL = {"large": "Large Cap", "mid": "Mid Cap", "small": "Small Cap"}

# ─── Timeline (seconds) ─────────────────────────────────────────────────────
# Each card is (name, duration). Total drives the frame count.
CARDS = [
    ("hook",      3.0),
    ("spotlight_down", 6.0),
    ("spotlight_up",   6.0),
    ("climbers",  7.0),
    ("decliners", 6.0),
    ("still_one", 4.0),
    ("end",       2.5),
]


# ─── Data ───────────────────────────────────────────────────────────────────
def load_env(path=".env.local"):
    """Minimal .env reader — avoids adding python-dotenv as a dependency."""
    env = {}
    if not os.path.exists(path):
        return env
    with open(path, "r", encoding="utf-8-sig") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def supabase_get(base_url, key, table, params):
    url = f"{base_url.rstrip('/')}/rest/v1/{table}?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def fetch_periods(base_url, key):
    """Distinct period_labels, newest first."""
    rows = supabase_get(base_url, key, "monthly_rankings", {
        "select": "period_label",
        "order": "period_label.desc",
        "limit": "2000",
    })
    seen = []
    for r in rows:
        if r["period_label"] not in seen:
            seen.append(r["period_label"])
    return seen


def fetch_top25(base_url, key, period):
    rows = supabase_get(base_url, key, "monthly_rankings", {
        "select": "symbol,cap_tier,rank,trailing_return_1y,company_name",
        "period_label": f"eq.{period}",
        "rank": "lte.25",
        "order": "cap_tier.asc,rank.asc",
    })
    return rows


def compute_movers(cur_rows, prev_rows):
    """Returns (climbers, decliners, new_entries, leaders).

    A symbol is matched within its own tier — a name that changes cap tier is
    reported as a new entry there rather than as a rank move, because its old
    rank belonged to a different list.
    """
    prev_rank = {(r["cap_tier"], r["symbol"]): r["rank"] for r in prev_rows}
    prev_ret = {(r["cap_tier"], r["symbol"]): r["trailing_return_1y"] for r in prev_rows}

    moves, new_entries = [], []
    leaders = {}

    for r in cur_rows:
        keyed = (r["cap_tier"], r["symbol"])
        if r["rank"] == 1:
            leaders[r["cap_tier"]] = r
        if keyed in prev_rank:
            delta = prev_rank[keyed] - r["rank"]
            if delta != 0:
                moves.append({
                    "symbol": r["symbol"],
                    "tier": r["cap_tier"],
                    "prev": prev_rank[keyed],
                    "cur": r["rank"],
                    "delta": delta,
                    "prev_ret": prev_ret[keyed],
                    "cur_ret": r["trailing_return_1y"],
                })
        else:
            new_entries.append(r)

    climbers = sorted([m for m in moves if m["delta"] > 0],
                      key=lambda m: -m["delta"])[:5]
    decliners = sorted([m for m in moves if m["delta"] < 0],
                       key=lambda m: m["delta"])[:5]
    return climbers, decliners, new_entries, leaders


DEMO_CUR = [
    {"symbol": "ARWR", "cap_tier": "large", "rank": 1, "trailing_return_1y": 274.0},
    {"symbol": "MDB", "cap_tier": "large", "rank": 16, "trailing_return_1y": 40.4},
    {"symbol": "RTX", "cap_tier": "large", "rank": 24, "trailing_return_1y": 31.8},
    {"symbol": "XOM", "cap_tier": "large", "rank": 17, "trailing_return_1y": 38.3},
    {"symbol": "CDNA", "cap_tier": "mid", "rank": 1, "trailing_return_1y": 266.8},
    {"symbol": "ETSY", "cap_tier": "mid", "rank": 14, "trailing_return_1y": 53.4},
    {"symbol": "BEAM", "cap_tier": "mid", "rank": 9, "trailing_return_1y": 74.0},
    {"symbol": "PATH", "cap_tier": "mid", "rank": 11, "trailing_return_1y": 61.2},
    {"symbol": "BILL", "cap_tier": "mid", "rank": 25, "trailing_return_1y": 6.1},
    {"symbol": "ANAB", "cap_tier": "small", "rank": 1, "trailing_return_1y": 320.9},
    {"symbol": "EDIT", "cap_tier": "small", "rank": 13, "trailing_return_1y": 19.2},
    {"symbol": "AMPL", "cap_tier": "small", "rank": 12, "trailing_return_1y": 22.0},
    {"symbol": "TNDM", "cap_tier": "small", "rank": 8, "trailing_return_1y": 81.8},
]
DEMO_PREV = [
    {"symbol": "ARWR", "cap_tier": "large", "rank": 1, "trailing_return_1y": 361.3},
    {"symbol": "MDB", "cap_tier": "large", "rank": 2, "trailing_return_1y": 125.2},
    {"symbol": "RTX", "cap_tier": "large", "rank": 16, "trailing_return_1y": 43.8},
    {"symbol": "XOM", "cap_tier": "large", "rank": 12, "trailing_return_1y": 49.1},
    {"symbol": "CDNA", "cap_tier": "mid", "rank": 1, "trailing_return_1y": 283.4},
    {"symbol": "ETSY", "cap_tier": "mid", "rank": 21, "trailing_return_1y": 17.1},
    {"symbol": "BEAM", "cap_tier": "mid", "rank": 15, "trailing_return_1y": 51.7},
    {"symbol": "PATH", "cap_tier": "mid", "rank": 16, "trailing_return_1y": 49.2},
    {"symbol": "BILL", "cap_tier": "mid", "rank": 18, "trailing_return_1y": 26.1},
    {"symbol": "ANAB", "cap_tier": "small", "rank": 1, "trailing_return_1y": 339.3},
    {"symbol": "EDIT", "cap_tier": "small", "rank": 22, "trailing_return_1y": -4.7},
    {"symbol": "AMPL", "cap_tier": "small", "rank": 16, "trailing_return_1y": 14.7},
    {"symbol": "TNDM", "cap_tier": "small", "rank": 4, "trailing_return_1y": 113.1},
]


# ─── Drawing helpers ────────────────────────────────────────────────────────
def ease_out(t):
    return 1 - (1 - min(max(t, 0.0), 1.0)) ** 3


def new_frame():
    img = Image.new("RGBA", (W, H), THEME["ground"] + (255,))
    return img, ImageDraw.Draw(img)


def draw_wordmark(img, d):
    y = TOP
    if os.path.exists(LOGO_PATH):
        try:
            logo = Image.open(LOGO_PATH).convert("RGBA")
            tw = 300
            logo = logo.resize((tw, max(1, int(logo.height * tw / logo.width))),
                               Image.LANCZOS)
            faded = Image.new("RGBA", logo.size, (0, 0, 0, 0))
            faded = Image.blend(faded, logo, 0.55)
            img.alpha_composite(faded, (PAD_X, y))
            return
        except OSError:
            pass
    _text(d, (PAD_X, y), "OWNFOLIO.NET", F_LABEL, THEME["muted"])


def draw_disclaimer(d):
    tw, _ = _measure(d, DISCLAIMER, F_DISC)
    _text(d, ((W - tw) / 2, H - 54), DISCLAIMER, F_DISC, THEME["muted"])


def centered(d, y, text, font, fill):
    tw, _ = _measure(d, text, font)
    _text(d, ((W - tw) / 2, y), text, font, fill)


def fade(colour, amount):
    """Blend a colour toward the background. amount 0..1, 1 = full colour."""
    return tuple(int(b + (c - b) * amount)
                 for b, c in zip(THEME["ground"], colour))


# ─── Cards ──────────────────────────────────────────────────────────────────
def card_hook(d, img, t, month_label):
    draw_wordmark(img, d)
    a = ease_out(t / 0.45)
    centered(d, 780, "WHAT", F_HERO, fade(THEME["paper"], a))
    centered(d, 930, "MOVED", F_HERO, fade(THEME["accent"], a))

    b = ease_out((t - 0.35) / 0.45)
    if b > 0:
        centered(d, 1120 - 30 * (1 - b), month_label.upper(), F_HERO_SUB,
                 fade(THEME["paper"], b))
        centered(d, 1190 - 30 * (1 - b), "TOP 25 RANK CHANGES  \u00b7  3 CAP TIERS",
                 F_DISC, fade(THEME["muted"], b))
    bar_w = 200 * ease_out(t / 0.5)
    if bar_w > 1:
        d.rectangle([(W - bar_w) / 2, 1280, (W + bar_w) / 2, 1286],
                    fill=THEME["accent"])


def card_spotlight(d, img, t, mover, kind):
    """kind: 'down' or 'up'. Rank flips, then the return counter animates."""
    draw_wordmark(img, d)
    up = kind == "up"
    accent = THEME["gain"] if up else THEME["loss"]

    label = "BIGGEST CLIMBER" if up else "BIGGEST DECLINER"
    centered(d, 470, label, F_LABEL, THEME["muted"])

    a = ease_out(t / 0.25)
    centered(d, 560, mover["symbol"], F_BIGTICK, fade(THEME["paper"], a))
    centered(d, 750, TIER_LABEL.get(mover["tier"], mover["tier"]).upper(),
             F_LABEL, fade(THEME["muted"], a))

    # Rank flip: hold the old rank, then snap to the new one at t=0.42
    b = ease_out((t - 0.20) / 0.30)
    if b > 0:
        flipped = t >= 0.42
        shown = mover["cur"] if flipped else mover["prev"]
        line = f"#{mover['prev']}  \u2192  #{shown}"
        tw, _ = _measure(d, line, F_RANKJUMP)
        # slight lift on the flip so the eye catches it
        lift = 12 if 0.42 <= t <= 0.50 else 0
        _text(d, ((W - tw) / 2, 990 - lift), line, F_RANKJUMP,
              fade(accent if flipped else THEME["paper"], b))

    # Return counter
    c = ease_out((t - 0.45) / 0.45)
    if c > 0:
        cur = mover["prev_ret"] + (mover["cur_ret"] - mover["prev_ret"]) * c
        centered(d, 1250, "1-YEAR RETURN", F_DISC, fade(THEME["muted"], c))
        # recolour live so a crossing of zero is visible
        col = THEME["gain"] if cur >= 0 else THEME["loss"]
        centered(d, 1310, signed(cur), F_COUNTER, fade(col, c))

        bar_y = 1440
        span_w = 620
        x0 = (W - span_w) / 2
        d.rounded_rectangle([x0, bar_y, x0 + span_w, bar_y + 10], radius=5,
                            fill=THEME["hairline"])
        d.rounded_rectangle([x0, bar_y, x0 + span_w * c, bar_y + 10], radius=5,
                            fill=col)


def card_list(d, img, t, rows, title, up):
    draw_wordmark(img, d)
    accent = THEME["gain"] if up else THEME["loss"]
    centered(d, 450, title, F_SECTION, THEME["paper"])
    d.rectangle([(W - 160) / 2, 550, (W + 160) / 2, 556], fill=accent)

    y = 690
    row_h = 190
    for i, m in enumerate(rows):
        # stagger: each row appears 0.11 later than the last
        a = ease_out((t - 0.10 - i * 0.11) / 0.30)
        if a <= 0.01:
            continue
        slide = 60 * (1 - a)
        top = y + i * row_h + slide

        d.rounded_rectangle([PAD_X, top, W - PAD_X, top + row_h - 26],
                            radius=18, fill=fade(THEME["surface_up"], a))

        _text(d, (PAD_X + 40, top + 30), m["symbol"], F_ROW_TICK,
              fade(THEME["paper"], a))
        _text(d, (PAD_X + 42, top + 108),
              TIER_LABEL.get(m["tier"], m["tier"]).upper(), F_ROW_TIER,
              fade(THEME["muted"], a))

        arrow = "\u25b2" if up else "\u25bc"
        move = f"{arrow} {abs(m['delta'])}"
        tw, _ = _measure(d, move, F_ROW_MOVE)
        _text(d, (W - PAD_X - 40 - tw, top + 52), move, F_ROW_MOVE,
              fade(accent, a))

        rank_txt = f"#{m['prev']} \u2192 #{m['cur']}"
        rw, _ = _measure(d, rank_txt, F_ROW_TIER)
        _text(d, (W - PAD_X - 40 - rw, top + 128), rank_txt, F_ROW_TIER,
              fade(THEME["muted"], a))


def card_still_one(d, img, t, leaders):
    draw_wordmark(img, d)
    centered(d, 560, "STILL #1", F_SECTION, THEME["paper"])
    d.rectangle([(W - 160) / 2, 660, (W + 160) / 2, 666], fill=THEME["accent"])

    y = 820
    row_h = 200
    order = [k for k in ("large", "mid", "small") if k in leaders]
    for i, tier in enumerate(order):
        r = leaders[tier]
        a = ease_out((t - 0.12 - i * 0.14) / 0.32)
        if a <= 0.01:
            continue
        top = y + i * row_h + 50 * (1 - a)
        d.rounded_rectangle([PAD_X, top, W - PAD_X, top + row_h - 30],
                            radius=18, fill=fade(THEME["surface_up"], a))
        _text(d, (PAD_X + 40, top + 32), r["symbol"], F_ROW_TICK,
              fade(THEME["paper"], a))
        _text(d, (PAD_X + 42, top + 110), TIER_LABEL[tier].upper(),
              F_ROW_TIER, fade(THEME["muted"], a))
        rt = signed(r["trailing_return_1y"])
        tw, _ = _measure(d, rt, F_ROW_MOVE)
        _text(d, (W - PAD_X - 40 - tw, top + 58), rt, F_ROW_MOVE,
              fade(THEME["gain"], a))

    b = ease_out((t - 0.55) / 0.35)
    if b > 0:
        centered(d, 1480, "UNCHANGED FROM LAST MONTH", F_DISC,
                 fade(THEME["muted"], b))


def card_end(d, img, t):
    draw_wordmark(img, d)
    a = ease_out(t / 0.4)
    centered(d, 880, "FULL TOP 25 LISTS", F_END, fade(THEME["paper"], a))
    centered(d, 970, "FREE \u00b7 NO CARD REQUIRED", F_END_SUB,
             fade(THEME["muted"], a))
    b = ease_out((t - 0.25) / 0.4)
    if b > 0:
        centered(d, 1110, "ownfolio.net", F_END, fade(THEME["accent"], b))
        bw = 240 * b
        d.rectangle([(W - bw) / 2, 1220, (W + bw) / 2, 1226],
                    fill=THEME["accent"])


# ─── Frame dispatch ─────────────────────────────────────────────────────────
def render_frame(card, t, ctx, global_t):
    img, d = new_frame()

    if card == "hook":
        card_hook(d, img, t, ctx["month_label"])
    elif card == "spotlight_down":
        if ctx["decliners"]:
            card_spotlight(d, img, t, ctx["decliners"][0], "down")
    elif card == "spotlight_up":
        if ctx["climbers"]:
            card_spotlight(d, img, t, ctx["climbers"][0], "up")
    elif card == "climbers":
        card_list(d, img, t, ctx["climbers"], "BIGGEST CLIMBERS", True)
    elif card == "decliners":
        card_list(d, img, t, ctx["decliners"], "BIGGEST DECLINERS", False)
    elif card == "still_one":
        card_still_one(d, img, t, ctx["leaders"])
    elif card == "end":
        card_end(d, img, t)

    draw_disclaimer(d)

    # progress hairline along the very bottom
    py = H - 6
    d.rectangle([0, py, W, H], fill=THEME["hairline"])
    d.rectangle([0, py, W * global_t, H], fill=THEME["accent"])

    return img.convert("RGB")


def build(ctx, out_path, fps=FPS, keep_frames=False):
    total_secs = sum(dur for _, dur in CARDS)
    tmp = tempfile.mkdtemp(prefix="movers_")
    n = 0
    elapsed = 0.0

    try:
        for card, dur in CARDS:
            frames = int(round(dur * fps))
            for i in range(frames):
                t = i / max(1, frames - 1)
                global_t = (elapsed + i / fps) / total_secs
                frame = render_frame(card, t, ctx, min(1.0, global_t))
                frame.save(os.path.join(tmp, f"f{n:05d}.png"))
                n += 1
            elapsed += dur

        cmd = [
            "ffmpeg", "-y", "-framerate", str(fps),
            "-i", os.path.join(tmp, "f%05d.png"),
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-profile:v", "high", "-crf", "18",
            "-movflags", "+faststart",
            out_path,
        ]
        subprocess.run(cmd, check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    finally:
        if keep_frames:
            print(f"frames kept in {tmp}")
        else:
            shutil.rmtree(tmp, ignore_errors=True)

    return n, total_secs


def month_name(period):
    """'2026-09' -> 'September 2026'"""
    try:
        y, m = period.split("-")
        names = ["January", "February", "March", "April", "May", "June", "July",
                 "August", "September", "October", "November", "December"]
        return f"{names[int(m) - 1]} {y}"
    except (ValueError, IndexError):
        return period


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--period", help="current period_label, e.g. 2026-09")
    ap.add_argument("--prev", help="prior period_label to compare against")
    ap.add_argument("--out", default=None, help="output mp4 path")
    ap.add_argument("--fps", type=int, default=FPS)
    ap.add_argument("--demo", action="store_true",
                    help="use built-in sample data instead of Supabase")
    ap.add_argument("--keep-frames", action="store_true")
    args = ap.parse_args()

    if args.demo:
        cur_rows, prev_rows = DEMO_CUR, DEMO_PREV
        period = args.period or "2026-09"
    else:
        env = load_env()
        base = env.get("NEXT_PUBLIC_SUPABASE_URL")
        key = env.get("SUPABASE_SERVICE_ROLE_KEY")
        if not base or not key:
            sys.exit("Missing NEXT_PUBLIC_SUPABASE_URL or "
                     "SUPABASE_SERVICE_ROLE_KEY in .env.local")
        if key.strip() in ("[SENSITIVE]", ""):
            sys.exit("SUPABASE_SERVICE_ROLE_KEY reads as [SENSITIVE]. "
                     "Remove the Sensitive flag in Vercel and re-pull.")

        periods = fetch_periods(base, key)
        if len(periods) < 2:
            sys.exit(f"Need two periods to compare; found {periods}")
        period = args.period or periods[0]
        prev = args.prev or next((p for p in periods if p < period), None)
        if not prev:
            sys.exit(f"No period earlier than {period} to compare against")

        print(f"comparing {period} against {prev}")
        cur_rows = fetch_top25(base, key, period)
        prev_rows = fetch_top25(base, key, prev)
        if not cur_rows or not prev_rows:
            sys.exit("One of the periods returned no rows")

    climbers, decliners, new_entries, leaders = compute_movers(cur_rows, prev_rows)

    if not climbers and not decliners:
        sys.exit("No rank changes found between those periods — nothing to show")

    ctx = {
        "month_label": month_name(period),
        "climbers": climbers,
        "decliners": decliners,
        "new_entries": new_entries,
        "leaders": leaders,
    }

    out = args.out or os.path.join("monthly_videos",
                                   f"movers_{period}_final.mp4")
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)

    print(f"climbers: {[m['symbol'] for m in climbers]}")
    print(f"decliners: {[m['symbol'] for m in decliners]}")
    print(f"new entries: {len(new_entries)}")

    n, secs = build(ctx, out, fps=args.fps, keep_frames=args.keep_frames)
    print(f"wrote {out}  ({n} frames, {secs:.1f}s)")


if __name__ == "__main__":
    main()
