// app/api/cron/send-lifecycle-emails/route.ts
//
// Scheduled daily job (see vercel.json). Sends the three account-lifecycle
// emails — welcome (immediate), day-3 feature nudge, day-14 re-engagement —
// exactly once per profile, tracked via the *_email_sent_at columns on
// profiles (see supabase/migrations/002_lifecycle_emails.sql). No admin UI
// needed: this is meant to run itself. Failures alert instead of requiring
// anyone to watch a dashboard — same pattern as the other cron routes.
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendFailureAlert } from '@/lib/email/alerts'
import { fromAddress, getResendClient } from '@/lib/email/resend'
import { renderWelcomeEmail, renderDay3Email, renderDay14Email } from '@/lib/email/lifecycle-templates'
import type { NextRequest } from 'next/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const DAY3_MIN_HOURS = 72
const DAY14_MIN_HOURS = 288 // 12 days — matches the "day 12-14" window in the copy

async function sendOne(to: string, subject: string, html: string): Promise<string | null> {
  try {
    const resend = getResendClient()
    const { error } = await resend.emails.send({ from: fromAddress(), to, subject, html })
    return error ? (typeof error === 'string' ? error : JSON.stringify(error)) : null
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = Date.now()
  const results = { welcome: { sent: 0, failed: 0 }, day3: { sent: 0, failed: 0 }, day14: { sent: 0, failed: 0 } }
  const errors: string[] = []

  try {
    // ── Welcome: anyone with no welcome_email_sent_at yet ─────────────────
    const { data: welcomeRows, error: welcomeErr } = await admin
      .from('profiles')
      .select('id, email')
      .is('welcome_email_sent_at', null)
    if (welcomeErr) {
      await sendFailureAlert('send-lifecycle-emails', `welcome query failed: ${welcomeErr.message}`)
      return NextResponse.json({ error: welcomeErr.message }, { status: 500 })
    }
    for (const row of welcomeRows ?? []) {
      if (!row.email) continue
      const { subject, html } = renderWelcomeEmail()
      const err = await sendOne(row.email, subject, html)
      if (err) {
        results.welcome.failed++
        errors.push(`welcome/${row.id}: ${err}`)
        continue
      }
      results.welcome.sent++
      await admin.from('profiles').update({ welcome_email_sent_at: new Date().toISOString() }).eq('id', row.id)
    }

    // ── Day 3: created_at >= 72h ago, day3_email_sent_at still null ───────
    const day3Cutoff = new Date(now - DAY3_MIN_HOURS * 3600_000).toISOString()
    const { data: day3Rows, error: day3Err } = await admin
      .from('profiles')
      .select('id, email')
      .is('day3_email_sent_at', null)
      .lte('created_at', day3Cutoff)
    if (day3Err) {
      await sendFailureAlert('send-lifecycle-emails', `day3 query failed: ${day3Err.message}`)
      return NextResponse.json({ error: day3Err.message }, { status: 500 })
    }
    for (const row of day3Rows ?? []) {
      if (!row.email) continue
      const { subject, html } = renderDay3Email()
      const err = await sendOne(row.email, subject, html)
      if (err) {
        results.day3.failed++
        errors.push(`day3/${row.id}: ${err}`)
        continue
      }
      results.day3.sent++
      await admin.from('profiles').update({ day3_email_sent_at: new Date().toISOString() }).eq('id', row.id)
    }

    // ── Day 14: created_at >= 288h (12 days) ago, day14_email_sent_at null ─
    const day14Cutoff = new Date(now - DAY14_MIN_HOURS * 3600_000).toISOString()
    const { data: day14Rows, error: day14Err } = await admin
      .from('profiles')
      .select('id, email')
      .is('day14_email_sent_at', null)
      .lte('created_at', day14Cutoff)
    if (day14Err) {
      await sendFailureAlert('send-lifecycle-emails', `day14 query failed: ${day14Err.message}`)
      return NextResponse.json({ error: day14Err.message }, { status: 500 })
    }
    for (const row of day14Rows ?? []) {
      if (!row.email) continue
      const { subject, html } = renderDay14Email()
      const err = await sendOne(row.email, subject, html)
      if (err) {
        results.day14.failed++
        errors.push(`day14/${row.id}: ${err}`)
        continue
      }
      results.day14.sent++
      await admin.from('profiles').update({ day14_email_sent_at: new Date().toISOString() }).eq('id', row.id)
    }

    if (errors.length > 0) {
      await sendFailureAlert('send-lifecycle-emails', `Partial send failure(s):\n\n${errors.join('\n')}`)
    }

    return NextResponse.json({ ok: true, ...results })
  } catch (err) {
    const detail = err instanceof Error ? (err.stack ?? err.message) : String(err)
    await sendFailureAlert('send-lifecycle-emails', detail)
    return NextResponse.json({ error: 'Unexpected error — alert sent.' }, { status: 500 })
  }
}
