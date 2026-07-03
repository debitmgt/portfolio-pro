// app/api/ticker-metrics/route.ts
//
// Read-only lookup against public.ticker_metrics. This route computes
// nothing — it filters the shared, precomputed table (written by
// app/api/cron/refresh-ticker-metrics) down to the symbols the caller asks
// for. Any authenticated user asking for AAPL gets the exact same row as
// any other. That "filter, don't compute" shape is the point.
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const symbols = (searchParams.get('symbols') ?? '')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean)

  if (!symbols.length) return NextResponse.json({ items: [] })

  const { data, error } = await supabase
    .from('ticker_metrics')
    .select('*')
    .in('symbol', symbols)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ items: data ?? [] })
}
