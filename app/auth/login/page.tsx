'use client'
// app/auth/login/page.tsx
export const dynamic = 'force-dynamic'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DisclaimerFooter from '@/components/DisclaimerFooter'

function LoginForm() {
  const supabase = createClient()
  const router = useRouter()
  const params = useSearchParams()
  const redirectTo = params.get('redirectTo') ?? '/dashboard'
  const plan = params.get('plan')
  const urlError = params.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState(urlError ?? '')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)

  async function handleSubmit() {
    setError('')
    if (mode === 'signup' && !acknowledged) {
      setError('Please confirm you understand Ownfolio is data and analytics, not personalized advice, before creating an account.')
      return
    }
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
              plan ? `/api/stripe/checkout?plan=${plan}` : redirectTo
            )}`,
          },
        })
        if (error) throw error
        setSent(true)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        if (plan) {
          window.location.href = `/api/stripe/checkout?plan=${plan}`
        } else {
          router.push(redirectTo)
          router.refresh()
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <AuthShell>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
          <h2 style={{ marginBottom: 12, fontSize: 20 }}>Check your email</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
            We sent a confirmation link to <strong>{email}</strong>.<br />
            Click it to activate your account and get started.
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 4 }}>
          <span style={{
            width: 26, height: 26, background: 'var(--accent)', borderRadius: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 14,
          }}>O</span>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.3px' }}>Ownfolio</span>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--muted)' }}>
          {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
        </h2>
      </div>

      <label style={labelStyle}>Email</label>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="you@example.com"
        style={{ marginBottom: 14 }}
        autoComplete="email"
      />

      <label style={labelStyle}>Password</label>
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="••••••••"
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        style={{ marginBottom: 20 }}
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
      />

      {mode === 'signup' && (
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 18,
          fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5, cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={e => setAcknowledged(e.target.checked)}
            style={{ marginTop: 2, flexShrink: 0 }}
          />
          <span>
            I understand Ownfolio provides data and analytics for self-directed, long-term investors —
            not personalized investment advice. See the{' '}
            <a href="/disclaimer" target="_blank" rel="noopener noreferrer" className="link" style={{ fontSize: 12.5 }}>
              full disclaimer
            </a>.
          </span>
        </label>
      )}

      {error && (
        <div style={{
          background: 'var(--red-tint)', border: '1px solid var(--red)',
          borderRadius: 4, padding: '10px 14px', marginBottom: 16,
        }}>
          <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>
        </div>
      )}

      <button
        className="btn-primary"
        onClick={handleSubmit}
        disabled={loading || (mode === 'signup' && !acknowledged)}
        style={{ width: '100%', padding: '11px 0', fontSize: 15, opacity: (mode === 'signup' && !acknowledged) ? 0.6 : 1 }}
      >
        {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
      </button>

      <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <button
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
          style={{ background: 'none', padding: 0, color: 'var(--accent)', fontWeight: 600, fontSize: 13 }}
        >
          {mode === 'login' ? 'Sign up free' : 'Sign in'}
        </button>
      </p>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
      <LoginForm />
    </Suspense>
  )
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 24,
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 6, padding: '36px 32px', width: '100%', maxWidth: 400,
      }}>
        {children}
      </div>
      <div style={{ width: '100%', maxWidth: 400, marginTop: 16 }}>
        <DisclaimerFooter />
      </div>
    </main>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 500,
}
