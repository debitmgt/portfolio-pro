// lib/email/resend.ts
// Thin wrapper so the rest of the app doesn't import the Resend SDK directly.
import { Resend } from 'resend'

let client: Resend | null = null

export function getResendClient(): Resend {
  if (!client) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set — add it in Vercel → Project → Settings → Environment Variables.')
    }
    client = new Resend(process.env.RESEND_API_KEY)
  }
  return client
}

export function fromAddress(): string {
  return process.env.NEWSLETTER_FROM_EMAIL ?? 'newsletter@ownfolio.net'
}

export interface BatchEmail {
  to: string
  subject: string
  html: string
}

// Resend's batch endpoint accepts up to 100 emails per call. Sends in
// chunks with a short pause between calls to stay well under rate limits.
const BATCH_LIMIT = 100
const BATCH_PAUSE_MS = 1_500

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function sendBatch(emails: BatchEmail[]): Promise<{ sent: number; failed: number; errors: string[] }> {
  if (!emails.length) return { sent: 0, failed: 0, errors: [] }

  const resend = getResendClient()
  const from = fromAddress()
  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (let i = 0; i < emails.length; i += BATCH_LIMIT) {
    const chunk = emails.slice(i, i + BATCH_LIMIT)
    try {
      const { error } = await resend.batch.send(
        chunk.map(e => ({ from, to: e.to, subject: e.subject, html: e.html }))
      )
      if (error) {
        failed += chunk.length
        errors.push(typeof error === 'string' ? error : JSON.stringify(error))
      } else {
        sent += chunk.length
      }
    } catch (err) {
      failed += chunk.length
      errors.push(err instanceof Error ? err.message : String(err))
    }
    if (i + BATCH_LIMIT < emails.length) {
      await sleep(BATCH_PAUSE_MS)
    }
  }

  return { sent, failed, errors }
}
