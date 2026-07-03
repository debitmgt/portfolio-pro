// app/api/cron/refresh-monthly-rankings/route.ts
//
// Scheduled job (see vercel.json "crons"). Scores a fixed, curated universe of
// large/liquid US stocks by trailing 1-year total return and upserts the
// result into public.monthly_rankings — the same row for every subscriber,
// regardless of who holds what or who's on which list.
//
// This is deliberately NOT the same table/job as refresh-ticker-metrics:
//   - refresh-ticker-metrics scores only symbols someone in the app holds,
//     runs daily, and feeds the in-app Fundamentals tab.
//   - refresh-monthly-rankings scores a fixed broad-market universe, runs
//     monthly, and feeds the newsletter (free = unfiltered Top 25, Pro =
//     filtered to the subscriber's own watchlist_items). It never reads any
//     user's holdings, cost basis, or watchlist — universe in, ranked
//     universe out.
//
// UNIVERSE (v1): a hardcoded list of ~100 large/liquid US names spanning
// sectors, used as a practical stand-in for a real index until a maintained
// S&P 500 constituents source is wired up. Swap CURATED_UNIVERSE for a real
// index feed when that's available — nothing else in this file needs to change.
//
// Metric: Finnhub's `metric.all` payload already includes a trailing 1-year
// price-return figure (`52WeekPriceReturnDaily`) — using that instead of
// pulling separate historical candles keeps this to one extra call per
// symbol (reuses the same profile2 + metric=all pattern as
// refresh-ticker-metrics) and avoids Finnhub's premium-gated candle endpoint.
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const METHODOLOGY_VERSION = 'v1'
const TOP_N = 25

// Finnhub free-tier rate limit is ~60 calls/minute. Each symbol costs 2 calls
// (profile2 + metric=all), so batches of 25 symbols (50 calls) with a pause
// between batches stays comfortably under that even with some jitter.
const BATCH_SIZE = 25
const BATCH_PAUSE_MS = 65_000

const CURATED_UNIVERSE = [
  // Technology
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'AVGO', 'ORCL', 'ADBE',
  'CRM', 'CSCO', 'ACN', 'IBM', 'INTC', 'AMD', 'QCOM', 'TXN', 'INTU', 'NOW',
  'AMAT', 'MU', 'ADI', 'LRCX', 'PANW',
  // Healthcare
  'UNH', 'JNJ', 'LLY', 'ABBV', 'MRK', 'PFE', 'TMO', 'ABT', 'DHR', 'BMY',
  'AMGN', 'GILD', 'CVS', 'CI', 'ISRG', 'VRTX', 'MDT', 'SYK', 'ELV', 'HCA',
  // Financials
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'SCHW', 'BLK', 'AXP', 'SPGI',
  'CB', 'PGR', 'MMC', 'USB', 'PNC', 'TFC', 'V', 'MA',
  // Consumer
  'WMT', 'PG', 'KO', 'PEP', 'COST', 'MCD', 'NKE', 'SBUX', 'HD', 'LOW',
  'TGT', 'DIS', 'CMCSA', 'NFLX', 'BKNG',
  // Industrials
  'CAT', 'HON', 'UPS', 'RTX', 'BA', 'GE', 'LMT', 'DE', 'UNP', 'MMM',
  // Energy
  'XOM', 'CVX', 'COP', 'SLB', 'EOG',
  // Communications / Other
  'T', 'VZ', 'TMUS',
]

interface RawReturn {
  symbol: string
  name: string | null
  priceCurrent: number | null
  trailingReturn1y: number | null
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
      // Current/historical price isn't fetched separately in v1 — Finnhub's
      // metric=all payload gives the trailing return directly, which is all
      // ranking needs. price_current stays null until a display use needs it.
      priceCurrent: null,
      trailingReturn1y: metric['52WeekPriceReturnDaily'] ?? null,
    }
  } catch {
    return { symbol, name: null, priceCurrent: null, trailingReturn1y: null }
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

  // Rank by trailing 1y return, descending. Symbols with no data sort last
  // and don't get a numeric rank gap — they're simply excluded from ranking.
  const scored = raw.filter(r => r.trailingReturn1y != null)
  scored.sort((a, b) => (b.trailingReturn1y! - a.trailingReturn1y!))

  const periodLabel = new Date().toISOString().slice(0, 7) // 'YYYY-MM'
  const now = new Date().toISOString()

  const rows = scored.map((r, idx) => ({
    period_label: periodLabel,
    symbol: r.symbol,
    company_name: r.name,
    rank: idx + 1,
    trailing_return_1y: r.trailingReturn1y,
    price_current: r.priceCurrent,
    price_1y_ago: null, // not fetched in v1 — return % comes directly from Finnhub's metric
    methodology_version: METHODOLOGY_VERSION,
    computed_at: now,
    created_at: now,
  }))

  const { error: upsertError } = await admin
    .from('monthly_rankings')
    .upsert(rows, { onConflict: 'period_label,symbol' })
  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    period: periodLabel,
    scored: rows.length,
    unscored: raw.length - scored.length,
    top25: rows.slice(0, TOP_N).map(r => r.symbol),
  })
}
