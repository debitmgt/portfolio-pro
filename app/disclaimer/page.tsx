// app/disclaimer/page.tsx
import Link from 'next/link'
import { DISCLAIMER_FULL } from '@/lib/disclaimer'

export const metadata = {
  title: 'Disclaimer — Ownfolio LLC',
}

export default function DisclaimerPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', padding: '48px 24px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <Link href="/pricing" className="link" style={{ fontSize: 13 }}>← Back to Ownfolio LLC</Link>

        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', margin: '20px 0 6px' }}>
          Disclaimer
        </h1>
        <p className="eyebrow" style={{ marginBottom: 28 }}>
          Informational purposes only — not financial advice
        </p>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '28px 28px', display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {DISCLAIMER_FULL.map((p, i) => (
            <p key={i} style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>{p}</p>
          ))}
        </div>

        <p style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 20 }}>
          Questions about this disclaimer or how Ownfolio LLC works? Contact us before relying on any
          data from the site for a real investment decision.
        </p>
      </div>
    </main>
  )
}
