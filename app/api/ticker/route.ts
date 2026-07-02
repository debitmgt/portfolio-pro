// app/api/ticker/route.ts
// Public, unauthenticated endpoint for the homepage market ticker.
// Deliberately scoped to a fixed allowlist of broad-market index ETFs only —
// not a general symbol lookup — so it can't be used to scrape arbitrary quotes
// and doesn't invite "these are stocks we're highlighting" interpretation.
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const TICKER_SYMBOLS = [
  { symbol: 'SPY', label: 'S&P 500' },
  { symbol: 'QQQ', label: 'Nasdaq 100' },
  { symbol: 'DIA', label: 'Dow Jones' },
  { symbol: 'IWM', label: 'Russell 2000' },
] as const

export async function GET() {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return NextResponse.json({ items: [] })

  const items = await Promise.all(
    TICKER_SYMBOLS.map(async ({ symbol, label }) => {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`,
          { next: { revalidate: 60 } } // cache 60s at the edge — keeps this well under Finnhub's free-tier rate limit regardless of visitor traffic
        )
        if (!res.ok) return { symbol, label, price: null, changePct: null }
        const data = await res.json()
        return {
          symbol,
          label,
          price: typeof data.c === 'number' && data.c > 0 ? data.c : null,
          changePct: typeof data.dp === 'number' ? data.dp : null,
        }
      } catch {
        return { symbol, label, price: null, changePct: null }
      }
    })
  )

  return NextResponse.json({ items })
}
