// components/NewsletterStatusPage.tsx
// Shared shell for the four simple confirm/unsubscribe landing pages.
import Link from 'next/link'

export function NewsletterStatusPage({ eyebrow, title, body, extraLink }: {
  eyebrow: string; title: string; body: string
  extraLink?: { href: string; label: string }
}) {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', padding: '48px 24px', display: 'flex', alignItems: 'center' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <p className="eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</p>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', margin: '0 0 12px' }}>{title}</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 24 }}>{body}</p>
        {extraLink && (
          <p style={{ marginBottom: 12 }}>
            <Link href={extraLink.href} className="link" style={{ fontSize: 13 }}>{extraLink.label}</Link>
          </p>
        )}
        <Link href="/" className="link" style={{ fontSize: 13 }}>← Back to Ownfolio LLC</Link>
      </div>
    </main>
  )
}
