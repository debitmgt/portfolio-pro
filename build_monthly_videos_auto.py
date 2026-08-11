#!/usr/bin/env python3
"""
build_monthly_videos_auto.py

Rebuilt version, the original copy of this script (which fetched Supabase
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
import time
import urllib.request
import urllib.error


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


#, Env loading (reads .env.local directly, this script runs standalone,
# not through Next.js, so it can't rely on process.env being populated),
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


#, Rendering,
# Layout and animation live in render_v2.py so this file stays focused on
# data, narration and assembly. Keep both files in the same folder.
from render_v2 import render_frame, build_episode_list, rescale_to_match_return, fetch_price_history


#, Narration text per part,
def rows_by_rank(rows):
    return {r["rank"]: r for r in rows}

def move_phrase(ret):
    """'up 12 percent' or 'down 12 percent', never 'up -12 percent'."""
    direction = "up" if ret >= 0 else "down"
    return f"{direction} " + (f"{abs(ret):.1f}" if abs(ret) < 10 else f"{abs(ret):.0f}") + " percent"

def narration_for_part(tier_label, month_label, rows, part_num, total_parts, visible_ranks):
    by_rank = rows_by_rank(rows)
    n = len(rows)
    if part_num == 1:
        top, bottom = min(visible_ranks), max(visible_ranks)
        r_top, r_bot = by_rank[top], by_rank[bottom]
        return (
            f"{tier_label} script, part 1 of {total_parts}. "
            f"Number one this month, {r_top['name']}, {move_phrase(r_top['ret'])}. "
            f"That's out of the {tier_label} top {n}, ranked by trailing return. "
            f"And at rank {bottom}, {r_bot['name']}, {move_phrase(r_bot['ret'])}. "
            f"Full list in the newsletter. Browse past issues."
        )
    if len(visible_ranks) == 1:
        rank = next(iter(visible_ranks))
        r = by_rank[rank]
        return (
            f"{tier_label} script, part {part_num} of {total_parts}, the middle of the list. "
            f"Rank {rank}, {r['name']}, {move_phrase(r['ret'])}. "
            f"Full list in the newsletter. Browse past issues."
        )
    a, b = sorted(visible_ranks)
    r_a, r_b = by_rank[a], by_rank[b]
    return (
        f"{tier_label} script, part {part_num} of {total_parts}. "
        f"Rank {a}, {r_a['name']}, {move_phrase(r_a['ret'])}. "
        f"And rank {b}, {r_b['name']}, {move_phrase(r_b['ret'])}. "
        f"Full list in the newsletter. Browse past issues."
    )


#, ElevenLabs voice synthesis,
def synthesize_voice(text, voice_id, api_key, out_path):
    """Calls ElevenLabs' text-to-speech endpoint and writes the mp3 to
    out_path. Standard documented ElevenLabs REST API, not tested against
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


#, Supabase fetch,
def fetch_tier_rows(supabase_url, service_key, cap_tier, period_label):
    url = (
        supabase_url + "/rest/v1/monthly_rankings"
        + "?cap_tier=eq." + cap_tier + "&period_label=eq." + period_label
        + "&select=rank,symbol,company_name,trailing_return_1y,computed_at"
        + "&order=rank.asc&rank=lte.25"
    )
    req = urllib.request.Request(url, method="GET")
    req.add_header("apikey", service_key)
    req.add_header("Authorization", "Bearer " + service_key)
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
            "computed_at": r.get("computed_at"),
        })
    return rows

def build_chart_data_for_part(rows, visible_ranks, twelve_data_key, price_cache):
    if not twelve_data_key:
        return None

    by_rank = rows_by_rank(rows)
    as_of = rows[0]["computed_at"]
    if as_of:
        as_of_date = as_of[:10]
    else:
        as_of_date = datetime.date.today().strftime("%Y-%m-%d")

    stocks = []
    for rank in sorted(visible_ranks):
        r = by_rank[rank]
        ticker = r["ticker"]
        if ticker not in price_cache:
            closes = fetch_price_history(ticker, as_of_date, twelve_data_key)
            price_cache[ticker] = closes
            time.sleep(0.8)
        closes = price_cache[ticker]
        rescaled = rescale_to_match_return(closes, r["ret"]) if closes else None
        stocks.append((rank, ticker, r["name"], r["ret"], rescaled))

    if not any(s[4] for s in stocks):
        return None
    return {"stocks": stocks}

