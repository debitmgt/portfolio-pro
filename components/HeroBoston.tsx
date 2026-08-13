// components/HeroBoston.tsx
// Full-viewport landing hero. Dark Boston-harbor skyline wallpaper (Zakim
// Bridge silhouette) extends the full first screen — this *is* the landing
// page. A left-to-right scrim keeps the center column readable, plus a
// bottom scrim so the overlaid pricing bar stays legible regardless of how
// the skyline art shifts. The pricing bar sits pinned to the bottom edge of
// the wallpaper as the hand-off into page two (ticker, market news, plan
// detail) below.
//
// Layout per attorney letter (Keidi Carrington, Esq., 2026-07-09, item 4):
// the business name "Ownfolio.net" runs large type in the middle of the
// black banner, with the tagline "Take Charge of Your Investments" in
// smaller type directly under it. The business-summary paragraph that used
// to live here moved to the white section of the pricing page, before any
// pricing information (also per that letter).
//
// This stays a server component so it can safely import PLANS/CHECKOUT_ENABLED
// from '@/lib/stripe' (which touches the Stripe secret key server-side). The
// animated headline/stats/chart live in HeroBostonAnimated, a separate client
// component with no Stripe import, so that code never ends up in the browser
// bundle.
import { cookies } from 'next/headers'
import { PLANS, CHECKOUT_ENABLED } from '@/lib/stripe'
import HeroBostonAnimated from './HeroBostonAnimated'

export default async function HeroBoston() {
  const cookieStore = await cookies()
  const variant = cookieStore.get('ab_variant')?.value === 'b' ? 'b' : 'a'

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

      {/* Small demo video window removed (Aug 13, 2026) — the monthly
          rankings video carousel (RankingsVideoHero) now covers this on
          the page, right below the hero, so this redundant /demo.mp4
          window was taken out to avoid showing two video inserts. */}

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
        {/* Sign in — top bar. Previously buried as a small text link far down
            the pricing page and users couldn't find it; it now sits up
            front, high-contrast, on every visit. Wordmark moved out of this
            bar and into the centered block below, per the attorney letter. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <a href="/auth/login">
            <span
              style={{
                display: 'inline-block', background: 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                padding: '11px 22px',
                fontSize: 14.5,
                fontWeight: 700,
                border: '1px solid rgba(255,255,255,0.55)',
                borderRadius: 4,
              }}
            >
              Sign in
            </span>
          </a>
        </div>

        {/* Business name + tagline + stats + CTA — animated, client-side. */}
        <HeroBostonAnimated variant={variant} />

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
              href="/auth/login?mode=signup"
            />
            <HeroPlanPill
              label={PLANS.monthly.name}
              sub={`$${PLANS.monthly.price}/mo`}
              href={CHECKOUT_ENABLED ? '/auth/login?plan=monthly' : '#page-two'}
              highlight
            />
            <HeroPlanPill
              label={PLANS.annual.name}
              sub={`$${PLANS.annual.price}/yr`}
              href={CHECKOUT_ENABLED ? '/auth/login?plan=annual' : '#page-two'}
              badge="Save 16%"
            />
          </div>
          <a
            href="#page-two"
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
        <div style={{ fontSize: 12.5, fontWeight: 700, color: highlight ? 'var(--on-accent)' : '#fff' }}>{label}</div>
        <div style={{ fontSize: 11.5, color: highlight ? 'rgba(20,22,28,0.9)' : 'rgba(255,255,255,0.85)' }}>{sub}</div>
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
