// lib/email/alerts.ts
// Fire-and-forget failure-alert emails for cron jobs and the Stripe webhook —
// the "something broke and nobody would otherwise notice" gap. Reuses the
// same Resend account as newsletter/auth email (see lib/email/resend.ts).
//
// Deliberately never throws: a failure to send the alert itself must not
// mask or replace the original error being reported. Worst case, this logs
// to Vercel and the caller's own error response/logging still happens.
import { getResendClient, fromAddress } from './resend'

const ALERT_TO = process.env.ALERT_EMAIL ?? 'debitmgt@gmail.com'

export async function sendFailureAlert(source: string, detail: string): Promise<void> {
  try {
    const resend = getResendClient()
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to: ALERT_TO,
      subject: `[Ownfolio] ${source} failed`,
      html:
        `<p><strong>${escapeHtml(source)}</strong> failed at ${new Date().toISOString()}.</p>` +
        `<pre style="white-space:pre-wrap;font-family:monospace;font-size:13px;">${escapeHtml(detail)}</pre>`,
    })
    if (error) console.error('[alerts] Resend rejected failure-alert email:', error)
  } catch (err) {
    console.error('[alerts] Failed to send failure-alert email:', err)
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
