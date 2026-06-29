import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const symbols = req.nextUrl.searchParams.get('symbols')?.toUpperCase()
  if (!symbols) return NextResponse.json({ error: 'symbols required' }, { status: 400 })

  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Finnhub not configured' }, { status: 500 })

  const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean).slice(0, 50)

  const results: Record<string, { price: number; change: number; changePct: number }> = {}

  await Promise.allSettled(
    symbolList.map(async (sym) => {
      const url = `https://finnhub.io/api/v1/quote?symbol=${sym}&token=${apiKey}`
      const res = await fetch(url, { next: { revalidate: 60 } })
      const data = await res.json()
      if (data.c) {
        results[sym] = {
          price: data.c,
          change: data.d ?? 0,
          changePct: data.dp ?? 0,
        }
      }
    })
  )

  return NextResponse.json({ prices: results })
}
