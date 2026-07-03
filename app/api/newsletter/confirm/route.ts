// app/api/newsletter/confirm/route.ts
// Double opt-in confirmation link target — GET so it works as a plain email
// link click, no form/JS required.
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return NextResponse.redirect(new URL('/newsletter/confirm-error', req.url))

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('newsletter_subscribers')
    .update({ confirmed: true, confirmed_at: new Date().toISOString() })
    .eq('confirm_token', token)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    return NextResponse.redirect(new URL('/newsletter/confirm-error', req.url))
  }
  return NextResponse.redirect(new URL('/newsletter/confirmed', req.url))
}
