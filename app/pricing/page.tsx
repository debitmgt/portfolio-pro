// app/pricing/page.tsx
import Link from 'next/link'
import { PLANS, CHECKOUT_ENABLED } from '@/lib/stripe'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import MarketTicker from '@/components/MarketTicker'
import MarketNewsFeed from '@/components/MarketNewsFeed'
import NewsletterSignupForm from '@/components/NewsletterSignupForm'
import HeroBoston from '@/components/HeroBoston'

export default function PricingPage({ searchParams }: { searchParams?: { paused?: string } }) {
  return (
    <main style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      background: 'var(--bg)',
    }}>
      <HeroBoston />
      {/* Anchor for the hero's pricing-bar links — they should hand off to
          the top of page two (the ticker), not jump past it into the pricing
          card grid further down. */}
      <div id="page-two" style={{ width: '100%' }}>
        <MarketTicker />
      </div>

      {/* Two-column layout: news feed occupies the left third on wide screens
          (sticky, so it stays in view and keeps drawing the eye as an
          anonymous visitor scrolls) and stacks above the main content on
          narrow screens via flex-wrap. */}
      <div style={{
        width: '100%', maxWidth: 1240, margin: '0 auto', padding: '48px 24px',
        display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'flex-start', flex: 1,
      }}>
        <div style={{ flex: '1 1 320px', minWidth: 280 }}>
          <div style={{ position: 'sticky', top: 24 }}>
            <MarketNewsFeed />
          </div>
        </div>

        <div style={{
          flex: '2 1 480px', minWidth: 320,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          {/* Business summary — attorney-mandated copy (Keidi Carrington, Esq.,
              2026-07-09, item 4), placed in the white section before any
              pricing information. Do not paraphrase. */}
          <div style={{ maxWidth: 640, marginBottom: 44, textAlign: 'left' }}>
            <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.3px', marginBottom: 12, color: 'var(--text)' }}>
              Ownfolio: Impersonal portfolio tracking for long-term investors
            </h2>
            <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 12 }}>
              Ownfolio (signalfolio.net / ownfolio.net) lets self-directed, buy-and-hold investors track their portfolios with clear, rules-based data. You enter your own holdings and see pricing, gain/loss, public fundamentals, and public news presented in a standardized, historical format.
            </p>
            <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 12 }}>
              Each month, subscribers receive a general-circulation ranking newsletter featuring three cap tiers (large, mid, and small), plus an optional editorial spotlight and a public archive of past issues. The same methodology applies to every listed security and every subscriber — the content is impersonal and not tailored to any individual.
            </p>
            <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7 }}>
              Ownfolio does not execute trades, hold customer funds or securities, accept discretionary authority, or provide personalized investment advice. The product is a business and financial publication for informational and educational purposes only, intended for investors who make their own decisions.
            </p>
          </div>

          {searchParams?.paused === '1' && (
            <div style={{
              maxWidth: 480, marginBottom: 28, padding: '12px 18px', borderRadius: 6,
              background: 'var(--surface)', border: '1px solid var(--border)', textAlign: 'center',
            }}>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                Pro sign-ups are temporarily paused — check back soon.
              </p>
            </div>
          )}

          <div style={{
            display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center',
            maxWidth: 720, marginBottom: 52, textAlign: 'left',
          }}>
            <div style={{ flex: '1 1 300px', minWidth: 260 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                What Ownfolio LLC is
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
                What Ownfolio LLC is not
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

          {/* Pricing cards — sized to fit three across in this narrower main
              column (next to the sticky news feed) instead of the full page
              width, per Dwight's request to keep them directly under the
              what-is/what-is-not panel. */}
          <div id="pricing-cards" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
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
              cta={CHECKOUT_ENABLED ? 'Start Pro Monthly' : 'Coming soon'}
              ctaHref="/auth/login?plan=monthly"
              highlight
              disabled={!CHECKOUT_ENABLED}
            />
            <PricingCard
              name={PLANS.annual.name}
              price={`$${PLANS.annual.price}`}
              period="/ year"
              features={PLANS.annual.features}
              cta={CHECKOUT_ENABLED ? 'Start Pro Annual' : 'Coming soon'}
              ctaHref="/auth/login?plan=annual"
              highlight={false}
              badge="Save 27%"
              disabled={!CHECKOUT_ENABLED}
            />
          </div>
        </div>
      </div>

      {/* Full-width footer block — centered on the whole page rather than
          nested in the two-column layout above, so it isn't offset by the
          sticky news feed sidebar. */}
      <div style={{
        width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', padding: '0 24px 48px',
      }}>
        <p style={{ marginTop: 44, color: 'var(--muted)', fontSize: 13 }}>
          Already have an account?{' '}
          <Link href="/auth/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in</Link>
        </p>

        <p style={{ marginTop: 12, color: 'var(--muted)', fontSize: 12, opacity: 0.6 }}>
          Powered by Stripe · Cancel anytime · No hidden fees
        </p>

        <div id="newsletter" style={{ marginTop: 48, paddingTop: 40, borderTop: '1px solid var(--border)', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <NewsletterSignupForm />
        </div>

        <div style={{ marginTop: 32, maxWidth: 560 }}>
          <DisclaimerFooter />
        </div>
      </div>
    </main>
  )
}

function PricingCard({ name, price, period, features, cta, ctaHref, highlight, badge, disabled }: {
  name: string; price: string; period: string; features: readonly string[]
  cta: string; ctaHref: string; highlight: boolean; badge?: string; disabled?: boolean
}) {
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${highlight ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 6,
      padding: '22px 18px',
      width: 216,
      position: 'relative',
      boxShadow: highlight ? '0 8px 28px rgba(255,106,0,.12)' : 'none',
    }}>
      {badge && (
        <span style={{
          position: 'absolute', top: -11, right: 12,
          background: 'var(--yellow)', color: '#fff',
          borderRadius: 3, padding: '2px 9px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.02em',
        }}>{badge}</span>
      )}
      {highlight && (
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', letterSpacing: '1px', marginBottom: 6, textTransform: 'uppercase' }}>
          Most Popular
        </div>
      )}
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{name}</h2>
      <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 4, letterSpacing: '-1px' }}>
        {price}
        <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400, letterSpacing: 0 }}> {period}</span>
      </div>
      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '14px 0' }} />
      <ul style={{ listStyle: 'none', marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {features.map(f => (
          <li key={f} style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <span style={{ color: 'var(--green)', marginTop: 1, flexShrink: 0 }}>✓</span>
            {f}
          </li>
        ))}
      </ul>
      {disabled ? (
        <button
          disabled
          className="btn-outline"
          style={{ width: '100%', padding: '10px 0', fontSize: 13, fontWeight: 600, opacity: 0.5, cursor: 'not-allowed' }}
        >{cta}</button>
      ) : (
        <Link href={ctaHref}>
          <button
            className={highlight ? 'btn-primary' : 'btn-outline'}
            style={{ width: '100%', padding: '10px 0', fontSize: 13, fontWeight: 600 }}
          >{cta}</button>
        </Link>
      )}
    </div>
  )
}
