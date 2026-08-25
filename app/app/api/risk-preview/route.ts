// app/api/risk-preview/route.ts
// Powers the one-time free Risk-tab preview: a free user gets to see their
// real (unblurred) Risk tab exactly once, then it reverts to the normal
// blurred/locked view for good. The "used" state lives on profiles.
// risk_preview_used_at (see migration 003) rather than in client state, so
// it survives reload, logout, another device, or even a later upgrade/
// downgrade cycle - once used, it stays used.
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET  -  has this account already used its one-time Risk preview?
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('profiles')
    .select('risk_preview_used_at')
    .eq('id', user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ used: data?.risk_preview_used_at != null })
}

// POST  -  spend the one-time preview. Only takes effect the first time it's
// called for an account (the WHERE clause below makes this idempotent), so a
// double-click or a retried request can never grant a second reveal.
export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('profiles')
    .update({ risk_preview_used_at: new Date().toISOString() })
    .eq('id', user.id)
    .is('risk_preview_used_at', null)
    .select('risk_preview_used_at')
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no row matched the update (already used) - not a real error,
    // just means someone else/another tab already spent it a moment ago.
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ used: true, usedAt: data?.risk_preview_used_at ?? null })
}
