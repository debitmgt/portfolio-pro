// app/api/cron/refresh-monthly-rankings/route.ts
//
// Scheduled job (see vercel.json "crons"). Scores a fixed, curated universe of
// liquid US stocks by trailing 1-year total return and upserts the result
// into public.monthly_rankings — the same row for every subscriber,
// regardless of who holds what or who's on which list.
//
// This is deliberately NOT the same table/job as refresh-ticker-metrics:
//   - refresh-ticker-metrics scores only symbols someone in the app holds,
//     runs daily, and feeds the in-app Fundamentals tab.
//   - refresh-monthly-rankings scores a fixed broad-market universe, runs
//     monthly, and feeds the newsletter (free = unfiltered Top 25 per cap
//     tier, Pro = filtered to the subscriber's own watchlist_items). It
//     never reads any user's holdings, cost basis, or watchlist — universe
//     in, ranked universe out.
//
// UNIVERSE (v1): a hardcoded list of ~100 liquid US names spanning sectors
// AND market-cap sizes, used as a practical stand-in for a real index until
// a maintained index-constituents source is wired up. Swap CURATED_UNIVERSE
// for a real index feed when that's available — nothing else in this file
// needs to change.
//
// CAP TIER: each symbol's large/mid/small bucket is classified dynamically
// from Finnhub's live `marketCapitalization` (profile2), NOT a static
// per-symbol label. A company that grows or shrinks between tiers over time
// is picked up automatically on the next run — no code change needed, and
// no risk of a stale hardcoded classification quietly going wrong.
//
// Metric: Finnhub's `metric.all` payload already includes a trailing 1-year
// price-return figure (`52WeekPriceReturnDaily`) — using that instead of
// pulling separate historical candles keeps this to one extra call per
// symbol (reuses the same profile2 + metric=all pattern as
// refresh-ticker-metrics) and avoids Finnhub's premium-gated candle endpoint.
//
// ALSO computes a second, independent ranking from the exact same fetched
// data (no extra API calls): a combined, non-tiered Top 50 in
// public.weighted_return_rankings, ranked by a recency-weighted blend of the
// 13/26/52-week trailing returns Finnhub already returns for free. See the
// WEIGHTED_* constants below for why this isn't literal Barchart "Weighted
// Alpha" (that needs paid-tier daily candle data).
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const METHODOLOGY_VERSION = 'v2-tiered'
const TOP_N = 25

// ── Top 50 "recency-weighted return" (see below) ────────────────────────────
const WEIGHTED_METHODOLOGY_VERSION = 'v1-recency-weighted'
const WEIGHTED_TOP_N = 50
// Recency weighting for the combined (non-tiered) Top 50, in the same spirit
// as Barchart's "Weighted Alpha" (recent price activity counted more heavily
// than older activity) — but NOT the same calculation. True Weighted Alpha
// needs daily price history (Finnhub's /stock/candle), which returned empty
// against this project's free-tier key when tested directly, consistent with
// that endpoint being paid-tier-gated for US equities. This uses only the
// trailing-return fields Finnhub already returns for free in the same
// metric=all call below (13/26/52-week trailing price return), blended with
// more weight on the most recent quarter. Weights are disclosed in the UI —
// see components/NewsletterIssueView.tsx and lib/email/newsletter-templates.ts.
const WEIGHT_13W = 0.5
const WEIGHT_26W = 0.3
const WEIGHT_52W = 0.2

// Live market-cap thresholds (Finnhub reports marketCapitalization in
// millions USD) used to bucket each symbol into large/mid/small for this
// run. Deliberately simple, round numbers — not trying to mirror any
// specific index provider's exact methodology, just a reasonable, defensible
// three-way split.
const LARGE_CAP_MIN_M = 10_000  // >= $10B
const MID_CAP_MIN_M = 2_000     // $2B–$10B is "mid"; below $2B is "small"

// Finnhub free-tier rate limit is ~60 calls/minute. Each symbol costs 2 calls
// (profile2 + metric=all), so batches of 25 symbols (50 calls) with a pause
// between batches stays comfortably under that even with some jitter.
// At ~100 symbols this runs 4 batches (3 pauses) — comfortably inside the
// 300s maxDuration above with real margin to spare. If the universe grows
// meaningfully beyond this (each extra batch of ~25 costs ~70s), re-check
// that math — or move to Vercel Fluid Compute for a higher ceiling — before
// just appending more symbols.
const BATCH_SIZE = 25
const BATCH_PAUSE_MS = 65_000

