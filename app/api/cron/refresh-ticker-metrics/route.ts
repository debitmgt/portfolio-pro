// app/api/cron/refresh-ticker-metrics/route.ts
//
// Scheduled job (see vercel.json "crons"). Computes a generic, per-ticker
// composite score from public Finnhub data and upserts it into
// public.ticker_metrics — the same row for every user who holds that symbol.
//
// This route intentionally never reads an individual user's shares, cost
// basis, or trail %. Its only input from our own database is the *distinct
// set of symbols* someone holds (so we don't waste Finnhub calls scoring
// tickers nobody has); the score itself is computed the same way for a symbol
// regardless of who holds it or how much. That "compute once, filter per
// user" shape is deliberate — see Ownfolio_Publishers_Exclusion_Attorney_Memo.docx.
//
// Methodology (v1) — four independent sub-scores, each 0-100, stored and
// shown individually (not blended into a single number):
//   - valuation_score:  percentile rank of P/E among this batch of tickers (lower P/E → higher score)
//   - growth_score:     percentile rank of trailing revenue growth (higher growth → higher score)
//   - margin_score:     100 if TTM margin is expanding vs. its 5Y average, 0 if contracting, 50 if flat/unknown
//   - stability_score:  percentile rank of beta (lower beta → higher score)
// All four sub-scores and the raw inputs are stored as-is.
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendFailureAlert } from '@/lib/email/alerts'
import type { NextRequest } from 'next/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const METHODOLOGY_VERSION = 'v1'
const MAX_SYMBOLS_PER_RUN = 60 // Finnhub free-tier rate-limit friendly

interface RawMetrics {
  symbol: string
  marketCap: number | null
  peRatio: number | null
  revenueGrowthYoy: number | null
  beta: number | null
  marginTrend: 'expanding' | 'flat' | 'contracting' | null
}

function percentileRank(values: (number | null)[], value: number | null): number | null {
  if (value == null) return null
  const clean = values.filter((v): v is number => v != null)
  if (clean.length < 2) return 50 // not enough peers this run — neutral default
  const below = clean.filter(v => v < value).length
  return Math.round((below / (clean.length - 1)) * 100)
}

async function fetchRawMetrics(symbol: string, key: string): Promise<RawMetrics> {
  try {
    const [profileRes, metricRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${key}`),
      fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${key}`),
    ])
    const profile = profileRes.ok ? await profileRes.json() : {}
    const metricData = metricRes.ok ? await metricRes.json() : {}
    const metric = metricData.metric ?? {}

    const ttmMargin = metric.netProfitMarginTTM ?? null
    const fiveYMargin = metric.netProfitMargin5Y ?? null
    let marginTrend: RawMetrics['marginTrend'] = null
    if (ttmMargin != null && fiveYMargin != null) {
      const delta = ttmMargin - fiveYMargin
      marginTrend = delta > 1 ? 'expanding' : delta < -1 ? 'contracting' : 'flat'
    }

    return {
      symbol,
      marketCap: profile.marketCapitalization ?? null,
      peRatio: metric.peBasicExclExtraTTM ?? metric.peExclExtraTTM ?? null,
      revenueGrowthYoy: metric.revenueGrowthTTMYoy ?? metric.revenueGrowthQuarterlyYoy ?? null,
      beta: metric.beta ?? null,
      marginTrend,
    }
  } catch {
    return { symbol, marketCap: null, peRatio: null, revenueGrowthYoy: null, beta: null, marginTrend: null }
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

  try {
    // Only the *set of symbols* comes from user data — never any per-user figure.
    const { data: holdingsRows, error: holdingsError } = await admin
      .from('holdings')
      .select('symbol')
    if (holdingsError) {
      await sendFailureAlert('refresh-ticker-metrics', `holdings query failed: ${holdingsError.message}`)
      return NextResponse.json({ error: holdingsError.message }, { status: 500 })
    }

    const symbols = [...new Set((holdingsRows ?? []).map(h => h.symbol))].slice(0, MAX_SYMBOLS_PER_RUN)
    if (!symbols.length) {
      return NextResponse.json({ ok: true, scored: 0, note: 'No held symbols to score.' })
    }

    const raw = await Promise.all(symbols.map(s => fetchRawMetrics(s, key)))

    const peValues = raw.map(r => r.peRatio)
    const growthValues = raw.map(r => r.revenueGrowthYoy)
    const betaValues = raw.map(r => r.beta)

    const now = new Date().toISOString()
    const rows = raw.map(r => {
      // Lower P/E and lower beta are scored as "higher" (cheaper / more stable) —
      // this directional choice is a disclosed, fixed part of the v1 methodology,
      // not a per-user or per-request judgment call.
      const peRank = percentileRank(peValues, r.peRatio)
      const valuationScore = peRank != null ? 100 - peRank : 50
      const growthScore = percentileRank(growthValues, r.revenueGrowthYoy) ?? 50
      const betaRank = percentileRank(betaValues, r.beta)
      const stabilityScore = betaRank != null ? 100 - betaRank : 50
      const marginScore = r.marginTrend === 'expanding' ? 100 : r.marginTrend === 'contracting' ? 0 : 50

      return {
        symbol: r.symbol,
        market_cap: r.marketCap,
        pe_ratio: r.peRatio,
        pe_percentile: peRank,
        revenue_growth_yoy: r.revenueGrowthYoy,
        growth_percentile: percentileRank(growthValues, r.revenueGrowthYoy),
        beta: r.beta,
        stability_percentile: betaRank,
        margin_trend: r.marginTrend,
        valuation_score: valuationScore,
        growth_score: growthScore,
        margin_score: marginScore,
        stability_score: stabilityScore,
        methodology_version: METHODOLOGY_VERSION,
        computed_at: now,
        updated_at: now,
      }
    })

    const { error: upsertError } = await admin.from('ticker_metrics').upsert(rows, { onConflict: 'symbol' })
    if (upsertError) {
      await sendFailureAlert('refresh-ticker-metrics', `upsert failed: ${upsertError.message}`)
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, scored: rows.length, symbols: rows.map(r => r.symbol) })
  } catch (err) {
    const detail = err instanceof Error ? (err.stack ?? err.message) : String(err)
    await sendFailureAlert('refresh-ticker-metrics', detail)
    return NextResponse.json({ error: 'Unexpected error — alert sent.' }, { status: 500 })
  }
}
