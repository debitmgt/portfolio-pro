// lib/email/support.ts
// Two small, focused sends for the /support contact form:
//   - an autoresponder to the person who wrote in, so "did this even go
//     through?" isn't a support question of its own
//   - an urgent-priority alert to Dwight when the message matches billing/
//     account-access keywords, so those don't sit in the inbox behind
//     everything else
// Both are best-effort — a failure here must not block the form submission
// itself (the message is already saved to support_messages by that point).
import { getResendClient, fromAddress } from './resend'

const SUPPORT_ALERT_TO = process.env.ALERT_EMAIL ?? 'debitmgt@gmail.com'

export async function sendSupportAutoResponder(to: string, name: string | null): Promise<void> {
  try {
    const resend = getResendClient()
    const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi,'
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to,
      subject: "We've got your message — Ownfolio support",
      html:
        `<p>${greeting}</p>` +
        `<p>Thanks for writing in — this confirms we received your message. We typically reply within 1–2 business days.</p>` +
        `<p>If this is about a charge, refund, or account access, we prioritize those and aim to get back to you sooner.</p>` +
        `<p>— Ownfolio Support<br/>support@ownfolio.net</p>`,
    })
    if (error) console.error('[support] Resend rejected autoresponder:', error)
  } catch (err) {
    console.error('[support] Failed to send autoresponder:', err)
  }
}

export async function sendUrgentSupportAlert(detail: string): Promise<void> {
  try {
    const resend = getResendClient()
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to: SUPPORT_ALERT_TO,
      subject: '[Ownfolio] Urgent support message',
      html: `<pre style="white-space:pre-wrap;font-family:monospace;font-size:13px;">${escapeHtml(detail)}</pre>`,
    })
    if (error) console.error('[support] Resend rejected urgent alert:', error)
  } catch (err) {
    console.error('[support] Failed to send urgent alert:', err)
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
