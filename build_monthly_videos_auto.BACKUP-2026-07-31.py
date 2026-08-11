#!/usr/bin/env python3
"""
build_monthly_videos_auto.py

Rebuilt version — the original copy of this script (which fetched Supabase
data automatically, generated narration text, called ElevenLabs for voice,
and merged audio into the rendered video for all 3 cap tiers) was lost; it
was never committed to git and had no backup, so this reconstructs the same
pipeline from the run_monthly_videos_log.txt output plus the table-rendering
code, and adds the new 13-part spotlight series on top.

For each of the 3 cap tiers (large/mid/small), this:
  1. Fetches that tier's current-month Top-N ranking rows from Supabase
  2. For each of the 13 parts (see build_episode_list), generates narration
     text describing that part's spotlighted rank(s)
  3. Calls ElevenLabs to synthesize that narration as audio
  4. Renders the silent teaser video, timed to match the narration length
  5. Merges video + narration into a final .mp4

Run with:  python build_monthly_videos_auto.py --voice-id <ELEVENLABS_VOICE_ID>

Requires a .env.local file in the same folder with:
  NEXT_PUBLIC_SUPABASE_URL=...
  SUPABASE_SERVICE_ROLE_KEY=...
  ELEVENLABS_API_KEY=...
"""
import argparse
import datetime
import json
import os
import shutil
import subprocess
import sys
import urllib.request
import urllib.error

from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1080, 1920
ORANGE = (255, 106, 0)
WHITE = (255, 255, 255)
BLACK = (20, 20, 20)
GRAY = (110, 110, 110)
GREEN = (15, 110, 86)
RED = (163, 45, 45)
HEADER_H = 190
ROW_H = 68

TIERS = [
    ("large", "Large Cap"),
    ("mid", "Mid Cap"),
    ("small", "Small Cap"),
]

OUT_DIR = "./monthly_videos"


# ─── Env loading (reads .env.local directly — this script runs standalone,
# not through Next.js, so it can't rely on process.env being populated) ─────
def load_env_local(path=".env.local"):
    env = {}
    if not os.path.exists(path):
        return env
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env


# ─── Fonts (unchanged from the original rendering code) ────────────────────
def _find_font(candidates, size):
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()

FONT_DIR = "/usr/share/fonts/truetype/dejavu/"
WIN_FONT_DIR = "C:\\Windows\\Fonts\\"

_BOLD_CANDIDATES = [FONT_DIR + "DejaVuSans-Bold.ttf", WIN_FONT_DIR + "arialbd.ttf", WIN_FONT_DIR + "segoeuib.ttf"]
_REG_CANDIDATES = [FONT_DIR + "DejaVuSans.ttf", WIN_FONT_DIR + "arial.ttf", WIN_FONT_DIR + "segoeui.ttf"]
_SERIF_BOLD_CANDIDATES = [FONT_DIR + "DejaVuSerif-Bold.ttf", WIN_FONT_DIR + "georgiab.ttf", WIN_FONT_DIR + "timesbd.ttf"] + _BOLD_CANDIDATES

F_BOLD = _find_font(_BOLD_CANDIDATES, 26)
F_REG = _find_font(_REG_CANDIDATES, 22)
F_HEADER = _find_font(_BOLD_CANDIDATES, 40)
F_SUB = _find_font(_REG_CANDIDATES, 24)
F_RANK = _find_font(_BOLD_CANDIDATES, 24)
F_LOGO_S = _find_font(_BOLD_CANDIDATES, 34)
F_CTA = _find_font(_BOLD_CANDIDATES, 36)
F_LOGO_CARD = _find_font(_SERIF_BOLD_CANDIDATES, 54)


# ─── Rendering (unchanged mechanics from today's rebuild) ──────────────────
def render_logo_card():
    img = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(img)
    text = "Ownfolio.net"
    bbox = d.textbbox((0, 0), text, font=F_LOGO_CARD)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((W - tw) / 2, (H - th) / 2 - bbox[1]), text, font=F_LOGO_CARD, fill=ORANGE)
    return img

