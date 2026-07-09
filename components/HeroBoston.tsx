// components/HeroBoston.tsx
// Full-viewport landing hero. Dark Boston-harbor skyline wallpaper (Zakim
// Bridge silhouette) extends the full first screen — this *is* the landing
// page. A left-to-right scrim keeps the headline column readable, plus a
// bottom scrim so the overlaid pricing bar stays legible regardless of how
// the skyline art shifts. The pricing bar sits pinned to the bottom edge of
// the wallpaper as the hand-off into page two (ticker, market news, plan
// detail) below.
import { PLANS, CHECKOUT_ENABLED } from '@/lib/stripe'

export default function HeroBoston() {
  return (
    <section
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        backgroundImage: 'url(/brand/hero-boston-skyline.svg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#14161c',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(100deg, rgba(20,22,28,0.95) 0%, rgba(20,22,28,0.88) 32%, rgba(20,22,28,0.4) 58%, rgba(20,22,28,0.08) 76%, rgba(20,22,28,0) 92%)',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(0deg, rgba(20,22,28,0.92) 0%, rgba(20,22,28,0.55) 18%, rgba(20,22,28,0) 40%)',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 1240,
          margin: '0 auto',
          padding: '32px 24px 48px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {/* Wordmark + sign in — top bar. Sign in was previously buried as a
            small text link far down the pricing page and users couldn't find
            it; it now sits up front, high-contrast, on every visit. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              fontSize: 'clamp(22px, 3vw, 28px)',
              fontWeight: 800,
              letterSpacing: '-0.5px',
              color: '#ffffff',
              textShadow: '0 1px 4px rgba(0,0,0,0.4)',
            }}
          >
            Ownfolio<span style={{ color: 'var(--accent)' }}>.net</span>
          </span>
          <a href="/auth/login">
            <button
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                padding: '11px 22px',
                fontSize: 14.5,
                fontWeight: 700,
                border: '1px solid rgba(255,255,255,0.55)',
                borderRadius: 4,
              }}
            >
              Sign in
            </button>
          </a>
        </div>

        {/* Headline + description + primary CTAs */}
        <div style={{ maxWidth: 520 }}>
          <h1
            style={{
              fontSize: 'clamp(30px, 4.5vw, 44px)',
              fontWeight: 800,
              letterSpacing: '-1px',
              lineHeight: 1.12,
              color: '#ffffff',
              marginBottom: 16,
              textShadow: '0 1px 4px rgba(0,0,0,0.35)',
            }}
          >
            Take charge of your investments
          </h1>
          <p
            style={{
              fontSize: 16.5,
              lineHeight: 1.6,
              color: 'rgba(255,255,255,0.86)',
              marginBottom: 14,
              textShadow: '0 1px 3px rgba(0,0,0,0.35)',
            }}
          >
            Ownfolio delivers real-time fundamentals, valuation, and portfolio analytics for buy-and-hold investors &mdash; impersonal, rules-based data on the companies you already own, with no trade signals and no personalized advice.
          </p>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: 'rgba(255,255,255,0.78)',
              marginBottom: 26,
              textShadow: '0 1px 3px rgba(0,0,0,0.35)',
            }}
          >
            Ownfolio is a portfolio-tracking product for self-directed, buy-and-hold investors. Users enter their own holdings and get pricing, gain/loss, public fundamentals, public news, and a monthly ranking newsletter &mdash; now three tiers (large-cap, mid-cap, small-cap) plus an optional editorial spotlight and a public archive.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <a href="/auth/login">
              <button
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  padding: '13px 24px',
                  fontSize: 15,
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 4,
                }}
              >
                Get started free
              </button>
            </a>
            <a href="#pricing-cards">
              <button
                style={{
                  background: 'transparent',
                  color: '#ffffff',
                  padding: '13px 24px',
                  fontSize: 15,
                  fontWeight: 700,
                  border: '1px solid rgba(255,255,255,0.5)',
                  borderRadius: 4,
                }}
              >
                See pricing
              </button>
            </a>
          </div>
        </div>

        {/* Pricing bar — overlaid on the bottom of the wallpaper, the hand-off
            into the ticker/news/plan-detail section (page two) below. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 32 }}>
          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.18)',
              backdropFilter: 'blur(6px)',
              borderRadius: 10,
              padding: '12px 16px',
            }}
          >
            <HeroPlanPill
              label={PLANS.free.name}
              sub="$0"
              href="/auth/login"
            />
            <HeroPlanPill
              label={PLANS.monthly.name}
              sub={`$${PLANS.monthly.price}/mo`}
              href={CHECKOUT_ENABLED ? '/auth/login?plan=monthly' : '#pricing-cards'}
              highlight
            />
            <HeroPlanPill
              label={PLANS.annual.name}
              sub={`$${PLANS.annual.price}/yr`}
              href={CHECKOUT_ENABLED ? '/auth/login?plan=annual' : '#pricing-cards'}
              badge="Save 27%"
            />
          </div>
          <a
            href="#pricing-cards"
            style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}
          >
            See full plan details ↓
          </a>
        </div>
      </div>
    </section>
  )
}

function HeroPlanPill({ label, sub, href, highlight, badge }: {
  label: string; sub: string; href: string; highlight?: boolean; badge?: string
}) {
  return (
    <a href={href} style={{ position: 'relative' }}>
      <div
        style={{
          minWidth: 120,
          textAlign: 'center',
          padding: '9px 16px',
          borderRadius: 6,
          background: highlight ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
          border: highlight ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.16)',
        }}
      >
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}>{label}</div>
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.85)' }}>{sub}</div>
      </div>
      {badge && (
        <span
          style={{
            position: 'absolute', top: -9, right: -6,
            background: 'var(--yellow)', color: '#fff',
            borderRadius: 3, padding: '2px 7px', fontSize: 10, fontWeight: 700,
          }}
        >
          {badge}
        </span>
      )}
    </a>
  )
}
