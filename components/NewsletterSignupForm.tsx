'use client'
// components/NewsletterSignupForm.tsx
// Account-free email capture for the free monthly Top 25 newsletter — posts
// to app/api/newsletter/subscribe, which sends a double opt-in confirmation
// email rather than subscribing immediately.
import { useState } from 'react'
import Link from 'next/link'

export default function NewsletterSignupForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

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
        <p style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>{message}</p>
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'center', maxWidth: 420 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Just want the free newsletter?</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
        The Ownfolio LLC Top 25 — the 25 highest trailing 1-year returns in each of large-cap, mid-cap, and small-cap, plus a combined Top 50 recency-weighted list, once a month. No account needed.
      </p>
      <form onSubmit={submit} style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{ maxWidth: 220, padding: '10px 12px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)' }}
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="btn-outline"
          style={{ padding: '10px 18px', fontSize: 13, fontWeight: 600, borderRadius: 6, cursor: 'pointer' }}
        >
          {status === 'loading' ? 'Signing up…' : 'Subscribe'}
        </button>
      </form>
      {status === 'error' && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 8 }}>{message}</p>}
      <p style={{ marginTop: 12 }}>
        <Link href="/newsletter/archive" style={{ fontSize: 12, color: 'var(--muted)' }}>Browse past issues →</Link>
      </p>
    </div>
  )
}