def draw_header(d, tier_label, month_label, row_count=25):
    d.rectangle([0, 0, W, HEADER_H], fill=ORANGE)
    d.rectangle([50, 55, 110, 115], fill=WHITE)
    bbox = d.textbbox((0, 0), "O", font=F_LOGO_S)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text((80 - tw / 2, 85 - th / 2 - bbox[1]), "O", font=F_LOGO_S, fill=ORANGE)
    d.text((130, 48), "OWNFOLIO.NET", font=F_HEADER, fill=WHITE)
    d.text((130, 105), f"{tier_label} top {row_count} - {month_label}", font=F_SUB, fill=WHITE)

def draw_row(d, y, row):
    rank, ticker, name, ret = row["rank"], row["ticker"], row["name"], row["ret"]
    bg = (247, 247, 245) if rank % 2 == 0 else WHITE
    d.rectangle([0, y, W, y + ROW_H], fill=bg)
    d.text((24, y + ROW_H / 2 - 12), str(rank), font=F_RANK, fill=GRAY)
    d.text((80, y + ROW_H / 2 - 14), ticker, font=F_BOLD, fill=BLACK)
    d.text((230, y + ROW_H / 2 - 12), name[:22], font=F_REG, fill=GRAY)
    ret_color = GREEN if ret >= 0 else RED
    ret_text = f"{'+' if ret >= 0 else ''}{ret:.1f}%"
    bbox = d.textbbox((0, 0), ret_text, font=F_BOLD)
    tw = bbox[2] - bbox[0]
    d.text((W - 40 - tw, y + ROW_H / 2 - 14), ret_text, font=F_BOLD, fill=ret_color)

def render_table_variant(rows, tier_label, month_label, visible_ranks):
    total_h = HEADER_H + len(rows) * ROW_H
    img = Image.new("RGB", (W, total_h), WHITE)
    d = ImageDraw.Draw(img)
    draw_header(d, tier_label, month_label, row_count=len(rows))
    for i, row in enumerate(rows):
        y = HEADER_H + i * ROW_H
        draw_row(d, y, row)
    blurred = img.filter(ImageFilter.GaussianBlur(radius=6))
    out = blurred.copy()
    for i, row in enumerate(rows):
        if row["rank"] in visible_ranks:
            y = HEADER_H + i * ROW_H
            out.paste(img.crop((0, y, W, y + ROW_H)), (0, y))
    return out

def build_episode_list(rows):
    """Part 1 = (rank 1, rank N) — the original video's pair. Then working
    inward: (2,N-1), (3,N-2), ... and finally the middle rank alone as the
    last part. For a 25-row list this produces 13 parts."""
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

def add_cta_frame(base_frame, cta_lines):
    frame = base_frame.copy()
    d = ImageDraw.Draw(frame, "RGBA")
    d.rectangle([0, H - 260, W, H], fill=(0, 0, 0, 200))
    y = H - 220
    for line, font, color in cta_lines:
        bbox = d.textbbox((0, 0), line, font=font)
        tw = bbox[2] - bbox[0]
        d.text(((W - tw) / 2, y), line, font=font, fill=color)
        y += 50
    return frame


# ─── Narration text per part ────────────────────────────────────────────────
def rows_by_rank(rows):
    return {r["rank"]: r for r in rows}

def move_phrase(ret):
    """'up 12 percent' or 'down 12 percent' — never 'up -12 percent'."""
    direction = "up" if ret >= 0 else "down"
    return f"{direction} {abs(ret):.0f} percent"

