// app/api/cron/refresh-weekly-movers/route.ts
//
// Weekly companion to refresh-monthly-rankings. That job re-ranks the full
// Top 25 by trailing 1-year return once a month; this job just re-checks
// current price for the same curated universe every week and reports the
// biggest movers since last week — top 3 gainers and top 3 losers per cap
// tier (large/mid/small), 18 symbols total.
//
// Deliberately lighter than the monthly job: only Finnhub's /quote endpoint
// is called (current price only), not /stock/profile2 or /stock/metric, so
// there's no need to re-derive market cap or re-run the delisting check here
// — cap tier is read from the most recent monthly_rankings row for that
// symbol instead of re-classified from scratch.
//
// Baseline handling: weekly_price_snapshots holds one row per symbol per
// week_label, written every run, so next week's run always has a "last
// week" price to diff against. The very first run (no prior snapshot at
// all) seeds its baseline from monthly_rankings.price_current for the most
// recent period_label instead of skipping the %-change calculation.
// NOTE FOR DWIGHT'S BUILD: lib/supabase/types.ts needs two new interfaces
// (WeeklyMover, WeeklyPriceSnapshot) plus matching Database.public.Tables
// entries, following the exact same pattern as weighted_return_rankings.
// See the accompanying types.ts patch delivered alongside this file.
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendFailureAlert } from '@/lib/email/alerts'
import type { NextRequest } from 'next/server'

export const maxDuration = 700 // 7 batches x 65s pause + fetch time, same safety margin as the monthly job's 800s budget
export const dynamic = 'force-dynamic'

const METHODOLOGY_VERSION = 'v1-weekly-pctchange'
const TOP_N_PER_DIRECTION = 3

// Same curated universe as refresh-monthly-rankings/route.ts. Kept as a
// literal copy rather than a shared import so the weekly job's Finnhub load
// can't silently grow if the monthly universe grows without a matching
// review here — but if you edit one list, edit both.
const CURATED_UNIVERSE = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'AVGO', 'ORCL', 'CRM',
  'UNH', 'JNJ', 'LLY', 'ABBV', 'MRK', 'PFE', 'TMO', 'ABT',
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'V', 'MA', 'BLK',
  'WMT', 'PG', 'KO', 'PEP', 'COST', 'MCD', 'HD', 'NFLX',
  'CAT', 'HON', 'UPS', 'RTX', 'BA', 'DE',
  'XOM', 'CVX', 'COP', 'SLB', 'EOG',
  'T', 'VZ', 'TMUS',

  'DOCU', 'TWLO', 'HUBS', 'BOX', 'PCOR', 'ESTC', 'FROG', 'PATH', 'BILL',
  'PAYC', 'MDB', 'DDOG', 'GTLB', 'FRSH', 'APPF', 'BLKB', 'PCTY',
  'GWRE', 'SPT', 'DBX', 'NCNO', 'DV',
  'DECK', 'ULTA', 'FIVE', 'YETI', 'RH', 'WSM', 'CHWY', 'ETSY', 'W', 'TXRH',
  'CROX', 'LEVI', 'BURL', 'CAKE', 'WING', 'SHAK', 'DPZ', 'BJRI',

  'PODD', 'TDOC', 'NBIX', 'HALO', 'RARE', 'SRPT', 'ALNY', 'BMRN', 'JAZZ',
  'INSP', 'PEN', 'TNDM', 'GMED', 'NEOG', 'OMCL',
  'SEIC', 'EVR', 'PJT', 'JEF', 'RJF', 'CBOE',
  'AAON', 'WMS', 'ROAD', 'MLI', 'RRX',

  'JANX', 'ARWR', 'KRYS', 'BEAM', 'NTLA', 'EDIT', 'CRSP',
  'RXRX', 'RCUS', 'DNLI', 'MIRM', 'PCVX', 'ACAD',
  'YEXT', 'PRGS', 'SPSC', 'QLYS', 'BAND', 'ASAN',
  'AMPL', 'DOMO',

  'BOOT', 'SFIX', 'OLLI', 'PLAY', 'CATO',

  'TXT', 'CR', 'ITT', 'ATKR', 'CIR',
  'CRK', 'SM', 'MTDR',

  'EGHT', 'NABL', 'DGII', 'MITK', 'CCSI', 'OSPN', 'KLTR', 'EVCM', 'APPN',
  'IRWD', 'ARQT', 'CDNA', 'NRIX', 'KURA', 'IOVA', 'ORIC', 'SRRK', 'ARDX', 'ANAB',
  'ZUMZ', 'PTLO', 'JACK', 'HZO', 'LOVE',
  'MYE',
]