def build_part_video(rows, tier_label, month_label, visible_ranks, part_num, total_parts,
                      narration_audio_path, narration_duration, out_path, fps=30,
                      chart_data=None):
    tmpdir = "_frames_tmp"
    if os.path.exists(tmpdir):
        shutil.rmtree(tmpdir)
    os.makedirs(tmpdir)
    n_frames = max(1, int(round(narration_duration * fps)))
    for i in range(n_frames):
        t = i / max(n_frames - 1, 1)
        frame = render_frame(rows, tier_label, month_label, visible_ranks,
                             part_num, total_parts, t, chart_data=chart_data)
        frame.save(f"{tmpdir}/f{i:05d}.jpg", quality=90)
    silent_path = out_path.replace("_final.mp4", "_silent.mp4")
    subprocess.run([
        "ffmpeg", "-y", "-framerate", str(fps), "-i", f"{tmpdir}/f%05d.jpg",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "21",
        silent_path,
    ], check=True, capture_output=True)
    shutil.rmtree(tmpdir)
    subprocess.run([
        "ffmpeg", "-y", "-i", silent_path, "-i", narration_audio_path,
        "-c:v", "copy", "-c:a", "aac", "-shortest", out_path,
    ], check=True, capture_output=True)
    os.remove(silent_path)
    os.remove(narration_audio_path)
    print("  -> " + out_path)

def run(voice_id=None, only_tier=None, only_part=None):
    env = load_env_local()
    supabase_url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    elevenlabs_key = env.get("ELEVENLABS_API_KEY")
    voice_id = voice_id or env.get("ELEVENLABS_VOICE_ID")
    twelve_data_key = env.get("TWELVE_DATA_API_KEY")
    missing = [name for name, val in [
        ("NEXT_PUBLIC_SUPABASE_URL", supabase_url),
        ("SUPABASE_SERVICE_ROLE_KEY", service_key),
        ("ELEVENLABS_API_KEY", elevenlabs_key),
        ("ELEVENLABS_VOICE_ID or --voice-id", voice_id),
    ] if not val]
    if missing:
        print("Missing required values in .env.local: " + ", ".join(missing))
        sys.exit(1)
    if not twelve_data_key:
        print("Note: TWELVE_DATA_API_KEY not set - videos will render without chart cards.")

    price_cache = {}
    period_label = os.environ.get("PERIOD") or datetime.date.today().strftime("%Y-%m")
    os.makedirs(OUT_DIR, exist_ok=True)
    for cap_tier, tier_label in TIERS:
        if only_tier and cap_tier != only_tier:
            continue
        print("\n=== " + tier_label + " (" + period_label + ") ===")
        rows = fetch_tier_rows(supabase_url, service_key, cap_tier, period_label)
        if not rows:
            print("  No rows found for " + cap_tier + "/" + period_label + ", skipping.")
            continue
        episodes = build_episode_list(rows)
        total_parts = len(episodes)
        for i, pair in enumerate(episodes, start=1):
            if only_part and i != only_part:
                continue
            visible_ranks = set(pair)
            text = narration_for_part(tier_label, period_label, rows, i, total_parts, visible_ranks)
            print(tier_label + " part " + str(i) + ": " + text)
            audio_path = os.path.join(OUT_DIR, "_voice_" + cap_tier + "_" + period_label + "_part" + str(i).zfill(2) + ".mp3")
            if not os.path.exists(audio_path):
                synthesize_voice(text, voice_id, elevenlabs_key, audio_path)
            duration = get_audio_duration(audio_path)
            out_path = os.path.join(OUT_DIR, cap_tier + "_" + period_label + "_part" + str(i).zfill(2) + "_of_" + str(total_parts) + "_final.mp4")
            chart_data = build_chart_data_for_part(rows, visible_ranks, twelve_data_key, price_cache)
            build_part_video(rows, tier_label, period_label, visible_ranks, i, total_parts,
                              audio_path, duration, out_path, chart_data=chart_data)

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--voice-id")
    p.add_argument("--tier", choices=["large", "mid", "small"])
    p.add_argument("--part", type=int)
    args = p.parse_args()
    run(args.voice_id, only_tier=args.tier, only_part=args.part)