def narration_for_part(tier_label, month_label, rows, part_num, total_parts, visible_ranks):
    by_rank = rows_by_rank(rows)
    n = len(rows)
    if part_num == 1:
        top, bottom = min(visible_ranks), max(visible_ranks)
        r_top, r_bot = by_rank[top], by_rank[bottom]
        return (
            f"{tier_label} script, part 1 of {total_parts}. "
            f"Number one this month — {r_top['name']}, {move_phrase(r_top['ret'])}. "
            f"That's out of the {tier_label} top {n}, ranked by trailing return. "
            f"And at rank {bottom} — {r_bot['name']}, {move_phrase(r_bot['ret'])}. "
            f"The rest of the list is free to see — link's in the bio."
        )
    if len(visible_ranks) == 1:
        rank = next(iter(visible_ranks))
        r = by_rank[rank]
        return (
            f"{tier_label} script, part {part_num} of {total_parts} — the middle of the list. "
            f"Rank {rank} — {r['name']}, {move_phrase(r['ret'])}. "
            f"See the full {tier_label} top {n} — link's in the bio."
        )
    a, b = sorted(visible_ranks)
    r_a, r_b = by_rank[a], by_rank[b]
    return (
        f"{tier_label} script, part {part_num} of {total_parts}. "
        f"Rank {a} — {r_a['name']}, {move_phrase(r_a['ret'])}. "
        f"And rank {b} — {r_b['name']}, {move_phrase(r_b['ret'])}. "
        f"See the full {tier_label} top {n} — link's in the bio."
    )


# ─── ElevenLabs voice synthesis ─────────────────────────────────────────────
def synthesize_voice(text, voice_id, api_key, out_path):
    """Calls ElevenLabs' text-to-speech endpoint and writes the mp3 to
    out_path. Standard documented ElevenLabs REST API — not tested against
    a live account from this environment (no network access to elevenlabs.io
    here), so verify this works on the first real run."""
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    payload = json.dumps({
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }).encode("utf-8")

    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("xi-api-key", api_key)
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "audio/mpeg")

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            audio_bytes = resp.read()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"ElevenLabs TTS failed ({e.code}): {e.read().decode(errors='replace')}") from e

    with open(out_path, "wb") as f:
        f.write(audio_bytes)

def get_audio_duration(path):
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture_output=True, text=True, check=True,
    )
    return float(result.stdout.strip())


# ─── Supabase fetch ──────────────────────────────────────────────────────────
def fetch_tier_rows(supabase_url, service_key, cap_tier, period_label):
    """Pulls this tier's ranking rows for the given period via Supabase's
    REST (PostgREST) API. Standard Supabase REST conventions — verify the
    table/column names still match your schema on the first real run."""
    url = (
        f"{supabase_url}/rest/v1/monthly_rankings"
        f"?cap_tier=eq.{cap_tier}&period_label=eq.{period_label}"
        f"&select=rank,symbol,company_name,trailing_return_1y&order=rank.asc&rank=lte.25"
    )
    req = urllib.request.Request(url, method="GET")
    req.add_header("apikey", service_key)
    req.add_header("Authorization", f"Bearer {service_key}")

    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = json.loads(resp.read())

    rows = []
    for r in raw:
        if r.get("trailing_return_1y") is None:
            continue
        rows.append({
            "rank": r["rank"],
            "ticker": r["symbol"],
            "name": r.get("company_name") or r["symbol"],
            "ret": float(r["trailing_return_1y"]),
        })
    return rows


