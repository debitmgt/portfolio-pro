// app/api/finnhub/route.ts
// Server-side proxy so FINNHUB_API_KEY is never exposed to the browser.
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export const maxDuration = 15
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const key = process.env.FINNHUB_API_KEY!

  // ─── Fundamentals (company profile + basic financials) ───────────────────
  // Both /stock/profile2 and /stock/metric are on Finnhub's free tier.
  // Finnhub doesn't support batching these, so this branch handles one symbol.
  if (type === 'fundamentals') {
    const symbol = searchParams.get('symbol')?.trim().toUpperCase()
    if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })

    try {
      const [profileRes, metricRes] = await Promise.all([
        fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${key}`, {
          next: { revalidate: 3600 },   // fundamentals change slowly — cache 1hr
        }),
        fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${key}`, {
          next: { revalidate: 3600 },
        }),
      ])

      const profile = profileRes.ok ? await profileRes.json() : {}
      const metricData = metricRes.ok ? await metricRes.json() : {}
      const metric = metricData.metric ?? {}

      // Empty object ({}) is what Finnhub returns for an unrecognized symbol
      if (!profile.name && metric.beta == null) {
        return NextResponse.json({ error: 'No data found for symbol' }, { status: 404 })
      }

      return NextResponse.json({
        symbol,
        name: profile.name ?? null,
        industry: profile.finnhubIndustry ?? null,
        marketCap: profile.marketCapitalization ?? null,   // in millions USD
        peRatio: metric.peBasicExclExtraTTM ?? metric.peExclExtraTTM ?? null,
        week52High: metric['52WeekHigh'] ?? null,
        week52Low: metric['52WeekLow'] ?? null,
        beta: metric.beta ?? null,
        logo: profile.logo ?? null,
      })
    } catch {
      return NextResponse.json({ error: 'Failed to fetch fundamentals' }, { status: 502 })
    }
  }

  // ─── Company news (live headlines for a held ticker) ──────────────────────
  // Finnhub's free-tier /company-news endpoint requires a from/to date range.
  // We pull the last 7 days and cap the count client-side.
  if (type === 'news') {
    const symbol = searchParams.get('symbol')?.trim().toUpperCase()
    if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })

    const to = new Date()
    const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)

    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fmt(from)}&to=${fmt(to)}&token=${key}`,
        { next: { revalidate: 900 } }   // headlines don't need to be more than ~15min fresh
      )
      if (!res.ok) return NextResponse.json({ error: 'Failed to fetch news' }, { status: 502 })

      const raw: Array<{ headline: string; source: string; url: string; datetime: number; summary: string }> = await res.json()

      const items = (Array.isArray(raw) ? raw : [])
        .filter(a => a.headline && a.url)
        .sort((a, b) => b.datetime - a.datetime)
        .slice(0, 8)
        .map(a => ({
          headline: a.headline,
          source: a.source,
          url: a.url,
          datetime: a.datetime * 1000,   // Finnhub returns seconds; JS Date wants ms
          summary: a.summary,
        }))

      return NextResponse.json({ symbol, items })
    } catch {
      return NextResponse.json({ error: 'Failed to fetch news' }, { status: 502 })
    }
  }

  // ─── Earnings history (quarterly EPS actual vs. estimate) ─────────────────
  // /stock/earnings is still on Finnhub's free tier. It returns the company's
  // most recent quarters of EPS surprises; we keep the last 4 (~1 year).
  // Cached 24hrs since this only changes once a quarter, right after earnings.
  if (type === 'earnings') {
    const symbol = searchParams.get('symbol')?.trim().toUpperCase()
    if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })

    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/stock/earnings?symbol=${encodeURIComponent(symbol)}&token=${key}`,
        { next: { revalidate: 86400 } }
      )
      if (!res.ok) return NextResponse.json({ error: 'Failed to fetch earnings' }, { status: 502 })

      const raw: Array<{
        actual: number | null
        estimate: number | null
        period: string
        quarter: number
        surprisePercent: number | null
        year: number
      }> = await res.json()

      const items = (Array.isArray(raw) ? raw : [])
        .sort((a, b) => new Date(b.period).getTime() - new Date(a.period).getTime())
        .slice(0, 4)   // last 4 quarters ≈ 1 year of history
        .map(q => ({
          period: q.period,
          quarter: q.quarter,
          year: q.year,
          actual: q.actual,
          estimate: q.estimate,
          surprisePercent: q.surprisePercent,
        }))

      return NextResponse.json({ symbol, items })
    } catch {
      return NextResponse.json({ error: 'Failed to fetch earnings' }, { status: 502 })
    }
  }

  // ─── Live quotes ───────────────────────────────────────────────────────────
  const symbols = searchParams.get('symbols')?.split(',').map(s => s.trim()).filter(Boolean) ?? []

  if (!symbols.length) return NextResponse.json({})

  // Limit to 20 symbols per call to stay within Finnhub free-tier rate limits
  const limited = symbols.slice(0, 20)
  const results: Record<string, number> = {}

  await Promise.all(
    limited.map(async (sym) => {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${key}`,
          { next: { revalidate: 30 } }   // cache 30s at the edge
        )
        if (!res.ok) return
        const data = await res.json()
        if (data.c && data.c > 0) results[sym] = data.c  // c = current price
      } catch {
        // Skip failed symbols silently — UI shows '—' for missing prices
      }
    })
  )

  return NextResponse.json(results)
}