type CapTier = 'large' | 'mid' | 'small'

const BATCH_SIZE = 25
const BATCH_PAUSE_MS = 65_000 // matched to the monthly job's pause so the two crons
// never combine to exceed Finnhub's free-tier 60-calls/minute ceiling, even if a
// run ever overlaps with live /api/finnhub traffic or another cron

// If fewer than this many symbols return a usable quote, treat the run as a
// partial-fetch failure rather than publishing a mover list built on noise.
const MIN_QUOTES_FLOOR = 100

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function weekLabel_(d: Date): string {
  // Plain "week N of 52" reference point, anchored to the calendar year
  // (not ISO week-numbering) — e.g. "2026-W37-of-52" for the week
  // containing day-of-year 253. Simple day-of-year / 7 bucketing, which
  // matches how Dwight described it ("week 23 of 52") rather than the
  // ISO 8601 Thursday-anchored rule.
  const year = d.getUTCFullYear()
  const startOfYear = Date.UTC(year, 0, 1)
  const dayOfYear = Math.floor((Date.UTC(year, d.getUTCMonth(), d.getUTCDate()) - startOfYear) / 86400000) + 1
  const week = Math.min(52, Math.ceil(dayOfYear / 7))
  return `${year}-W${String(week).padStart(2, '0')}-of-52`
}

