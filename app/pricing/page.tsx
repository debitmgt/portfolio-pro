import Link from 'next/link'

export default function PricingPage() {
  const features = {
    free: ['Up to 3 holdings', 'Live prices', 'Basic tracker', 'Stop-loss view'],
    pro: [
      'Unlimited holdings',
      'Live prices',
      'Full tracker',
      'Daily Ranking',
      'Signals',
      'Optimizer',
      'Strategy / Kelly',
      'Charts',
      'Fundamentals',
      'Stop-loss Manager',
      'Save & load portfolio',
    ],
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <Link href="/" style={s.logo}>Portfolio Pro</Link>
        <Link href="/auth/login" style={s.loginLink}>Sign in</Link>
      </header>

      <main style={s.main}>
        <h1 style={s.headline}>Simple, transparent pricing</h1>
        <p style={s.sub}>Start free. Upgrade when you're ready.</p>

        <div style={s.grid}>
          {/* Free */}
          <div style={s.card}>
            <div style={s.planName}>Free</div>
            <div style={s.price}>$0<span style={s.per}>/forever</span></div>
            <Link href="/auth/login" style={s.btnGhost}>Get started free</Link>
            <ul style={s.features}>
              {features.free.map(f => (
                <li key={f} style={s.feature}><span style={s.check}>✓</span>{f}</li>
              ))}
            </ul>
          </div>

          {/* Pro */}
          <div style={{ ...s.card, border: '1px solid var(--accent-dim)' }}>
            <div style={s.proBadge}>MOST POPULAR</div>
            <div style={s.planName}>Pro</div>
            <div style={s.price}>
              $9<span style={s.per}>/mo</span>
              <span style={s.annual}> or $79/yr (save 27%)</span>
            </div>
            <Link href="/auth/login?redirectTo=/dashboard" style={s.btnPrimary}>Start with Pro</Link>
            <ul style={s.features}>
              {features.pro.map(f => (
                <li key={f} style={s.feature}><span style={s.checkPro}>✓</span>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: 'var(--bg)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', borderBottom: '1px solid var(--border)' },
  logo: { fontWeight: 700, fontSize: 18, color: 'var(--accent)', textDecoration: 'none' },
  loginLink: { color: 'var(--muted)', fontSize: 14 },
  main: { maxWidth: 900, margin: '0 auto', padding: '64px 24px', textAlign: 'center' },
  headline: { fontSize: 40, fontWeight: 800, marginBottom: 12 },
  sub: { color: 'var(--muted)', fontSize: 18, marginBottom: 48 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, textAlign: 'left' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 32, position: 'relative' },
  proBadge: {
    position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
    background: 'var(--accent-dim)', color: '#fff', fontSize: 11, fontWeight: 700,
    letterSpacing: '0.08em', borderRadius: 20, padding: '3px 12px',
  },
  planName: { fontSize: 14, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 },
  price: { fontSize: 36, fontWeight: 800, marginBottom: 24 },
  per: { fontSize: 16, fontWeight: 400, color: 'var(--muted)' },
  annual: { display: 'block', fontSize: 13, color: 'var(--muted)', fontWeight: 400, marginTop: 4 },
  btnPrimary: {
    display: 'block', textAlign: 'center', padding: '12px 0',
    background: 'var(--accent-dim)', color: '#fff', borderRadius: 8,
    fontWeight: 600, fontSize: 15, textDecoration: 'none', marginBottom: 24,
  },
  btnGhost: {
    display: 'block', textAlign: 'center', padding: '11px 0',
    border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8,
    fontWeight: 600, fontSize: 15, textDecoration: 'none', marginBottom: 24,
  },
  features: { listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 },
  feature: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 },
  check: { color: 'var(--green)', fontWeight: 700, flexShrink: 0 },
  checkPro: { color: 'var(--accent)', fontWeight: 700, flexShrink: 0 },
}
