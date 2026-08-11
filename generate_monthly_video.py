#!/usr/bin/env python3
import argparse
import json
import subprocess
import shutil
import os
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

_BOLD_CANDIDATES = [
    FONT_DIR + "DejaVuSans-Bold.ttf",
    WIN_FONT_DIR + "arialbd.ttf",
    WIN_FONT_DIR + "segoeuib.ttf",
]
_REG_CANDIDATES = [
    FONT_DIR + "DejaVuSans.ttf",
    WIN_FONT_DIR + "arial.ttf",
    WIN_FONT_DIR + "segoeui.ttf",
]
_SERIF_BOLD_CANDIDATES = [
    FONT_DIR + "DejaVuSerif-Bold.ttf",
    WIN_FONT_DIR + "georgiab.ttf",
    WIN_FONT_DIR + "timesbd.ttf",
] + _BOLD_CANDIDATES

F_BOLD = _find_font(_BOLD_CANDIDATES, 26)
F_REG = _find_font(_REG_CANDIDATES, 22)
F_HEADER = _find_font(_BOLD_CANDIDATES, 40)
F_SUB = _find_font(_REG_CANDIDATES, 24)
F_RANK = _find_font(_BOLD_CANDIDATES, 24)
F_LOGO_S = _find_font(_BOLD_CANDIDATES, 34)
F_CTA = _find_font(_BOLD_CANDIDATES, 36)
F_LOGO_CARD = _find_font(_SERIF_BOLD_CANDIDATES, 54)

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

def draw_row(d, y, row, blurred=False):
    rank, ticker, name, sector, pe, pb, ret = (
        row["rank"], row["ticker"], row["name"], row.get("sector", ""),
        row.get("pe", 0), row.get("pb", 0), row["ret"],
    )
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

def render_full_table(rows, tier_label, month_label, blur_middle=True):
    total_h = HEADER_H + len(rows) * ROW_H
    img = Image.new("RGB", (W, total_h), WHITE)
    d = ImageDraw.Draw(img)
    draw_header(d, tier_label, month_label, row_count=len(rows))
    for i, row in enumerate(rows):
        y = HEADER_H + i * ROW_H
        draw_row(d, y, row)

    if blur_middle and len(rows) > 2:
        top_y = HEADER_H + ROW_H
        bottom_y = HEADER_H + (len(rows) - 1) * ROW_H
        region = img.crop((0, top_y, W, bottom_y))
        region = region.filter(ImageFilter.GaussianBlur(radius=6))
        img.paste(region, (0, top_y))

    return img

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

def build_video(data_path, tier_label, month_label, out_path,
                 hook_seconds=1.2, scroll_seconds=4, hold_seconds=3, fps=30,
                 end_logo_seconds=0):
    with open(data_path) as f:
        rows = json.load(f)
    rows = sorted(rows, key=lambda r: r["rank"])

    tmpdir = os.path.join(os.getcwd(), "_frames_tmp")
    if os.path.exists(tmpdir):
        shutil.rmtree(tmpdir)
    os.makedirs(tmpdir)

    full_table = render_full_table(rows, tier_label, month_label, blur_middle=True)
    total_h = full_table.height
    scrollable = max(total_h - H, 0)

    frame_idx = 0

    hook_frames = int(fps * hook_seconds)
    top_view = full_table.crop((0, 0, W, H))
    for _ in range(hook_frames):
        top_view.save(f"{tmpdir}/f{frame_idx:05d}.jpg", quality=90)
        frame_idx += 1

    scroll_frames = int(fps * scroll_seconds)
    for i in range(scroll_frames):
        offset = int(scrollable * (i / max(scroll_frames - 1, 1)))
        view = full_table.crop((0, offset, W, offset + H))
        view.save(f"{tmpdir}/f{frame_idx:05d}.jpg", quality=90)
        frame_idx += 1

    bottom_view = full_table.crop((0, total_h - H, W, total_h))
    cta_lines = [
        ("Ranks 2-24 free to view", F_CTA, WHITE),
        ("No card required - link in bio", F_REG, (230, 230, 230)),
    ]
    cta_view = add_cta_frame(bottom_view, cta_lines)
    hold_frame_count = int(fps * hold_seconds)
    for _ in range(hold_frame_count):
        cta_view.save(f"{tmpdir}/f{frame_idx:05d}.jpg", quality=90)
        frame_idx += 1

    if end_logo_seconds > 0:
        logo_card = render_logo_card()
        end_frame_count = int(fps * end_logo_seconds)
        for _ in range(end_frame_count):
            logo_card.save(f"{tmpdir}/f{frame_idx:05d}.jpg", quality=90)
            frame_idx += 1

    subprocess.run([
        "ffmpeg", "-y", "-framerate", str(fps),
        "-i", f"{tmpdir}/f%05d.jpg",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-vf", f"scale={W}:{H}",
        out_path,
    ], check=True, capture_output=True)

    shutil.rmtree(tmpdir)
    print(f"Wrote {out_path} ({frame_idx} frames, {frame_idx/fps:.1f}s)")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--data", required=True)
    p.add_argument("--tier", required=True)
    p.add_argument("--month", required=True)
    p.add_argument("--out", required=True)
    args = p.parse_args()
    build_video(args.data, args.tier, args.month, args.out)
