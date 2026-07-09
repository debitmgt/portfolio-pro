'use client'
// app/auth/login/page.tsx
export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Script from 'next/script'
import { createClient } from '@/lib/supabase/client'
import DisclaimerFooter from '@/components/DisclaimerFooter'

// Cloudflare Turnstile widget IDs are opaque strings returned by window.turnstile.render().
// The global `turnstile` object is injected by the script tag below, so it's typed loosely
// here rather than pulling in a separate .d.ts file for one small integration.
declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string
      reset: (widgetId?: string) => void
    }
  }
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

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

  // Bot protection (Supabase Auth + Cloudflare Turnstile) — gates signup, sign-in, and
  // password reset so free-tier email/db resources can't be burned by scripted signups.
  // Requires NEXT_PUBLIC_TURNSTILE_SITE_KEY to be set and CAPTCHA protection enabled with
  // the matching secret key in Supabase Dashboard → Authentication → Bot and Abuse Protection.
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
    if (mode === 'signup' && !acknowledged) {
      setError('Please confirm you understand Ownfolio LLC is data and analytics, not personalized advice, before creating an account.')
      return
    }
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError('Please complete the verification check below.')
      return
    }
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            captchaToken: captchaToken || undefined,
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
              plan ? `/api/stripe/checkout?plan=${plan}` : redirectTo
            )}`,
          },
        })
        if (error) throw error
        setSent(true)
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: { captchaToken: captchaToken || undefined },
        })
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
            We sent a confirmation link to <strong>{email}</strong>.<br />
            Click it to activate your account and get started.
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

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>Password</label>
        {mode === 'login' && (
          <a href="/auth/forgot-password" className="link" style={{ fontSize: 12.5 }}>
            Forgot password?
          </a>
        )}
      </div>
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
            I understand Ownfolio LLC provides data and analytics for self-directed, long-term investors —
            not personalized investment advice. See the{' '}
            <a href="/disclaimer" target="_blank" rel="noopener noreferrer" className="link" style={{ fontSize: 12.5 }}>
              full disclaimer
            </a>.
          </span>
        </label>
      )}

      {TURNSTILE_SITE_KEY && (
        <div ref={turnstileRef} style={{ marginBottom: 18, display: 'flex', justifyContent: 'center' }} />
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
