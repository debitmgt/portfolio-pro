// app/api/newsletter/unsubscribe/route.ts
// One-click unsubscribe target, shared by both audiences:
//   - Free Top 25 subscribers (newsletter_subscribers.unsubscribe_token)
//   - Pro watchlist digest recipients (profiles.newsletter_unsubscribe_token)
// Tries the free-subscriber table first, then falls back to profiles, since
// a token is only ever valid in one of the two.
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return NextResponse.redirect(new URL('/newsletter/unsubscribe-error', req.url))

  const admin = createAdminClient()

  const { data: sub } = await admin
    .from('newsletter_subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('unsubscribe_token', token)
    .select('id')
    .maybeSingle()
  if (sub) {
    return NextResponse.redirect(new URL('/newsletter/unsubscribed', req.url))
  }

  const { data: profile } = await admin
    .from('profiles')
    .update({ newsletter_opt_out: true })
    .eq('newsletter_unsubscribe_token', token)
    .select('id')
    .maybeSingle()
  if (profile) {
    return NextResponse.redirect(new URL('/newsletter/unsubscribed', req.url))
  }

  return NextResponse.redirect(new URL('/newsletter/unsubscribe-error', req.url))
}