async function fetchQuote(symbol: string, key: string, maxRetries = 3): Promise<number | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const price = typeof data.c === 'number' ? data.c : null
      // Finnhub returns c:0 for an unrecognized/delisted symbol rather than an error.
      return price && price > 0 ? price : null
    } catch (err) {
      const isLastAttempt = attempt === maxRetries - 1
      if (!isLastAttempt) {
        await sleep(1000 * (attempt + 1))
        continue
      }
      console.error(`[fetchQuote] ${symbol} failed after ${maxRetries} attempts`)
      return null
    }
  }
  return null
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const key = process.env.FINNHUB_API_KEY!
  const admin = createAdminClient()

  try {
    const now = new Date()
    const weekLabel = weekLabel_(now)
    const nowIso = now.toISOString()

    // ── 1. Current price for every tracked symbol ──────────────────────
    const quotes: { symbol: string; price: number | null }[] = []
    for (let i = 0; i < CURATED_UNIVERSE.length; i += BATCH_SIZE) {
      const batch = CURATED_UNIVERSE.slice(i, i + BATCH_SIZE)
      const results = await Promise.all(batch.map(async symbol => ({
        symbol,
        price: await fetchQuote(symbol, key),
      })))
      quotes.push(...results)
      if (i + BATCH_SIZE < CURATED_UNIVERSE.length) {
        await sleep(BATCH_PAUSE_MS)
      }
    }

    const usableQuotes = quotes.filter(q => q.price != null)
    if (usableQuotes.length < MIN_QUOTES_FLOOR) {
      const msg = `weekly_movers: only ${usableQuotes.length} usable quotes (< ${MIN_QUOTES_FLOOR} floor); likely partial fetch failure`
      console.error(`[sanity check] ${msg}`)
      await sendFailureAlert('refresh-weekly-movers', msg)
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    // ── 2. Prior-week baseline ──────────────────────────────────────────
    // Look for last week's snapshot first (any week_label strictly before
    // this one — in case a run was missed, this still diffs against the
    // most recent snapshot rather than nothing).
    const { data: priorSnapshots, error: priorError } = await admin
      .from('weekly_price_snapshots')
      .select('week_label, symbol, price')
      .lt('week_label', weekLabel)
      .order('week_label', { ascending: false })
      .limit(CURATED_UNIVERSE.length * 4) // a few weeks' worth, de-duped below

    if (priorError) {
      await sendFailureAlert('refresh-weekly-movers', `weekly_price_snapshots read failed: ${priorError.message}`)
      return NextResponse.json({ error: priorError.message }, { status: 500 })
    }

    const priorPriceBySymbol = new Map<string, number>()
    // priorSnapshots is ordered newest-week-first; first occurrence per
    // symbol is its most recent prior price.
    for (const row of priorSnapshots ?? []) {
      if (!priorPriceBySymbol.has(row.symbol)) {
        priorPriceBySymbol.set(row.symbol, Number(row.price))
      }
    }

    // No fallback seeding from monthly_rankings.price_current: that column
    // is never actually populated by refresh-monthly-rankings (it only
    // calls Finnhub's profile2/metric endpoints, never /quote), so it's not
    // a usable baseline. On a genuine first run (no prior weekly_price_snapshots
    // at all yet) there's nothing real to diff against -- skip publishing a
    // mover list this week rather than fabricate a flat 0%-change one, and
    // let next week's run use the snapshot written below as its baseline.
    const isFirstRun = priorPriceBySymbol.size === 0

    // ── 3. Cap tier per symbol, from the latest monthly_rankings entry ──
    const { data: tierRows, error: tierError } = await admin
      .from('monthly_rankings')
      .select('symbol, cap_tier, company_name, period_label')
      .in('symbol', CURATED_UNIVERSE)
      .order('period_label', { ascending: false })

    if (tierError) {
      await sendFailureAlert('refresh-weekly-movers', `monthly_rankings tier lookup failed: ${tierError.message}`)
      return NextResponse.json({ error: tierError.message }, { status: 500 })
    }

    const tierBySymbol = new Map<string, { tier: CapTier; name: string | null }>()
    for (const row of tierRows ?? []) {
      if (!tierBySymbol.has(row.symbol) && row.cap_tier) {
        tierBySymbol.set(row.symbol, { tier: row.cap_tier as CapTier, name: row.company_name })
      }
    }

    // ── 4. Write this week's raw snapshot (every usable quote, full universe) ──
    const snapshotRows = usableQuotes.map(q => ({
      week_label: weekLabel,
      symbol: q.symbol,
      price: q.price as number,
      computed_at: nowIso,
    }))

    const { error: snapshotDeleteError } = await admin
      .from('weekly_price_snapshots')
      .delete()
      .eq('week_label', weekLabel)
    if (snapshotDeleteError) {
      await sendFailureAlert('refresh-weekly-movers', `weekly_price_snapshots delete failed: ${snapshotDeleteError.message}`)
      return NextResponse.json({ error: snapshotDeleteError.message }, { status: 500 })
    }

    const { error: snapshotUpsertError } = await admin
      .from('weekly_price_snapshots')
      .upsert(snapshotRows, { onConflict: 'week_label,symbol' })
    if (snapshotUpsertError) {
      await sendFailureAlert('refresh-weekly-movers', `weekly_price_snapshots upsert failed: ${snapshotUpsertError.message}`)
      return NextResponse.json({ error: snapshotUpsertError.message }, { status: 500 })
    }

    if (isFirstRun) {
      return NextResponse.json({
        ok: true,
        week: weekLabel,
        quotesFetched: usableQuotes.length,
        firstRun: true,
        note: 'No prior week to compare against yet -- snapshot written, movers start next week.',
      })
    }

    // ── 5. Compute % change vs. baseline, per symbol with a known tier ──
    type Scored = {
      symbol: string
      companyName: string | null
      tier: CapTier
      priceCurrent: number
      pricePrior: number
      pctChange: number
    }

    const scored: Scored[] = []
    for (const q of usableQuotes) {
      const tierInfo = tierBySymbol.get(q.symbol)
      const prior = priorPriceBySymbol.get(q.symbol)
      if (!tierInfo || prior == null || prior === 0 || q.price == null) continue
      const pctChange = ((q.price - prior) / prior) * 100
      scored.push({
        symbol: q.symbol,
        companyName: tierInfo.name,
        tier: tierInfo.tier,
        priceCurrent: q.price,
        pricePrior: prior,
        pctChange,
      })
    }

    // ── 6. Top 3 gainers + top 3 losers per tier ────────────────────────
    const tiers: CapTier[] = ['large', 'mid', 'small']
    const moverRows: {
      week_label: string
      symbol: string
      company_name: string | null
      cap_tier: CapTier
      price_current: number
      price_prior: number
      pct_change: number
      direction: 'gainer' | 'loser'
      rank_in_tier: number
      methodology_version: string
      computed_at: string
      created_at: string
    }[] = []

    const summary: Record<CapTier, { gainers: string[]; losers: string[] }> = {
      large: { gainers: [], losers: [] },
      mid: { gainers: [], losers: [] },
      small: { gainers: [], losers: [] },
    }

    for (const tier of tiers) {
      const inTier = scored.filter(s => s.tier === tier).sort((a, b) => b.pctChange - a.pctChange)
      const gainers = inTier.slice(0, TOP_N_PER_DIRECTION)
      const losers = inTier.slice(-TOP_N_PER_DIRECTION).reverse().filter(l => !gainers.includes(l))

      gainers.forEach((r, idx) => {
        moverRows.push({
          week_label: weekLabel,
          symbol: r.symbol,
          company_name: r.companyName,
          cap_tier: tier,
          price_current: r.priceCurrent,
          price_prior: r.pricePrior,
          pct_change: r.pctChange,
          direction: 'gainer',
          rank_in_tier: idx + 1,
          methodology_version: METHODOLOGY_VERSION,
          computed_at: nowIso,
          created_at: nowIso,
        })
      })
      losers.forEach((r, idx) => {
        moverRows.push({
          week_label: weekLabel,
          symbol: r.symbol,
          company_name: r.companyName,
          cap_tier: tier,
          price_current: r.priceCurrent,
          price_prior: r.pricePrior,
          pct_change: r.pctChange,
          direction: 'loser',
          rank_in_tier: idx + 1,
          methodology_version: METHODOLOGY_VERSION,
          computed_at: nowIso,
          created_at: nowIso,
        })
      })

      summary[tier] = {
        gainers: gainers.map(g => g.symbol),
        losers: losers.map(l => l.symbol),
      }
    }

    if (moverRows.length === 0) {
      const msg = `weekly_movers: no scorable symbols (missing tier or baseline for all ${usableQuotes.length} quotes)`
      console.error(`[sanity check] ${msg}`)
      await sendFailureAlert('refresh-weekly-movers', msg)
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const { error: moversDeleteError } = await admin
      .from('weekly_movers')
      .delete()
      .eq('week_label', weekLabel)
    if (moversDeleteError) {
      await sendFailureAlert('refresh-weekly-movers', `weekly_movers delete failed: ${moversDeleteError.message}`)
      return NextResponse.json({ error: moversDeleteError.message }, { status: 500 })
    }

    const { error: moversUpsertError } = await admin
      .from('weekly_movers')
      .upsert(moverRows, { onConflict: 'week_label,symbol' })
    if (moversUpsertError) {
      await sendFailureAlert('refresh-weekly-movers', `weekly_movers upsert failed: ${moversUpsertError.message}`)
      return NextResponse.json({ error: moversUpsertError.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      week: weekLabel,
      quotesFetched: usableQuotes.length,
      scored: scored.length,
      movers: summary,
    })
  } catch (err) {
    const detail = err instanceof Error ? (err.stack ?? err.message) : String(err)
    await sendFailureAlert('refresh-weekly-movers', detail)
    return NextResponse.json({ error: 'Unexpected error -- alert sent.' }, { status: 500 })
  }
}
