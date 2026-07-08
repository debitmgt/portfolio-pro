'use client'
// app/auth/confirm/page.tsx
//
// Why this page exists: Supabase's default password-recovery email links
// straight to Supabase's own hosted /verify endpoint, which is a plain GET
// and consumes the one-time recovery token the instant it's requested.
// Gmail (and Outlook, and most corporate mail security scanners) pre-fetch
// links in incoming email to scan them for phishing/malware — a real GET
// request, made by Google's servers, before the human ever opens the email.
// That silently burns the token, so by the time Dwight actually clicked the
// link, Supabase had already invalidated it ("Email link is invalid or has
// expired" / "One-time token not found" in the auth logs), the callback
// redirected to /auth/login, and a saved browser password logged him back
// in with his OLD password — with no indication anything had gone wrong.
//
// Fix: point the email template at THIS page instead (with token_hash +
// type in the query string, not a self-consuming link), and require an
// actual button click before calling verifyOtp. Scanners fetch the page;
// they don't click buttons or run our JS. Only a real click burns the token.
//
// Requires updating the "Reset Password" email template in Supabase
// Dashboard -> Authentication -> Email Templates to link here — see the
// comment in app/auth/forgot-password/page.tsx.
export const dynamic = 'force-dynamic'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import type { EmailOtpType } from '@supabase/supabase-js'

function ConfirmForm() {
  const supabase = createClient()
  const router = useRouter()
  const params = useSearchParams()

  const tokenHash = params.get('token_hash')
  const type = (params.get('type') as EmailOtpType | null) ?? 'recovery'
  const next = params.get('next') ?? '/auth/reset-password'

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    if (!tokenHash) { setError('This link is missing required information. Request a new one.'); return }
    setError('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      if (error) throw error
      router.push(next)
      router.refresh()
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : 'This link may have already been used or expired.'
      )
      setLoading(false)
    }
  }

  if (!tokenHash) {
    return (
      <AuthShell>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: 12, fontSize: 20 }}>This link isn&apos;t valid</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
            Request a new password reset link to continue.
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

  return (
    <AuthShell>
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 20 }}>
          <span style={{
            width: 26, height: 26, background: 'var(--accent)', borderRadius: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 14,
          }}>O</span>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.3px' }}>Ownfolio</span>
        </div>
        <h2 style={{ marginBottom: 12, fontSize: 20 }}>Confirm password reset</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          For your security, click below to continue to the reset password page.
        </p>

        {error && (
          <div style={{
            background: 'var(--red-tint)', border: '1px solid var(--red)',
            borderRadius: 4, padding: '10px 14px', marginBottom: 16, textAlign: 'left',
          }}>
            <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>
            <a href="/auth/forgot-password" className="link" style={{ fontSize: 12.5 }}>Request a new link</a>
          </div>
        )}

        <button
          className="btn-primary"
          onClick={handleConfirm}
          disabled={loading}
          style={{ padding: '11px 24px', fontSize: 15 }}
        >
          {loading ? 'Confirming…' : 'Continue'}
        </button>
      </div>
    </AuthShell>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
      <ConfirmForm />
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
