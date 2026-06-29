'use client'
export const dynamic = 'force-dynamic'
export const dynamic = 'force-dynamic'
  export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/auth/callback?redirectTo=${redirectTo}` },
        })
        if (error) throw error
        setMessage('Check your email to confirm your account.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push(redirectTo)
        router.refresh()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.logo}>Portfolio Pro</h1>
        <p style={styles.sub}>{mode === 'login' ? 'Sign in to your account' : 'Create your account'}</p>

        {error && <div style={styles.error}>{error}</div>}
        {message && <div style={styles.success}>{message}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Email
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={styles.input}
              placeholder="you@example.com"
            />
          </label>
          <label style={styles.label}>Password
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={styles.input}
              placeholder="••••••••"
              minLength={6}
            />
          </label>
          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? 'Loading…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p style={styles.toggle}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} style={styles.link}>
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: 'var(--bg)',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 32,
  },
  logo: {
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--accent)',
    marginBottom: 4,
  },
  sub: {
    color: 'var(--muted)',
    marginBottom: 24,
    fontSize: 14,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 14,
    fontWeight: 500,
  },
  input: {
    width: '100%',
  },
  btn: {
    marginTop: 8,
    padding: '10px 16px',
    background: 'var(--accent-dim)',
    color: '#fff',
    borderRadius: 6,
    fontWeight: 600,
    fontSize: 15,
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  error: {
    background: '#2a1215',
    border: '1px solid var(--red)',
    color: 'var(--red)',
    borderRadius: 6,
    padding: '10px 14px',
    fontSize: 14,
    marginBottom: 16,
  },
  success: {
    background: '#0d2119',
    border: '1px solid var(--green)',
    color: 'var(--green)',
    borderRadius: 6,
    padding: '10px 14px',
    fontSize: 14,
    marginBottom: 16,
  },
  toggle: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 14,
    color: 'var(--muted)',
  },
  link: {
    color: 'var(--accent)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    padding: 0,
  },
}


