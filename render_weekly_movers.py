#!/usr/bin/env python3
"""
render_weekly_movers.py — weekly "Top Movers" Shorts, one clip per cap tier.

Companion to render_movers.py (which does the monthly rank-change "What
Moved" video from monthly_rankings). This one is week-over-week price %
change from weekly_movers / weekly_price_snapshots (written by the
app/api/cron/refresh-weekly-movers Vercel cron route) — top 3 gainers and
top 3 losers per tier, one combined clip per tier (3 clips per run: large,
mid, small).

Look and feel (palette, fonts, header, wordmark) is imported from render_v2.py,
same as render_movers.py, so changing the theme there changes this too.

Usage
    python render_weekly_movers.py                    # latest week in the DB
    python render_weekly_movers.py --week 2026-W37-of-52
    python render_weekly_movers.py --tier large        # just one tier
    python render_weekly_movers.py --demo              # sample data, no DB needed
    python render_weekly_movers.py --keep-frames

Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local
in the working directory (same file the rest of the pipeline uses).

Requires ffmpeg on PATH.
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
import json

from PIL import Image, ImageDraw

from render_v2 import (
    W, H, FPS, THEME, PAD_X, TOP, LOGO_PATH,
    _font, _text, _measure, signed,
    _DISPLAY, _MONO, _MONO_REG, _SANS,
)

# ─── Fonts specific to this format (same sizing family as render_movers.py —
# these cards show up to 3 rows at a time, not 25, so type can run larger) ──
F_HERO       = _font(_DISPLAY, 132)
F_HERO_SUB   = _font(_MONO_REG, 40)
F_SECTION    = _font(_DISPLAY, 78)   # "TOP GAINERS" / "TOP LOSERS"
F_ROW_TICK   = _font(_DISPLAY, 74)
F_ROW_PCT    = _font(_MONO, 70)
F_ROW_NAME   = _font(_SANS, 32)
F_LABEL      = _font(_MONO_REG, 36)
F_END        = _font(_DISPLAY, 68)
F_END_SUB    = _font(_MONO_REG, 36)
F_DISC       = _font(_MONO_REG, 22)

DISCLAIMER = "Week-over-week price change only · Not financial advice"
TIER_LABEL = {"large": "Large Cap", "mid": "Mid Cap", "small": "Small Cap"}

# ─── Timeline (seconds) ─────────────────────────────────────────────────────
CARDS = [
    ("hook",      2.5),
    ("gainers",   6.0),
    ("losers",    6.0),
    ("end",       2.5),
]


# ─── Data ───────────────────────────────────────────────────────────────────
def load_env(path=".env.local"):
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


def fetch_latest_week(base_url, key):
    rows = supabase_get(base_url, key, "weekly_movers", {
        "select": "week_label",
        "order": "week_label.desc",
        "limit": "1",
    })
    if not rows:
        return None
    return rows[0]["week_label"]


def fetch_week_movers(base_url, key, week_label, tier):
    rows = supabase_get(base_url, key, "weekly_movers", {
        "select": "symbol,company_name,cap_tier,price_current,price_prior,pct_change,direction,rank_in_tier",
        "week_label": f"eq.{week_label}",
        "cap_tier": f"eq.{tier}",
        "order": "direction.asc,rank_in_tier.asc",
    })
    gainers = sorted([r for r in rows if r["direction"] == "gainer"],
                     key=lambda r: r["rank_in_tier"])
    losers = sorted([r for r in rows if r["direction"] == "loser"],
                    key=lambda r: r["rank_in_tier"])
    return gainers, losers


DEMO_GAINERS = [
    {"symbol": "ARWR", "company_name": "Arrowhead Pharmaceuticals", "pct_change": 18.4},
    {"symbol": "MDB", "company_name": "MongoDB", "pct_change": 11.2},
    {"symbol": "XOM", "company_name": "Exxon Mobil", "pct_change": 7.6},
]
DEMO_LOSERS = [
    {"symbol": "BILL", "company_name": "Bill.com Holdings", "pct_change": -14.1},
    {"symbol": "ETSY", "company_name": "Etsy", "pct_change": -9.8},
    {"symbol": "PATH", "company_name": "UiPath", "pct_change": -6.3},
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
    return tuple(int(b + (c - b) * amount)
                 for b, c in zip(THEME["ground"], colour))


# ─── Cards ──────────────────────────────────────────────────────────────────
def card_hook(d, img, t, tier_label, week_label):
    draw_wordmark(img, d)
    a = ease_out(t / 0.45)
    centered(d, 760, "TOP", F_HERO, fade(THEME["paper"], a))
    centered(d, 910, "MOVERS", F_HERO, fade(THEME["accent"], a))

    b = ease_out((t - 0.35) / 0.45)
    if b > 0:
        centered(d, 1100 - 30 * (1 - b), tier_label.upper(), F_HERO_SUB,
                 fade(THEME["paper"], b))
        centered(d, 1170 - 30 * (1 - b), f"THIS WEEK  ·  {week_label}",
                 F_DISC, fade(THEME["muted"], b))
    bar_w = 200 * ease_out(t / 0.5)
    if bar_w > 1:
        d.rectangle([(W - bar_w) / 2, 1260, (W + bar_w) / 2, 1266],
                    fill=THEME["accent"])


def card_list(d, img, t, rows, title, up):
    draw_wordmark(img, d)
    accent = THEME["gain"] if up else THEME["loss"]
    centered(d, 420, title, F_SECTION, THEME["paper"])
    d.rectangle([(W - 160) / 2, 520, (W + 160) / 2, 526], fill=accent)

    y = 660
    row_h = 380
    for i, m in enumerate(rows):
        a = ease_out((t - 0.10 - i * 0.14) / 0.32)
        if a <= 0.01:
            continue
        slide = 60 * (1 - a)
        top = y + i * row_h + slide

        d.rounded_rectangle([PAD_X, top, W - PAD_X, top + row_h - 40],
                            radius=20, fill=fade(THEME["surface_up"], a))

        _text(d, (PAD_X + 40, top + 36), m["symbol"], F_ROW_TICK,
              fade(THEME["paper"], a))
        name = (m.get("company_name") or "")[:30]
        if name:
            _text(d, (PAD_X + 42, top + 128), name, F_ROW_NAME,
                  fade(THEME["muted"], a))

        pct_txt = signed(m["pct_change"])
        tw, _ = _measure(d, pct_txt, F_ROW_PCT)
        _text(d, (W - PAD_X - 40 - tw, top + 60), pct_txt, F_ROW_PCT,
              fade(accent, a))


def card_end(d, img, t):
    draw_wordmark(img, d)
    a = ease_out(t / 0.4)
    centered(d, 880, "FULL TOP 25 LISTS", F_END, fade(THEME["paper"], a))
    centered(d, 970, "FREE · NO CARD REQUIRED", F_END_SUB,
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
        card_hook(d, img, t, ctx["tier_label"], ctx["week_label"])
    elif card == "gainers":
        card_list(d, img, t, ctx["gainers"], "TOP GAINERS", True)
    elif card == "losers":
        card_list(d, img, t, ctx["losers"], "TOP LOSERS", False)
    elif card == "end":
        card_end(d, img, t)

    draw_disclaimer(d)

    py = H - 6
    d.rectangle([0, py, W, H], fill=THEME["hairline"])
    d.rectangle([0, py, W * global_t, H], fill=THEME["accent"])

    return img.convert("RGB")


def build(ctx, out_path, fps=FPS, keep_frames=False):
    total_secs = sum(dur for _, dur in CARDS)
    tmp = tempfile.mkdtemp(prefix="weeklymovers_")
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--week", help="week_label, e.g. 2026-W37-of-52")
    ap.add_argument("--tier", choices=["large", "mid", "small"],
                    help="render just one tier instead of all three")
    ap.add_argument("--out-dir", default="monthly_videos",
                    help="output folder (shared with the monthly pipeline)")
    ap.add_argument("--fps", type=int, default=FPS)
    ap.add_argument("--demo", action="store_true",
                    help="use built-in sample data instead of Supabase")
    ap.add_argument("--keep-frames", action="store_true")
    args = ap.parse_args()

    tiers = [args.tier] if args.tier else ["large", "mid", "small"]
    os.makedirs(args.out_dir, exist_ok=True)

    if args.demo:
        week_label = args.week or "2026-W37-of-52"
        base = key = None
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
        week_label = args.week or fetch_latest_week(base, key)
        if not week_label:
            sys.exit("No weekly_movers rows found — has the weekly cron run yet?")
        print(f"rendering week {week_label}")

    for tier in tiers:
        if args.demo:
            gainers, losers = DEMO_GAINERS, DEMO_LOSERS
        else:
            gainers, losers = fetch_week_movers(base, key, week_label, tier)
            if not gainers and not losers:
                print(f"  no rows for {tier}/{week_label}, skipping.")
                continue

        ctx = {
            "tier_label": TIER_LABEL[tier],
            "week_label": week_label,
            "gainers": gainers,
            "losers": losers,
        }

        out = os.path.join(args.out_dir, f"weekly_movers_{tier}_{week_label}_final.mp4")
        print(f"{tier}: gainers={[g['symbol'] for g in gainers]} "
              f"losers={[l['symbol'] for l in losers]}")
        n, secs = build(ctx, out, fps=args.fps, keep_frames=args.keep_frames)
        print(f"  -> wrote {out}  ({n} frames, {secs:.1f}s)")


if __name__ == "__main__":
    main()
