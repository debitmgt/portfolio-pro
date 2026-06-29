import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const FREE_LIMIT = 3

export async function GET() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('holdings')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ holdings: data })
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', session.user.id)
    .single()

  if (profile?.plan !== 'pro') {
    const { count } = await supabase
      .from('holdings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)

    if ((count ?? 0) >= FREE_LIMIT) {
      return NextResponse.json(
        { error: `Free plan is limited to ${FREE_LIMIT} holdings. Upgrade to Pro for unlimited.` },
        { status: 403 }
      )
    }
  }

  const body = await req.json()
  const { symbol, shares, cost_basis, trail_pct } = body

  if (!symbol || !shares || !cost_basis) {
    return NextResponse.json({ error: 'symbol, shares, and cost_basis are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('holdings')
    .insert({
      user_id: session.user.id,
      symbol: symbol.toUpperCase(),
      shares: Number(shares),
      cost_basis: Number(cost_basis),
      trail_pct: Number(trail_pct) || 8,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ holding: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('holdings')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id) // ownership check

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
