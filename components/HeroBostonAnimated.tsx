// components/HeroBostonAnimated.tsx
// Client-only piece of the hero: the fade/slide-in headline, animated stat
// counters, and the self-drawing chart. Deliberately has NO import from
// '@/lib/stripe' or any other server-only module — this file ships to the
// browser, so pulling in the Stripe SDK here would try to initialize it
// client-side (where there's no secret key) and crash the page. Plan
// name/price data the parent needs for the pricing bar stays in the server
// component (HeroBoston.tsx) instead.
'use client'

import { useEffect, useRef, useState } from 'react'
import { track } from '@vercel/analytics'

export default function HeroBostonAnimated({ variant }: { variant: 'a' | 'b' }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    track('variant_seen', { variant, page: 'hero' })
  }, [variant])

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
      <h1
        style={{
          fontSize: 'clamp(44px, 9vw, 88px)',
          fontWeight: 800,
          letterSpacing: '-1.5px',
          lineHeight: 1.05,
          color: '#ffffff',
          marginBottom: 14,
          textShadow: '0 1px 6px rgba(0,0,0,0.4)',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(14px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        Ownfolio<span style={{ color: 'var(--accent)' }}>.net</span>
      </h1>
      <p
        style={{
          fontSize: 'clamp(16px, 2.2vw, 22px)',
          fontWeight: 600,
          letterSpacing: '-0.2px',
          color: 'rgba(255,255,255,0.9)',
          marginBottom: 28,
          textShadow: '0 1px 3px rgba(0,0,0,0.35)',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(14px)',
          transition: 'opacity 0.6s ease 0.12s, transform 0.6s ease 0.12s',
        }}
      >
        {variant === 'b' ? 'Know Exactly What You Own' : 'Take Charge of Your Investments'}
      </p>

      {/* Stat row + chart — real product facts, no user-count claims. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 32,
          flexWrap: 'wrap',
          marginBottom: 28,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(14px)',
          transition: 'opacity 0.6s ease 0.24s, transform 0.6s ease 0.24s',
        }}
      >
        <StatCounter value={10} label="Holdings tracked free" />
        <StatCounter value={6} label="Fundamentals categories" />
        <StatCounter value={3} label="Cap tiers ranked monthly" />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 28,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(14px)',
          transition: 'opacity 0.6s ease 0.3s, transform 0.6s ease 0.3s',
        }}
      >
        <MiniChart animate={mounted} />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 14,
          flexWrap: 'wrap',
          justifyContent: 'center',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(14px)',
          transition: 'opacity 0.6s ease 0.36s, transform 0.6s ease 0.36s',
        }}
      >
        <a href="/auth/login?mode=signup" onClick={() => track('signup_clicked', { variant, source: 'hero' })}>
          <span
            style={{
              display: 'inline-block',
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              padding: '13px 24px',
              fontSize: 15,
              fontWeight: 700,
              border: 'none',
              borderRadius: 4,
            }}
          >
            Take control — start free
          </span>
        </a>
      </div>
    </div>
  )
}

// Counts up from 0 to `value` once, on mount. Purely visual — the number
// itself is a static product fact, not live data.
function StatCounter({ value, label }: { value: number; label: string }) {
  const [display, setDisplay] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const durationMs = 900
    const startTime = performance.now()

    function tick(now: number) {
      const progress = Math.min((now - startTime) / durationMs, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * value))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value])

  return (
    <div style={{ textAlign: 'center', minWidth: 92 }}>
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: '#ffffff',
          letterSpacing: '-0.5px',
          fontFeatureSettings: '"tnum" 1, "lnum" 1',
        }}
      >
        {display}
      </div>
      <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginTop: 2 }}>
        {label}
      </div>
    </div>
  )
}

// Small self-drawing line chart — an ambient nod to the product's data focus,
// not a claim about any specific security or return.
function MiniChart({ animate }: { animate: boolean }) {
  const points = [
    [0, 96], [40, 82], [80, 90], [120, 58], [160, 68], [200, 34], [240, 46], [280, 12],
  ]
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')
  // Approx path length for the dash animation (measured for this point set).
  const pathLength = 320

  return (
    <svg
      width="280"
      height="110"
      viewBox="0 0 280 110"
      fill="none"
      aria-hidden="true"
      style={{ overflow: 'visible', maxWidth: '100%' }}
    >
      <path
        d={path}
        stroke="var(--accent)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: pathLength,
          strokeDashoffset: animate ? 0 : pathLength,
          transition: 'stroke-dashoffset 1.3s ease 0.3s',
        }}
      />
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r="6"
        fill="var(--accent)"
        style={{
          opacity: animate ? 1 : 0,
          transition: 'opacity 0.3s ease 1.5s',
        }}
      />
    </svg>
  )
}
