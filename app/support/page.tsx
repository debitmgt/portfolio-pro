// app/support/page.tsx
import Link from 'next/link'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import SupportContactForm from '@/components/SupportContactForm'

export const metadata = {
  title: 'Support — Ownfolio',
}

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: 'Is Ownfolio giving me investment advice?',
    a: (
      <>
        No. Ownfolio publishes data, analytics, and commentary for informational and educational
        purposes only — the same content, on the same basis, to every user. It&apos;s not personalized
        advice, and using the site doesn&apos;t create an advisory relationship. See the{' '}
        <Link href="/disclaimer" className="link">full disclaimer</Link> for details.
      </>
    ),
  },
  {
    q: 'How do I reset my password?',
    a: (
      <>
        Go to the <Link href="/auth/forgot-password" className="link">Forgot password</Link> page and
        enter your account email. A reset link is sent within a few minutes — check spam if it doesn&apos;t
        show up.
      </>
    ),
  },
  {
    q: 'How do I cancel or change my subscription?',
    a: 'From your dashboard, click "Manage billing." That opens Stripe’s secure billing portal, where you can update your card, change plans, or cancel — no need to email us, and cancellation takes effect immediately in the portal.',
  },
  {
    q: 'How often is the data updated?',
    a: 'Fundamentals for anything in your portfolio refresh daily. The broad-market Top 25 rankings and the monthly newsletter are recomputed once a month. None of it is real-time intraday data.',
  },
  {
    q: "Why don't I see a stock I'm tracking in the monthly rankings?",
    a: 'The monthly Top 25 rankings are drawn from a fixed, curated universe of roughly 100 liquid US stocks spanning large-, mid-, and small-cap names — not every ticker on the market. Anything you personally hold still gets its own fundamentals scored daily, regardless of whether it’s in that universe.',
  },
  {
    q: 'How do I unsubscribe from the newsletter?',
    a: 'Every issue has an unsubscribe link at the bottom — one click, no login required.',
  },
  {
    q: "Something looks wrong with my data or a chart.",
    a: 'Send us a note below with the symbol or page involved and what you’re seeing. Market data can occasionally be delayed or incomplete at the source — we’ll look into it either way.',
  },
]

export default function SupportPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', padding: '48px 24px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <Link href="/pricing" className="link" style={{ fontSize: 13 }}>← Back to Ownfolio</Link>

        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', margin: '20px 0 6px' }}>
          Support
        </h1>
        <p className="eyebrow" style={{ marginBottom: 28 }}>
          Answers to common questions, or send us a message directly
        </p>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '8px 28px', marginBottom: 40,
        }}>
          {FAQ.map((item, i) => (
            <div key={i} style={{
              padding: '20px 0',
              borderTop: i === 0 ? 'none' : '1px solid var(--border)',
            }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
                {item.q}
              </h2>
              <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7 }}>
                {item.a}
              </p>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px', margin: '0 0 14px' }}>
          Still need help?
        </h2>
        <div style={{ position: 'relative' }}>
          <SupportContactForm />
        </div>

        <div style={{ marginTop: 24 }}>
          <DisclaimerFooter />
        </div>
      </div>
    </main>
  )
}
