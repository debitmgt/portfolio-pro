// app/api/holdings/route.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const FREE_LIMIT = 10

// GET  -  list holdings for current user
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('holdings')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST  -  add a holding
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = user.id

  // Enforce free-plan limit on the server (client-side check is UX only)
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single()

  if (profile?.plan === 'free') {
    const { count } = await supabase
      .from('holdings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if ((count ?? 0) >= FREE_LIMIT) {
      return NextResponse.json(
        { error: `Free plan is limited to ${FREE_LIMIT} holdings. Upgrade to Pro for unlimited.` },
        { status: 403 }
      )
    }
  }

  const body = await req.json()
  const { symbol, shares, cost_basis, trail_pct = 20, cost_basis_auto = false } = body

  // cost_basis is no longer something the user must have to hand. When they
  // leave it blank the client fills it with the current market price and sends
  // cost_basis_auto: true, which tells every downstream view that this figure
  // is a placeholder rather than what the person actually paid. Gain/loss for
  // those rows is meaningless and is kept out of portfolio totals until a real
  // number is entered. The column itself stays NOT NULL - we always store a
  // number, we just record whether it means anything.
  if (!symbol || shares == null || cost_basis == null) {
    return NextResponse.json(
      { error: 'symbol, shares, and cost_basis are required' },
      { status: 400 }
    )
  }

  if (shares <= 0 || cost_basis <= 0) {
    return NextResponse.json(
      { error: 'shares and cost_basis must be positive numbers' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('holdings')
    .insert({
      user_id: userId,
      symbol: symbol.toUpperCase().trim(),
      shares,
      cost_basis,
      trail_pct,
      cost_basis_auto: Boolean(cost_basis_auto),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PATCH  -  update a holding
export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const body = await req.json()
  const { shares, cost_basis, trail_pct, cost_basis_auto } = body

  // Build the patch explicitly so an omitted field is left alone rather than
  // being blanked out. Written as a spread literal rather than a mutable
  // object because Supabase's typed query builder needs to infer the exact
  // shape - a Record<string, unknown> is rejected at compile time.
  // Supplying a cost_basis through the edit form always means the user typed a
  // real one, so the placeholder flag clears itself unless the caller says
  // otherwise.
  const patch = {
    updated_at: new Date().toISOString(),
    ...(shares != null ? { shares } : {}),
    ...(trail_pct != null ? { trail_pct } : {}),
    ...(cost_basis != null
      ? { cost_basis, cost_basis_auto: cost_basis_auto === true }
      : cost_basis_auto != null
        ? { cost_basis_auto: Boolean(cost_basis_auto) }
        : {}),
  }

  const { data, error } = await supabase
    .from('holdings')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)   // RLS + explicit ownership check
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE  -  remove a holding
export async function DELETE(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('holdings')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)   // RLS + explicit ownership check

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

