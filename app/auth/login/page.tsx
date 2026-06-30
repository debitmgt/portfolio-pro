'use client'

export const dynamic = 'force-dynamic'

import React, { useCallback, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import styles from './page.module.css'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function passwordStrength(pw: string) {
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++

  const labels = ['Very weak', 'Weak', 'Okay', 'Strong', 'Very strong']
  return { score, label: labels[score] || 'Very weak' }
}

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useSearchParams()
  const redirectTo = params.get('redirectTo') || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const strength = useMemo(() => passwordStrength(password), [password])

  const validate = useCallback(() => {
    let valid = true
    if (!EMAIL_REGEX.test(email)) {
      setEmailError('Please enter a valid email address')
      valid = false
    } else {
      setEmailError('')
    }

    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters')
      valid = false
    } else {
      setPasswordError('')
    }

    return valid
  }, [email, password])

  const handleOAuth = useCallback(
    async (provider: 'github' | 'google') => {
      setError('')
      setMessage('')
      setLoading(true)
      try {
        await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: `${location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
          },
        })
        setMessage(`Redirecting to ${provider} for authentication...`)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'OAuth sign-in failed')
      } finally {
        setLoading(false)
      }
    },
    [redirectTo, supabase]
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      setError('')
      setMessage('')

      // Run client-side validation before submitting
      if (!validate()) return

      setLoading(true)

      try {
        if (mode === 'signup') {
          const redirectUrl = `${location.origin}/auth/callback?redirectTo=${encodeURIComponent(
            redirectTo
          )}`
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: redirectUrl },
          })
          if (error) throw error
          setMessage('Check your email to confirm your account. Follow the link to continue.')
          setPassword('')
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email, password })
          if (error) throw error
          setPassword('')
          router.replace(redirectTo)
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      } finally {
        setLoading(false)
      }
    },
    [email, password, mode, redirectTo, router, supabase, validate]
  )

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.logo}>Portfolio Pro</h1>
        <p className={styles.sub}>{mode === 'login' ? 'Sign in to your account' : 'Create your account'}</p>

        {error && (
          <div className={styles.error} role="alert" aria-live="assertive">
            {error}
          </div>
        )}
        {message && (
          <div className={styles.success} role="status" aria-live="polite">
            {message}
          </div>
        )}

        <div className={styles.oauthRow}>
          <button
            type="button"
            className={styles.oauthBtn}
            onClick={() => handleOAuth('github')}
            disabled={loading}
          >
            Continue with GitHub
          </button>

          <button
            type="button"
            className={styles.oauthBtn}
            onClick={() => handleOAuth('google')}
            disabled={loading}
          >
            Continue with Google
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <label htmlFor="email" className={styles.label}>
            Email
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              onBlur={() => {
                if (!EMAIL_REGEX.test(email)) setEmailError('Please enter a valid email address')
                else setEmailError('')
              }}
              className={`${styles.input} ${emailError ? styles.inputError : ''}`}
              placeholder="you@example.com"
              disabled={loading}
              aria-invalid={!!emailError}
              aria-describedby={emailError ? 'email-error' : undefined}
            />
          </label>
          {emailError && (
            <div id="email-error" className={styles.fieldError} role="alert">
              {emailError}
            </div>
          )}

          <label htmlFor="password" className={styles.label}>
            Password
            <div className={styles.passwordRow}>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onBlur={() => {
                  if (password.length < 6) setPasswordError('Password must be at least 6 characters')
                  else setPasswordError('')
                }}
                className={`${styles.input} ${passwordError ? styles.inputError : ''}`}
                placeholder="••••••••"
                minLength={6}
                disabled={loading}
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? 'password-error' : undefined}
              />

              <button
                type="button"
                className={styles.togglePw}
                onClick={() => setShowPassword(s => !s)}
                aria-pressed={showPassword}
                disabled={loading}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>
          {passwordError && (
            <div id="password-error" className={styles.fieldError} role="alert">
              {passwordError}
            </div>
          )}

          <div className={styles.strengthRow} aria-hidden={false}>
            <div className={styles.strengthBar} data-score={strength.score} />
            <div className={styles.strengthLabel}>{strength.label}</div>
          </div>

          <button type="submit" disabled={loading} className={styles.btn} aria-busy={loading}>
            {loading ? 'Loading...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className={styles.toggle}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setError('')
              setMessage('')
              setEmailError('')
              setPasswordError('')
            }}
            className={styles.link}
            disabled={loading}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
