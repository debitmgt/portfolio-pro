// components/HeroBoston.tsx
// Full-bleed hero banner for the homepage/pricing page. Dark Boston-harbor
// skyline background (Zakim Bridge silhouette) with a left-to-right scrim so
// the headline stays readable regardless of how the underlying art shifts —
// the scrim is near-opaque behind the text column and fades out toward the
// skyline on the right, rather than relying on the image alone for contrast.
export default function HeroBoston() {
  return (
    <section
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 'clamp(320px, 42vw, 420px)',
        backgroundImage: 'url(/brand/hero-boston-skyline.svg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#14161c',
        display: 'flex',
        alignItems: 'center',
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
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 1240,
          margin: '0 auto',
          padding: '0 24px',
        }}
      >
        <div style={{ maxWidth: 480 }}>
          <h1
            style={{
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: 800,
              letterSpacing: '-1px',
              lineHeight: 1.15,
              color: '#ffffff',
              marginBottom: 14,
              textShadow: '0 1px 4px rgba(0,0,0,0.35)',
            }}
          >
            Take ownership of your future
          </h1>
          <p
            style={{
              fontSize: 16.5,
              lineHeight: 1.6,
              color: 'rgba(255,255,255,0.86)',
              marginBottom: 26,
              textShadow: '0 1px 3px rgba(0,0,0,0.35)',
            }}
          >
            Real-time data and analytics for people who buy and hold quality companies &mdash; not a trading signal, not a recommendation.
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
      </div>
    </section>
  )
}
