import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY
const PERIOD = process.env.PERIOD || new Date().toISOString().slice(0, 7)

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !FINNHUB_API_KEY) {
  console.error('Missing required env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function fetchOne(symbol) {
  try {
    const [profileRes, metricRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`),
      fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${FINNHUB_API_KEY}`),
    ])
    const profile = profileRes.ok ? await profileRes.json() : {}
    const metricData = metricRes.ok ? await metricRes.json() : {}
    const metric = metricData.metric ?? {}
    return {
      symbol,
      sector: profile.finnhubIndustry ?? null,
      pe_ttm: metric.peBasicExclExtraTTM ?? metric.peExclExtraTTM ?? null,
      pb_ratio: metric.pbAnnual ?? null,
    }
  } catch (e) {
    return { symbol, sector: null, pe_ttm: null, pb_ratio: null, error: String(e) }
  }
}

const OFFSET = parseInt(process.env.OFFSET || '0', 10)
const LIMIT = parseInt(process.env.LIMIT || '25', 10)

async function main() {
  const { data: rows, error } = await supabase
    .from('monthly_rankings')
    .select('symbol')
    .eq('period_label', PERIOD)
    .order('symbol', { ascending: true })
  if (error) { console.error('READ ERROR', error); process.exit(1) }

  const allSymbols = rows.map(r => r.symbol)
  const symbols = allSymbols.slice(OFFSET, OFFSET + LIMIT)
  console.log(`Period ${PERIOD}: ${allSymbols.length} total, processing [${OFFSET}, ${OFFSET + symbols.length})`)

  let updated = 0
  const failed = []

  const results = await Promise.all(symbols.map(fetchOne))
  for (const r of results) {
    const { error: updErr } = await supabase
      .from('monthly_rankings')
      .update({ sector: r.sector, pe_ttm: r.pe_ttm, pb_ratio: r.pb_ratio })
      .eq('period_label', PERIOD)
      .eq('symbol', r.symbol)
    if (updErr) {
      failed.push(r.symbol)
      console.error(`UPDATE FAIL ${r.symbol}`, updErr.message)
    } else {
      updated += 1
    }
  }

  console.log(`DONE chunk offset=${OFFSET} updated=${updated} failed=${failed.length} failedSymbols=${failed.join(',')} nextOffset=${OFFSET + LIMIT} totalSymbols=${allSymbols.length}`)
}

main().catch(e => { console.error('FATAL', e); process.exit(1) })
