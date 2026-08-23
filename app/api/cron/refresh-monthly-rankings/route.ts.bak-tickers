// app/api/cron/refresh-monthly-rankings/route.ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendFailureAlert } from '@/lib/email/alerts'
import type { NextRequest } from 'next/server'

export const maxDuration = 480
export const dynamic = 'force-dynamic'

const METHODOLOGY_VERSION = 'v2-tiered'
const TOP_N = 25

const WEIGHTED_METHODOLOGY_VERSION = 'v1-recency-weighted'
const WEIGHTED_TOP_N = 50
const WEIGHT_13W = 0.5
const WEIGHT_26W = 0.3
const WEIGHT_52W = 0.2

const LARGE_CAP_MIN_M = 10_000
const MID_CAP_MIN_M = 2_000

const BATCH_SIZE = 25
const BATCH_PAUSE_MS = 65_000

// Sanity check: if we write fewer than this many rows, something went wrong
const MIN_ROWS_SANITY_FLOOR = 60

const CURATED_UNIVERSE = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'AVGO', 'ORCL', 'CRM',
  'UNH', 'JNJ', 'LLY', 'ABBV', 'MRK', 'PFE', 'TMO', 'ABT',
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'V', 'MA', 'BLK',
  'WMT', 'PG', 'KO', 'PEP', 'COST', 'MCD', 'HD', 'NFLX',
  'CAT', 'HON', 'UPS', 'RTX', 'BA', 'DE',
  'XOM', 'CVX', 'COP', 'SLB', 'EOG',
  'T', 'VZ', 'TMUS',

  'DOCU', 'TWLO', 'HUBS', 'BOX', 'PCOR', 'ESTC', 'FROG', 'PATH', 'BILL',
  'PAYC', 'MDB', 'DDOG', 'GTLB', 'CFLT', 'FRSH', 'APPF', 'BLKB', 'PCTY',
  'GWRE', 'SPT', 'DBX', 'SMAR', 'NCNO', 'DV',
  'DECK', 'ULTA', 'FIVE', 'YETI', 'RH', 'WSM', 'CHWY', 'ETSY', 'W', 'TXRH',
  'CROX', 'LEVI', 'BURL', 'CAKE', 'WING', 'SHAK', 'DPZ', 'BJRI',

  'PODD', 'TDOC', 'EXAS', 'NBIX', 'HALO', 'RARE', 'SRPT', 'ALNY', 'BMRN', 'JAZZ',
  'INSP', 'PEN', 'TNDM', 'GMED', 'NEOG', 'OMCL',
  'SEIC', 'EVR', 'PJT', 'JEF', 'RJF', 'CBOE',
  'AAON', 'WMS', 'ROAD', 'MLI', 'RRX',

  'JANX', 'ARWR', 'FOLD', 'KRYS', 'VERV', 'BEAM', 'NTLA', 'EDIT', 'CRSP',
  'RXRX', 'RCUS', 'DNLI', 'MIRM', 'PCVX', 'ACAD',
  'YEXT', 'PRGS', 'SPSC', 'QLYS', 'VRNT', 'BAND', 'ASAN', 'PRO',
  'AMPL', 'DOMO', 'BIGC',

  'BOOT', 'SFIX', 'OLLI', 'PLAY', 'CATO', 'CONN', 'HIBB', 'SCVL',
  'GES', 'CHS',
  'TXT', 'CR', 'ITT', 'ATKR', 'CIR', 'HI', 'ROLL',
  'CRK', 'SM', 'CIVI', 'MTDR',
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
  sector: string | null
  peTTM: number | null
  pbAnnual: number | null
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchRawReturn(symbol: string, key: string, maxRetries = 3): Promise<RawReturn> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
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
        priceCurrent: null,
        trailingReturn1y: metric['52WeekPriceReturnDaily'] ?? null,
        trailingReturn13w: metric['13WeekPriceReturnDaily'] ?? null,
        trailingReturn26w: metric['26WeekPriceReturnDaily'] ?? null,
        sector: profile.finnhubIndustry ?? null,
        peTTM: metric.peBasicExclExtraTTM ?? metric.peExclExtraTTM ?? null,
        pbAnnual: metric.pbAnnual ?? null,
      }
    } catch (err) {
      const isLastAttempt = attempt === maxRetries - 1
      if (!isLastAttempt) {
        const backoffMs = 1000 * (attempt + 1) // 1s, 2s, 3s
        console.warn(`[fetchRawReturn] ${symbol} attempt ${attempt + 1} failed, retrying in ${backoffMs}ms`)
        await sleep(backoffMs)
        continue
      }
      // Last attempt failed; return nulls and continue
      console.error(`[fetchRawReturn] ${symbol} failed after ${maxRetries} attempts`)
      return {
        symbol, name: null, marketCapM: null, priceCurrent: null,
        trailingReturn1y: null, trailingReturn13w: null, trailingReturn26w: null,
        sector: null, peTTM: null, pbAnnual: null,
      }
    }
  }
  // Fallback (should not reach)
  return {
    symbol, name: null, marketCapM: null, priceCurrent: null,
    trailingReturn1y: null, trailingReturn13w: null, trailingReturn26w: null,
    sector: null, peTTM: null, pbAnnual: null,
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization'); console.log('[auth debug]', { receivedLength: auth?.length ?? 0, expectedLength: process.env.CRON_SECRET?.length ?? 0, match: auth === `Bearer ${process.env.CRON_SECRET}` })
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const key = process.env.FINNHUB_API_KEY!
  const admin = createAdminClient()

  try {
  const raw: RawReturn[] = []
  for (let i = 0; i < CURATED_UNIVERSE.length; i += BATCH_SIZE) {
    const batch = CURATED_UNIVERSE.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(batch.map(s => fetchRawReturn(s, key)))
    raw.push(...results)
    if (i + BATCH_SIZE < CURATED_UNIVERSE.length) {
      await sleep(BATCH_PAUSE_MS)
    }
  }

  const withTier = raw.map(r => ({ ...r, tier: classifyTier(r.marketCapM) }))
  const scorable = withTier.filter(r => r.tier != null && r.trailingReturn1y != null)

  const periodLabel = new Date().toISOString().slice(0, 7)
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
    sector: string | null
    pe_ttm: number | null
    pb_ratio: number | null
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
        price_1y_ago: null,
        methodology_version: METHODOLOGY_VERSION,
        computed_at: now,
        created_at: now,
        sector: r.sector,
        pe_ttm: r.peTTM,
        pb_ratio: r.pbAnnual,
      })
    })
    top25ByTier[tier] = inTier.slice(0, TOP_N).map(r => r.symbol)
  }

  // Sanity check: if we collected fewer than the floor, reject the run
  if (rows.length < MIN_ROWS_SANITY_FLOOR) {
    const msg = `monthly_rankings: only ${rows.length} rows scorable (< ${MIN_ROWS_SANITY_FLOOR} floor); likely partial fetch failure`
    console.error(`[sanity check] ${msg}`)
    await sendFailureAlert('refresh-monthly-rankings', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const { error: deleteError } = await admin
    .from('monthly_rankings')
    .delete()
    .eq('period_label', periodLabel)
  if (deleteError) {
    await sendFailureAlert('refresh-monthly-rankings', `monthly_rankings delete failed: ${deleteError.message}`)
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  const { error: upsertError } = await admin
    .from('monthly_rankings')
    .upsert(rows, { onConflict: 'period_label,symbol' })
  if (upsertError) {
    await sendFailureAlert('refresh-monthly-rankings', `monthly_rankings upsert failed: ${upsertError.message}`)
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

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

  const { error: weightedDeleteError } = await admin
    .from('weighted_return_rankings')
    .delete()
    .eq('period_label', periodLabel)
  if (weightedDeleteError) {
    await sendFailureAlert('refresh-monthly-rankings', `weighted_return_rankings delete failed: ${weightedDeleteError.message}`)
    return NextResponse.json({ error: weightedDeleteError.message }, { status: 500 })
  }

  const { error: weightedUpsertError } = await admin
    .from('weighted_return_rankings')
    .upsert(weightedRows, { onConflict: 'period_label,symbol' })
  if (weightedUpsertError) {
    await sendFailureAlert('refresh-monthly-rankings', `weighted_return_rankings upsert failed: ${weightedUpsertError.message}`)
    return NextResponse.json({ error: weightedUpsertError.message }, { status: 500 })
  }

  // ── Chain the newsletter ───────────────────────────────────────────────
  // Rankings are now in the database, so trigger the monthly newsletter right
  // away rather than relying on a separate fixed-time cron (which used to run
  // at 08:00 UTC and would send nothing if this job finished late). The
  // newsletter has its own already-sent guard, so a re-run of this job won't
  // send twice. Any newsletter failure is logged but never fails this route —
  // the rankings write is the critical part and has already succeeded.
  let newsletterTriggered = false
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.ownfolio.net'
    const nlRes = await fetch(`${base}/api/cron/send-newsletter`, {
      method: 'GET',
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    })
    newsletterTriggered = nlRes.ok
    if (!nlRes.ok) {
      const body = await nlRes.text()
      await sendFailureAlert('refresh-monthly-rankings', `Rankings succeeded but newsletter trigger returned ${nlRes.status}: ${body}`)
    }
  } catch (nlErr) {
    const detail = nlErr instanceof Error ? nlErr.message : String(nlErr)
    await sendFailureAlert('refresh-monthly-rankings', `Rankings succeeded but newsletter trigger threw: ${detail}`)
  }

  return NextResponse.json({
    ok: true,
    period: periodLabel,
    scored: rows.length,
    unscored: raw.length - scorable.length,
    newsletterTriggered,
    top25ByTier,
    top50Weighted: rankedWeighted.map(r => r.symbol),
  })
  } catch (err) {
    const detail = err instanceof Error ? (err.stack ?? err.message) : String(err)
    await sendFailureAlert('refresh-monthly-rankings', detail)
    return NextResponse.json({ error: 'Unexpected error -- alert sent.' }, { status: 500 })
  }
}