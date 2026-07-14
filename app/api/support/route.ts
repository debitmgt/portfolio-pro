// app/api/support/route.ts
// Backs the /support contact form. Logs every message to support_messages,
// sends the submitter an autoresponder, and — if the message matches simple
// billing/account keywords — sends a separate urgent alert so those don't
// wait behind everything else in the inbox. See lib/email/support.ts.
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendSupportAutoResponder, sendUrgentSupportAlert } from '@/lib/email/support'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// Deliberately simple substring matching, not NLP — false positives just
// mean a normal message gets prioritized too, which is a fine failure mode.
const URGENT_KEYWORDS = [
  'refund', 'billing', 'charge', 'charged', 'double charge', 'double-charge',
  'cancel', 'subscription', 'payment', 'invoice', 'dispute', 'chargeback',
  "can't log in", 'cant log in', "can't login", 'cant login', 'locked out',
]

function isUrgent(message: string): boolean {
  const lower = message.toLowerCase()
  return URGENT_KEYWORDS.some(k => lower.includes(k))
}

export async function POST(req: NextRequest) {
  let body: { name?: string; email?: string; message?: string; website?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  // Honeypot — mirrors the hidden "website" field in SupportContactForm.tsx.
  // Real users never fill it; anything hitting this route with it set is a
  // bot posting directly, not just one that skipped the client-side JS.
  // Report success so it doesn't learn to leave the field alone.
  if (body.website && body.website.trim()) {
    return NextResponse.json({ ok: true })
  }

  const name = (body.name ?? '').trim().slice(0, 200) || null
  const email = (body.email ?? '').trim().slice(0, 320)
  const message = (body.message ?? '').trim().slice(0, 5000)

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  }
  if (!message) {
    return NextResponse.json({ error: 'A message is required.' }, { status: 400 })
  }

  const urgent = isUrgent(message)
  const admin = createAdminClient()

  const { error } = await admin.from('support_messages').insert({ name, email, message, urgent })
  if (error) {
    console.error('[support] insert failed:', error)
    return NextResponse.json(
      { error: 'Something went wrong on our end — please email support@ownfolio.net directly.' },
      { status: 500 }
    )
  }

  // Best-effort — the message is already saved even if either send fails.
  await sendSupportAutoResponder(email, name)
  if (urgent) {
    await sendUrgentSupportAlert(`From: ${name ?? '(no name given)'} <${email}>\n\n${message}`)
  }

  return NextResponse.json({ ok: true })
}