// Deliberately NOT split into separate large/mid/small arrays — tier is
// computed live from market cap (see above), so this is just a broad,
// sector-spanning candidate pool skewed to include real mid- and small-cap
// names alongside the mega-caps, not a claim about any symbol's current tier.
const CURATED_UNIVERSE = [
  // Technology — large
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'AVGO', 'ORCL', 'CRM',
  // Healthcare — large
  'UNH', 'JNJ', 'LLY', 'ABBV', 'MRK', 'PFE', 'TMO', 'ABT',
  // Financials — large
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'V', 'MA', 'BLK',
  // Consumer — large
  'WMT', 'PG', 'KO', 'PEP', 'COST', 'MCD', 'HD', 'NFLX',
  // Industrials — large
  'CAT', 'HON', 'UPS', 'RTX', 'BA', 'DE',
  // Energy — large
  'XOM', 'CVX', 'COP', 'SLB', 'EOG',
  // Communications — large
  'T', 'VZ', 'TMUS',

  // Technology — mid
  'DOCU', 'TWLO', 'HUBS', 'BOX', 'PCOR', 'ESTC', 'FROG', 'PATH', 'BILL',
  'PAYC', 'MDB', 'DDOG',
  // Consumer — mid
  'DECK', 'ULTA', 'FIVE', 'YETI', 'RH', 'WSM', 'CHWY', 'ETSY', 'W', 'TXRH',
  // Healthcare — mid
  'PODD', 'TDOC', 'EXAS', 'NBIX', 'HALO', 'RARE', 'SRPT', 'ALNY', 'BMRN', 'JAZZ',

  // Biotech — small
  'JANX', 'ARWR', 'FOLD', 'KRYS', 'VERV', 'BEAM', 'NTLA',
  // Technology — small
  'YEXT', 'PRGS', 'SPSC', 'QLYS', 'VRNT',
  // Consumer — small
  'BOOT', 'SFIX', 'OLLI', 'PLAY', 'CAKE',
  // Industrials — small
  'TXT', 'CR', 'ITT',
]

type CapTier = 'large' | 'mid' | 'small'

function classifyTier(marketCapM: number | null): CapTier | null {
  if (marketCapM == null) return null
  if (marketCapM >= LARGE_CAP_MIN_M) return 'large'
  if (marketCapM >= MID_CAP_MIN_M) return 'mid'
  return 'small'
}

interface RawReturn {
  symbol: string
  name: string | null
  marketCapM: number | null
  priceCurrent: number | null
  trailingReturn1y: number | null
  trailingReturn13w: number | null
  trailingReturn26w: number | null
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchRawReturn(symbol: string, key: string): Promise<RawReturn> {
  try {
    const [profileRes, metricRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${key}`),
      fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${key}`),
    ])
    const profile = profileRes.ok ? await profileRes.json() : {}
    const metricData = metricRes.ok ? await metricRes.json() : {}
    const metric = metricData.metric ?? {}

    return {
      symbol,
      name: profile.name ?? null,
      marketCapM: typeof profile.marketCapitalization === 'number' ? profile.marketCapitalization : null,
      // Current/historical price isn't fetched separately in v1 — Finnhub's
      // metric=all payload gives the trailing return directly, which is all
      // ranking needs. price_current stays null until a display use needs it.
      priceCurrent: null,
      trailingReturn1y: metric['52WeekPriceReturnDaily'] ?? null,
      trailingReturn13w: metric['13WeekPriceReturnDaily'] ?? null,
      trailingReturn26w: metric['26WeekPriceReturnDaily'] ?? null,
    }
  } catch {
    return {
      symbol, name: null, marketCapM: null, priceCurrent: null,
      trailingReturn1y: null, trailingReturn13w: null, trailingReturn26w: null,
    }
  }
}

