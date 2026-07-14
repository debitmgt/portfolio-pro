'use client'
// components/SupportContactForm.tsx
// Posts to app/api/support, which logs to support_messages, sends the
// submitter an autoresponder, and fires an urgent-priority alert to Dwight
// if the message matches billing/account keywords. See lib/email/support.ts.
import { useState } from 'react'

export default function SupportContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  // Honeypot — real users never see or fill this field (visually hidden,
  // not just off-screen, so it also survives accessibility-tree scraping
  // bots). Any submission with it filled in is silently dropped.
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !message.trim()) return

    if (website.trim()) {
      // Bot filled the honeypot — pretend success, send nothing.
      setStatus('done')
      return
    }

    setStatus('loading')
    setError('')
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), message: message.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      setStatus('done')
    } catch {
      setStatus('error')
      setError('Something went wrong. Please try again, or email support@ownfolio.net directly.')
    }
  }

  if (status === 'done') {
    return (
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 6, padding: '28px 28px', textAlign: 'center',
      }}>
        <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Message sent</p>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
          We got it — check your inbox for a confirmation. We typically reply within 1–2 business days.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 6, padding: '28px 28px', display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Honeypot field — hidden from real users via CSS, not `type="hidden"`,
          so basic bots that only skip hidden inputs still fill it. */}
      <div style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }} aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} />
      </div>

      <div>
        <label style={labelStyle}>Name (optional)</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Jane Doe"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>How can we help?</label>
        <textarea
          required
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Tell us what's going on — the more detail, the faster we can help."
          rows={5}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>

      {status === 'error' && (
        <div style={{
          background: 'var(--red-tint)', border: '1px solid var(--red)',
          borderRadius: 4, padding: '10px 14px',
        }}>
          <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="btn-primary"
        style={{ padding: '11px 0', fontSize: 15 }}
      >
        {status === 'loading' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 500,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)',
}
