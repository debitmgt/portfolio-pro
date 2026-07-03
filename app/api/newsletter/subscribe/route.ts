// app/api/newsletter/subscribe/route.ts
// Public, account-free signup for the free monthly Top 25 email. Writes go
// through the admin client since newsletter_subscribers has no RLS policies
// at all (locked to service role only — see the create_newsletter_tables
// migration comment).
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendBatch } from '@/lib/email/resend'
import { renderConfirmSubscriptionEmail } from '@/lib/email/newsletter-templates'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('newsletter_subscribers')
    .select('*')
    .eq('email', email)
    .maybeSingle()

  if (existing?.confirmed && !existing.unsubscribed_at) {
    return NextResponse.json({ ok: true, note: 'Already subscribed.' })
  }

  let confirmToken = existing?.confirm_token
  if (!existing) {
    const { data: inserted, error } = await admin
      .from('newsletter_subscribers')
      .insert({ email })
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    confirmToken = inserted.confirm_token
  } else if (existing.unsubscribed_at) {
    // Re-subscribing after a prior unsubscribe — reset state, issue a fresh
    // confirm flow rather than silently re-activating.
    const { error } = await admin
      .from('newsletter_subscribers')
      .update({ confirmed: false, unsubscribed_at: null })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!confirmToken) {
    return NextResponse.json({ error: 'Could not generate confirmation link.' }, { status: 500 })
  }

  const rendered = renderConfirmSubscriptionEmail({ confirmToken })
  const result = await sendBatch([{ to: email, subject: rendered.subject, html: rendered.html }])
  if (result.failed > 0) {
    return NextResponse.json({ error: 'Signed up, but the confirmation email failed to send. Try again shortly.' }, { status: 502 })
  }

  return NextResponse.json({ ok: true, note: 'Check your email to confirm your subscription.' })
}
