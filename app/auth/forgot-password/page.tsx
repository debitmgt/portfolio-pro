'use client'
// app/auth/forgot-password/page.tsx
export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect, useCallback } from 'react'
import Script from 'next/script'
import { createClient } from '@/lib/supabase/client'
import DisclaimerFooter from '@/components/DisclaimerFooter'

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string
      reset: (widgetId?: string) => void
    }
  }
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

export default function ForgotPasswordPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  // Same Turnstile bot-protection pattern as login/signup — a password-reset
  // endpoint is just as attractive a target for scripted abuse (email-bombing
  // arbitrary addresses), so it gets the same gate.
  const turnstileRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | undefined>(undefined)
  const [turnstileReady, setTurnstileReady] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')

  useEffect(() => {
    if (!turnstileReady || !turnstileRef.current || !window.turnstile || widgetIdRef.current) return
    widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token: string) => setCaptchaToken(token),
      'expired-callback': () => setCaptchaToken(''),
      'error-callback': () => setCaptchaToken(''),
    })
  }, [turnstileReady])

  const resetCaptcha = useCallback(() => {
    setCaptchaToken('')
    if (window.turnstile && widgetIdRef.current) window.turnstile.reset(widgetIdRef.current)
  }, [])

  async function handleSubmit() {
    setError('')
    if (!email) { setError('Enter your email address'); return }
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError('Please complete the verification check above.')
      return
    }
    setLoading(true)
    try {
      // NOTE: this redirectTo only matters if the "Reset Password" email template
      // in Supabase Dashboard -> Authentication -> Email Templates still uses the
      // default {{ .ConfirmationURL }} link. That link points at Supabase's own
      // hosted /verify endpoint, which is a plain GET and consumes the one-time
      // recovery token immediately — including when Gmail/Outlook's link-scanning
      // bots pre-fetch it straight out of the inbox, before a human ever clicks it.
      // That's confirmed happening in the auth logs (2026-07-08): Google IPs hit
      // /verify and burn the token, then the real click gets "Email link is
      // invalid or has expired" and silently falls back to /auth/login, where a
      // saved browser password logs the user back in with their OLD password —
      // no error, no new password set, no indication anything went wrong.
      //
      // Fix (needs a one-time manual change in the Supabase Dashboard, not just
      // code — there's no API for editing email templates from here): replace
      // the template's link with
      //   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password
      // app/auth/confirm/page.tsx requires an actual button click before it
      // calls verifyOtp(), so scanner pre-fetches (which only GET the page,
      // never click anything) can't burn the token anymore.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        captchaToken: captchaToken || undefined,
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/auth/reset-password')}`,
      })
      if (error) throw error
      setSent(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
      resetCaptcha()
    }
  }

  if (sent) {
    return (
      <AuthShell>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
          <h2 style={{ marginBottom: 12, fontSize: 20 }}>Check your email</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
            If an account exists for <strong>{email}</strong>, we sent a link to reset your password.
          </p>
          <p style={{ marginTop: 20, fontSize: 13 }}>
            <a href="/auth/login" className="link">Back to sign in</a>
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      {TURNSTILE_SITE_KEY && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
          onLoad={() => setTurnstileReady(true)}
        />
      )}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 4 }}>
          <span style={{
            width: 26, height: 26, background: 'var(--accent)', borderRadius: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 14,
          }}>O</span>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.3px' }}>Ownfolio LLC</span>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--muted)' }}>Reset your password</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
          Enter the email address on your account and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      <label style={labelStyle}>Email</label>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="you@example.com"
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        style={{ marginBottom: 20 }}
        autoComplete="email"
      />

      {error && (
        <div style={{
          background: 'var(--red-tint)', border: '1px solid var(--red)',
          borderRadius: 4, padding: '10px 14px', marginBottom: 16,
        }}>
          <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>
        </div>
      )}

      {TURNSTILE_SITE_KEY && (
        <div ref={turnstileRef} style={{ marginBottom: 18, display: 'flex', justifyContent: 'center' }} />
      )}

      <button
        className="btn-primary"
        onClick={handleSubmit}
        disabled={loading}
        style={{ width: '100%', padding: '11px 0', fontSize: 15 }}
      >
        {loading ? 'Please wait…' : 'Send reset link'}
      </button>

      <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
        <a href="/auth/login" className="link">Back to sign in</a>
      </p>
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
