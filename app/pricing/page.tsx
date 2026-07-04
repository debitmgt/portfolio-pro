// app/pricing/page.tsx
import Link from 'next/link'
import { PLANS } from '@/lib/stripe'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import MarketTicker from '@/components/MarketTicker'
import MarketNewsFeed from '@/components/MarketNewsFeed'
import NewsletterSignupForm from '@/components/NewsletterSignupForm'

export default function PricingPage() {
  return (
    <main style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      background: 'var(--bg)',
    }}>
      <MarketTicker />
      <div style={{
        width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '48px 24px', flex: 1,
      }}>
      <div style={{ textAlign: 'center', marginBottom: 52 }}>
        <div style={{
          width: 44, height: 44, background: 'var(--accent)', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: 22, margin: '0 auto 16px',
        }}>O</div>
        <h1 style={{ fontSize: 40, fontWeight: 800, marginBottom: 10, letterSpacing: '-1px' }}>Ownfolio</h1>
        <p style={{ color: 'var(--muted)', fontSize: 17 }}>
          Real-time data for long-term owners.
        </p>
      </div>

      <div style={{
        display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center',
        maxWidth: 720, marginBottom: 52, textAlign: 'left',
      }}>
        <div style={{ flex: '1 1 300px', minWidth: 260 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            What Ownfolio is
          </div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              'A near-real-time data and analytics tool for people who buy and hold quality companies.',
              'A way to see fundamentals, valuation, and portfolio composition clearly, without noise.',
              'Transparent about method — every number traces to a disclosed, checkable rule.',
            ].map(item => (
              <li key={item} style={{ fontSize: 13.5, color: 'var(--muted)', display: 'flex', alignItems: 'flex-start', gap: 8, lineHeight: 1.5 }}>
                <span style={{ color: 'var(--green)', marginTop: 1, flexShrink: 0 }}>✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ flex: '1 1 300px', minWidth: 260 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            What Ownfolio is not
          </div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              'Not a financial adviser, broker, or money manager — no personalized recommendations, ever.',
              'Not a trade-timing or trading-signal service.',
              'Not built around exit timing, position sizing formulas, or short-term ranking.',
            ].map(item => (
              <li key={item} style={{ fontSize: 13.5, color: 'var(--muted)', display: 'flex', alignItems: 'flex-start', gap: 8, lineHeight: 1.5 }}>
                <span style={{ color: 'var(--red)', marginTop: 1, flexShrink: 0 }}>✕</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1000 }}>
        <PricingCard
          name={PLANS.free.name}
          price="$0"
          period="forever"
          features={PLANS.free.features}
          cta="Get started free"
          ctaHref="/auth/login"
          highlight={false}
        />
        <PricingCard
          name={PLANS.monthly.name}
          price={`$${PLANS.monthly.price}`}
          period="/ month"
          features={PLANS.monthly.features}
          cta="Start Pro Monthly"
          ctaHref="/auth/login?plan=monthly"
          highlight
        />
        <PricingCard
          name={PLANS.annual.name}
          price={`$${PLANS.annual.price}`}
          period="/ year"
          features={PLANS.annual.features}
          cta="Start Pro Annual"
          ctaHref="/auth/login?plan=annual"
          highlight={false}
          badge="Save 27%"
        />
      </div>

      <p style={{ marginTop: 44, color: 'var(--muted)', fontSize: 13 }}>
        Already have an account?{' '}
        <Link href="/auth/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in</Link>
      </p>

      <p style={{ marginTop: 12, color: 'var(--muted)', fontSize: 12, opacity: 0.6 }}>
        Powered by Stripe · Cancel anytime · No hidden fees
      </p>

      <div style={{ marginTop: 48, paddingTop: 40, borderTop: '1px solid var(--border)', width: '100%', display: 'flex', justifyContent: 'center' }}>
        <MarketNewsFeed />
      </div>

      <div id="newsletter" style={{ marginTop: 8, paddingTop: 40, borderTop: '1px solid var(--border)', width: '100%', display: 'flex', justifyContent: 'center' }}>
        <NewsletterSignupForm />
      </div>

      <div style={{ marginTop: 32, maxWidth: 560 }}>
        <DisclaimerFooter />
      </div>
      </div>
    </main>
  )
}

function PricingCard({ name, price, period, features, cta, ctaHref, highlight, badge }: {
  name: string; price: string; period: string; features: readonly string[]
  cta: string; ctaHref: string; highlight: boolean; badge?: string
}) {
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${highlight ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 6,
      padding: '32px 28px',
      width: 300,
      position: 'relative',
      boxShadow: highlight ? '0 8px 28px rgba(255,106,0,.12)' : 'none',
    }}>
      {badge && (
        <span style={{
          position: 'absolute', top: -13, right: 18,
          background: 'var(--yellow)', color: '#fff',
          borderRadius: 3, padding: '3px 12px', fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
        }}>{badge}</span>
      )}
      {highlight && (
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '1px', marginBottom: 8, textTransform: 'uppercase' }}>
          Most Popular
        </div>
      )}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{name}</h2>
      <div style={{ fontSize: 38, fontWeight: 800, marginBottom: 4, letterSpacing: '-1px' }}>
        {price}
        <span style={{ fontSize: 15, color: 'var(--muted)', fontWeight: 400, letterSpacing: 0 }}> {period}</span>
      </div>
      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '22px 0' }} />
      <ul style={{ listStyle: 'none', marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {features.map(f => (
          <li key={f} style={{ fontSize: 14, color: 'var(--muted)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ color: 'var(--green)', marginTop: 1, flexShrink: 0 }}>✓</span>
            {f}
          </li>
        ))}
      </ul>
      <Link href={ctaHref}>
        <button
          className={highlight ? 'btn-primary' : 'btn-outline'}
          style={{ width: '100%', padding: '12px 0', fontSize: 15, fontWeight: 600 }}
        >{cta}</button>
      </Link>
    </div>
  )
}
