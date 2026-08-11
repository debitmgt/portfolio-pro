#!/usr/bin/env python3
import argparse
import random

from build_monthly_videos_auto import (
    get_config,
    fetch_latest_period,
    fetch_tier_rows,
    period_label_to_month_name,
    clean_name,
)

TITLES = [
    "Take Charge of Your Investments",
    "See Where Your Sector Actually Stands",
    "The Data Your Broker App Won't Show You",
    "Free Monthly Stock Rankings - No Login Required",
]

DISCLOSURE = (
    "All figures are historical performance only - not tailored to any "
    "individual and not a signal to act now. Not financial advice.\n\n"
    "**Disclosure:** This post is a general, impersonal publication based "
    "solely on historical market data. It is not tailored to your objectives, "
    "financial situation, or portfolio, and does not provide investment "
    "advice, legal advice, tax advice, or a recommendation to buy, sell, or "
    "hold any security. Ownfolio LLC does not act as an investment adviser "
    "or broker and does not evaluate the suitability of any security or "
    "strategy for any person. Past performance is not indicative of future "
    "results; investing involves risk, including possible loss of principal."
)

def format_table(rows):
    lines = ["| Rank | Symbol | 1Y Return |", "|---|---|---|"]
    for r in rows:
        name = clean_name(r["name"])
        sign = "+" if r["ret"] >= 0 else ""
        lines.append(f"| {r['rank']} | {r['ticker']} - {name} | {sign}{r['ret']:.1f}% |")
    return "\n".join(lines)

def build_post(period_label, month_name, large_rows, mid_rows, small_rows):
    title = random.choice(TITLES)

    body = f"""[Back to all issues](https://www.ownfolio.net/newsletter/archive)

## Top 25 - {month_name}

The 25 highest trailing 1-year total returns in each of three cap tiers - large, mid, and small - from Ownfolio LLC's tracked universe. Same lists every subscriber received.

### Large Cap Top {len(large_rows)}

{format_table(large_rows)}

### Mid Cap Top {len(mid_rows)}

{format_table(mid_rows)}

### Small Cap Top {len(small_rows)}

{format_table(small_rows)}

---

{DISCLOSURE}

Get next month's issue in your inbox, free: [Ownfolio.net](https://www.ownfolio.net)
"""
    return title, body

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--period", default=None)
    p.add_argument("--out", default="reddit_post.md")
    args = p.parse_args()

    supabase_url, supabase_key, _ = get_config()
    headers = {"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}"}

    period_label = args.period or fetch_latest_period(supabase_url, headers)
    month_name = period_label_to_month_name(period_label)

    large_rows = fetch_tier_rows(supabase_url, headers, period_label, "large")
    mid_rows = fetch_tier_rows(supabase_url, headers, period_label, "mid")
    small_rows = fetch_tier_rows(supabase_url, headers, period_label, "small")

    title, body = build_post(period_label, month_name, large_rows, mid_rows, small_rows)

    with open(args.out, "w", encoding="utf-8") as f:
        f.write("TITLE: " + title + "\n\n" + "=" * 60 + "\n\n" + body)

    print("Title:", title)
    print("Wrote", args.out)


if __name__ == "__main__":
    main()
