// app/api/watchlist/route.ts
// CRUD for a Pro user's watchlist — tickers only, never shares or cost
// basis. This is the personalization input for the monthly digest email
// (see app/api/cron/send-newsletter): the digest filters the same generic
// monthly_rankings every subscriber sees down to these symbols. It's
// intentionally a separate table/route from holdings, not an extension of it.
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const WATCHLIST_LIMIT = 25 // matches the Top 25 list size — no reason to allow more

async function requireProUser(supabase: ReturnType<typeof createServerClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as const }

  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
  if (profile?.plan !== 'pro') {
    return { error: NextResponse.json({ error: 'Watchlist is a Pro feature.' }, { status: 403 }) as const }
  }
  return { userId: user.id }
}

// GET — list the current user's watchlist
export async function GET() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('watchlist_items')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — add a symbol to the watchlist
export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const auth = await requireProUser(supabase)
  if ('error' in auth) return auth.error

  const body = await req.json()
  const symbol = (body.symbol as string | undefined)?.toUpperCase().trim()
  if (!symbol) return NextResponse.json({ error: 'symbol is required' }, { status: 400 })

  const { count } = await supabase
    .from('watchlist_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', auth.userId)

  if ((count ?? 0) >= WATCHLIST_LIMIT) {
    return NextResponse.json({ error: `Watchlist is limited to ${WATCHLIST_LIMIT} symbols.` }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('watchlist_items')
    .insert({ user_id: auth.userId, symbol })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: `${symbol} is already on your watchlist.` }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

// DELETE — remove a symbol from the watchlist
export async function DELETE(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('watchlist_items')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