# ─── Video building for one part ────────────────────────────────────────────
def build_part_video(rows, tier_label, month_label, visible_ranks, part_num, total_parts,
                      narration_audio_path, narration_duration, out_path, fps=30):
    tmpdir = "_frames_tmp"
    if os.path.exists(tmpdir):
        shutil.rmtree(tmpdir)
    os.makedirs(tmpdir)

    # Same 30/35/35 hook/scroll/hold split observed in the original log
    # output, sized to the actual narration length so video and voice
    # always match up regardless of how long a given line of narration is.
    hook_seconds = narration_duration * 0.30
    scroll_seconds = narration_duration * 0.35
    hold_seconds = narration_duration * 0.35

    table = render_table_variant(rows, tier_label, month_label, visible_ranks=visible_ranks)
    total_h = table.height
    scrollable = max(total_h - H, 0)
    frame_idx = 0

    top_view = table.crop((0, 0, W, H))
    for _ in range(int(fps * hook_seconds)):
        top_view.save(f"{tmpdir}/f{frame_idx:05d}.jpg", quality=90)
        frame_idx += 1

    scroll_frames = int(fps * scroll_seconds)
    for i in range(scroll_frames):
        offset = int(scrollable * (i / max(scroll_frames - 1, 1)))
        table.crop((0, offset, W, offset + H)).save(f"{tmpdir}/f{frame_idx:05d}.jpg", quality=90)
        frame_idx += 1

    bottom_view = table.crop((0, total_h - H, W, total_h))
    ranks_text = " & ".join(f"#{r}" for r in sorted(visible_ranks))
    cta_view = add_cta_frame(bottom_view, [
        (f"Part {part_num} of {total_parts} - Rank {ranks_text}", F_CTA, WHITE),
        ("See the full list free - link in bio", F_REG, (230, 230, 230)),
    ])
    for _ in range(int(fps * hold_seconds)):
        cta_view.save(f"{tmpdir}/f{frame_idx:05d}.jpg", quality=90)
        frame_idx += 1

    silent_path = out_path.replace("_final.mp4", "_silent.mp4")
    subprocess.run([
        "ffmpeg", "-y", "-framerate", str(fps), "-i", f"{tmpdir}/f%05d.jpg",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-vf", f"scale={W}:{H}",
        silent_path,
    ], check=True, capture_output=True)
    shutil.rmtree(tmpdir)

    subprocess.run([
        "ffmpeg", "-y", "-i", silent_path, "-i", narration_audio_path,
        "-c:v", "copy", "-c:a", "aac", "-shortest", out_path,
    ], check=True, capture_output=True)

    # The silent video and voice-only audio were just merged into out_path —
    # only the finished _final.mp4 should be left behind in the folder.
    os.remove(silent_path)
    os.remove(narration_audio_path)

    print(f"  -> {out_path}")


def run(voice_id):
    env = load_env_local()
    supabase_url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    elevenlabs_key = env.get("ELEVENLABS_API_KEY")
    missing = [name for name, val in [
        ("NEXT_PUBLIC_SUPABASE_URL", supabase_url),
        ("SUPABASE_SERVICE_ROLE_KEY", service_key),
        ("ELEVENLABS_API_KEY", elevenlabs_key),
    ] if not val]
    if missing:
        print(f"Missing required values in .env.local: {', '.join(missing)}")
        sys.exit(1)

    period_label = datetime.date.today().strftime("%Y-%m")
    os.makedirs(OUT_DIR, exist_ok=True)

    for cap_tier, tier_label in TIERS:
        print(f"\n=== {tier_label} ({period_label}) ===")
        rows = fetch_tier_rows(supabase_url, service_key, cap_tier, period_label)
        if not rows:
            print(f"  No rows found for {cap_tier}/{period_label} — skipping.")
            continue

        episodes = build_episode_list(rows)
        total_parts = len(episodes)

        for i, pair in enumerate(episodes, start=1):
            visible_ranks = set(pair)
            text = narration_for_part(tier_label, period_label, rows, i, total_parts, visible_ranks)
            print(f"{tier_label} part {i}: {text}")

            audio_path = os.path.join(OUT_DIR, f"_voice_{cap_tier}_{period_label}_part{i:02d}.mp3")
            synthesize_voice(text, voice_id, elevenlabs_key, audio_path)
            duration = get_audio_duration(audio_path)

            out_path = os.path.join(OUT_DIR, f"{cap_tier}_{period_label}_part{i:02d}_of_{total_parts}_final.mp4")
            build_part_video(rows, tier_label, period_label, visible_ranks, i, total_parts,
                              audio_path, duration, out_path)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--voice-id", required=True)
    args = p.parse_args()
    run(args.voice_id)