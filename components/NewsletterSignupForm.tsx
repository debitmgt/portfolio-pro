'use client'
// components/NewsletterSignupForm.tsx
// Account-free email capture for the free monthly Top 25 newsletter — posts
// to app/api/newsletter/subscribe, which sends a double opt-in confirmation
// email rather than subscribing immediately.
import { useId, useState } from 'react'
import Link from 'next/link'

export default function NewsletterSignupForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')
  // Stable id so the <label> can point at the input. useId keeps it unique if
  // this form is ever rendered more than once on a page.
  const emailId = useId()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    setMessage('')
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setMessage(data.error ?? 'Something went wrong. Try again.')
        return
      }
      setStatus('done')
      setMessage(data.note ?? 'Check your email to confirm.')
    } catch {
      setStatus('error')
      setMessage('Something went wrong. Try again.')
    }
  }

  if (status === 'done') {
    return (
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        {/* role="status" so screen readers announce the confirmation without
            the user having to go looking for it. */}
        <p role="status" style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>{message}</p>
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'center', maxWidth: 420 }}>
      <h3 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.3px', marginBottom: 6 }}>Raw Performance Data. Zero Market Noise.</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
        Get a free monthly list of the Top 25 best-performing stocks across Large-, Mid-, and Small-cap tiers, delivered straight to your inbox. No account needed.
      </p>
      <form onSubmit={submit} style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {/* The placeholder alone left this field unlabelled — a screen reader
            announced only "edit text, blank". Placeholders disappear on typing
            and are skipped by some readers, so they are not a substitute for a
            label. Hidden visually with .sr-only; the design is unchanged. */}
        <label htmlFor={emailId} className="sr-only">Email address</label>
        <input
          id={emailId}
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          style={{ maxWidth: 220, padding: '10px 12px', fontSize: 13, borderRadius: 6 }}
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="btn-outline"
          style={{ padding: '10px 18px', fontSize: 13, fontWeight: 600, borderRadius: 6, cursor: 'pointer' }}
        >
          {status === 'loading' ? 'Signing up…' : 'Get the Next Free Report'}
        </button>
      </form>
      {status === 'error' && (
        <p role="alert" style={{ color: 'var(--red)', fontSize: 12, marginTop: 8 }}>{message}</p>
      )}
      <p style={{ marginTop: 10, fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6 }}>
        No investment advice. No group chats or hype. Pure, historical market metrics for self-directed investors.
      </p>
      <p style={{ marginTop: 8 }}>
        <Link href="/newsletter/archive" style={{ fontSize: 12, color: 'var(--muted)' }}>Browse past issues →</Link>
      </p>
    </div>
  )
}