export async function GET(req: NextRequest) {
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically when
  // CRON_SECRET is set as a project env var. Reject anything else so this
  // can't be triggered by an outside request.
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const key = process.env.FINNHUB_API_KEY!
  const admin = createAdminClient()

  const raw: RawReturn[] = []
  for (let i = 0; i < CURATED_UNIVERSE.length; i += BATCH_SIZE) {
    const batch = CURATED_UNIVERSE.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(batch.map(s => fetchRawReturn(s, key)))
    raw.push(...results)
    if (i + BATCH_SIZE < CURATED_UNIVERSE.length) {
      await sleep(BATCH_PAUSE_MS)
    }
  }

  // Classify tier from live market cap, then rank within each tier by
  // trailing 1y return, descending. Symbols missing either market cap or
  // return data are excluded from ranking entirely (no tier, no rank gap).
  const withTier = raw.map(r => ({ ...r, tier: classifyTier(r.marketCapM) }))
  const scorable = withTier.filter(r => r.tier != null && r.trailingReturn1y != null)

  const periodLabel = new Date().toISOString().slice(0, 7) // 'YYYY-MM'
  const now = new Date().toISOString()

  const tiers: CapTier[] = ['large', 'mid', 'small']
  const rows: {
    period_label: string
    symbol: string
    company_name: string | null
    cap_tier: CapTier
    rank: number
    trailing_return_1y: number | null
    price_current: number | null
    price_1y_ago: number | null
    methodology_version: string
    computed_at: string
    created_at: string
  }[] = []
  const top25ByTier: Record<CapTier, string[]> = { large: [], mid: [], small: [] }

  for (const tier of tiers) {
    const inTier = scorable
      .filter(r => r.tier === tier)
      .sort((a, b) => (b.trailingReturn1y! - a.trailingReturn1y!))

    inTier.forEach((r, idx) => {
      rows.push({
        period_label: periodLabel,
        symbol: r.symbol,
        company_name: r.name,
        cap_tier: tier,
        rank: idx + 1,
        trailing_return_1y: r.trailingReturn1y,
        price_current: r.priceCurrent,
        price_1y_ago: null, // not fetched in v1 — return % comes directly from Finnhub's metric
        methodology_version: METHODOLOGY_VERSION,
        computed_at: now,
        created_at: now,
      })
    })
    top25ByTier[tier] = inTier.slice(0, TOP_N).map(r => r.symbol)
  }

  const { error: upsertError } = await admin
    .from('monthly_rankings')
    .upsert(rows, { onConflict: 'period_label,symbol' })
  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  // ── Combined Top 50, recency-weighted return ──────────────────────────────
  // Independent of cap tier — every symbol in the universe with all three
  // trailing-return windows present is eligible, ranked by the blended score.
  const weightedScorable = raw.filter(r =>
    r.trailingReturn13w != null && r.trailingReturn26w != null && r.trailingReturn1y != null
  )

  const weightedRows: {
    period_label: string
    symbol: string
    company_name: string | null
    rank: number
    weighted_score: number
    return_13w: number | null
    return_26w: number | null
    return_52w: number | null
    price_current: number | null
    methodology_version: string
    computed_at: string
    created_at: string
  }[] = []

  const rankedWeighted = weightedScorable
    .map(r => ({
      ...r,
      weightedScore:
        WEIGHT_13W * r.trailingReturn13w! +
        WEIGHT_26W * r.trailingReturn26w! +
        WEIGHT_52W * r.trailingReturn1y!,
    }))
    .sort((a, b) => b.weightedScore - a.weightedScore)
    .slice(0, WEIGHTED_TOP_N)

  rankedWeighted.forEach((r, idx) => {
    weightedRows.push({
      period_label: periodLabel,
      symbol: r.symbol,
      company_name: r.name,
      rank: idx + 1,
      weighted_score: r.weightedScore,
      return_13w: r.trailingReturn13w,
      return_26w: r.trailingReturn26w,
      return_52w: r.trailingReturn1y,
      price_current: r.priceCurrent,
      methodology_version: WEIGHTED_METHODOLOGY_VERSION,
      computed_at: now,
      created_at: now,
    })
  })

  const { error: weightedUpsertError } = await admin
    .from('weighted_return_rankings')
    .upsert(weightedRows, { onConflict: 'period_label,symbol' })
  if (weightedUpsertError) {
    return NextResponse.json({ error: weightedUpsertError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    period: periodLabel,
    scored: rows.length,
    unscored: raw.length - scorable.length,
    top25ByTier,
    top50Weighted: rankedWeighted.map(r => r.symbol),
  })
}
