'use client'
// app/auth/reset-password/page.tsx
// Reached via the link in a Supabase password-recovery email: forgot-password
// triggers resetPasswordForEmail -> Supabase emails a link to /auth/callback
// (which exchanges the code and establishes a real session) -> redirected here
// with that session already active. middleware.ts has a carve-out so a signed-in
// user landing on this specific path isn't bounced to /dashboard.
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DisclaimerFooter from '@/components/DisclaimerFooter'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()

  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setHasSession(!!user)
      setChecking(false)
    })
  }, [supabase])

  async function handleSubmit() {
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 1800)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return <AuthShell><p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>Loading…</p></AuthShell>
  }

  if (!hasSession) {
    return (
      <AuthShell>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: 12, fontSize: 20 }}>This link has expired</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
            Password reset links only work once and expire after a while. Request a new one to continue.
          </p>
          <a href="/auth/forgot-password">
            <button className="btn-primary" style={{ padding: '10px 20px', fontSize: 14 }}>
              Request a new link
            </button>
          </a>
        </div>
      </AuthShell>
    )
  }

  if (done) {
    return (
      <AuthShell>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
          <h2 style={{ marginBottom: 12, fontSize: 20 }}>Password updated</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
            Taking you to your dashboard…
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
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--muted)' }}>Set a new password</h2>
      </div>

      <label style={labelStyle}>New password</label>
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="••••••••"
        style={{ marginBottom: 14 }}
        autoComplete="new-password"
      />

      <label style={labelStyle}>Confirm new password</label>
      <input
        type="password"
        value={confirmPassword}
        onChange={e => setConfirmPassword(e.target.value)}
        placeholder="••••••••"
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        style={{ marginBottom: 20 }}
        autoComplete="new-password"
      />

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
        disabled={loading}
        style={{ width: '100%', padding: '11px 0', fontSize: 15 }}
      >
        {loading ? 'Please wait…' : 'Update password'}
      </button>
    </AuthShell>
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
