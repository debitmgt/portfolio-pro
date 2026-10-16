'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface RankingVideo {
  tier: 'large' | 'mid' | 'small'
  url: string
  month: string
}

// 'YYYY-MM' -> 'October 2026'
function monthLabel(month: string): string {
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December']
  const [y, m] = month.split('-')
  const idx = parseInt(m, 10) - 1
  return names[idx] ? `${names[idx]} ${y}` : month
}

const tierLabels = {
  large: 'Big Cap',
  mid: 'Mid Cap',
  small: 'Small Cap',
}

export default function RankingsVideoHero() {
  const [videos, setVideos] = useState<RankingVideo[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  // Starts muted: browsers block autoplay-with-sound, and it is a bad
  // surprise on a page nobody asked to make noise. React state so a click
  // can flip it.
  const [muted, setMuted] = useState(true)

  const toggleMuted = () => setMuted(m => !m)

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const res = await fetch('/api/rankings-videos')
        const data = await res.json()
        setVideos(data.videos || [])
      } catch (err) {
        console.error('Failed to fetch videos:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchVideos()
  }, [])

  // Brief real loading state while the fetch is in flight.
  if (loading) {
    return (
      <div style={{
        width: '100%',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '60px 24px',
        textAlign: 'center',
      }}>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Loading latest rankings...</p>
      </div>
    )
  }

  // No clips uploaded yet: render nothing rather than getting stuck on
  // "Loading..." forever. Once clips are in the monthly-videos bucket,
  // this section appears automatically.
  if (videos.length === 0) {
    return null
  }

  const currentVideo = videos[currentIndex]
  const tier = currentVideo.tier

  return (
    <div style={{
      width: '100%',
      background: '#000',
    }}>
      {/* Mobile tuning (Aug 13, 2026, kept): the box below keeps its 16:9
          shape via padding-bottom, which on a narrow phone works out to
          only ~190px tall. minHeight gives it a floor on small screens (no
          effect on desktop). The clips are vertical (1080x1920) and
          letterbox inside this box via objectFit: contain. */}
      <style>{`
        .rvh-video-box { min-height: 0; }
        @media (max-width: 480px) {
          .rvh-video-box { min-height: 320px; }
          .rvh-panel { padding: 16px !important; gap: 10px !important; }
          .rvh-tier-name { font-size: 17px !important; }
          .rvh-tier-desc { font-size: 12.5px !important; }
          .rvh-cta-button { padding: 10px 22px !important; font-size: 13px !important; }
        }
      `}</style>

      {/* The video is just a video (no overlay drawn on top of it); the
          label, tier dots and CTA live in the panel below it (Aug 16, 2026
          layout, kept). */}
      <div className="rvh-video-box" style={{
        position: 'relative',
        width: '100%',
        paddingBottom: '56.25%', // 16:9 box; the vertical clip letterboxes inside it
        background: '#000',
        overflow: 'hidden',
      }}>
        <video
          key={currentVideo.url}
          autoPlay
          muted={muted}
          loop={videos.length === 1}
          onEnded={() => setCurrentIndex(prev => (prev + 1) % videos.length)}
          playsInline
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        >
          <source src={currentVideo.url} type="video/mp4" />
        </video>

        {/* Mute/unmute toggle (kept). The clips are silent by design, but
            the button stays ready for any clip that carries audio. */}
        <button
          onClick={toggleMuted}
          aria-label={muted ? 'Unmute video' : 'Mute video'}
          aria-pressed={!muted}
          style={{
            position: 'absolute',
            bottom: 14,
            right: 14,
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'rgba(20,22,28,0.6)',
            border: '1px solid rgba(255,255,255,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            zIndex: 2,
          }}
        >
          {muted ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="#fff" stroke="none" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="#fff" stroke="none" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          )}
        </button>
      </div>

      <div className="rvh-panel" style={{
        width: '100%',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        textAlign: 'center',
      }}>
        <div className="rvh-tier-label" style={{
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--green)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          {monthLabel(currentVideo.month)} Rankings
        </div>

        <div>
          <div className="rvh-tier-name" style={{
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 4,
            letterSpacing: '-0.3px',
          }}>
            {tierLabels[tier]}
          </div>
          <div className="rvh-tier-desc" style={{
            fontSize: 14,
            color: 'var(--muted)',
          }}>
            Top 25 performers ranked by 1-year return
          </div>
        </div>

        {/* Tier indicators */}
        <div role="group" aria-label="Cap tier" style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'center',
        }}>
          {videos.map((video, idx) => (
            <button
              key={video.tier}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Show ${tierLabels[video.tier]} rankings`}
              aria-pressed={idx === currentIndex}
              title={tierLabels[video.tier]}
              style={{
                width: 24,
                height: 24,
                padding: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span aria-hidden="true" style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: idx === currentIndex ? 'var(--accent)' : 'rgba(255,255,255,0.4)',
                transition: 'background 0.3s ease',
              }} />
            </button>
          ))}
        </div>

        {/* CTA Button */}
        <Link href="/auth/login?plan=monthly" className="rvh-cta-button" style={{
          display: 'inline-block',
          background: 'var(--accent)',
          color: '#fff',
          padding: '12px 32px',
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 600,
          textDecoration: 'none',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          boxShadow: '0 4px 16px rgba(255,106,0,.3)',
        }}
        onMouseEnter={(e) => {
          const el = e.target as HTMLElement
          el.style.transform = 'translateY(-2px)'
          el.style.boxShadow = '0 6px 24px rgba(255,106,0,.4)'
        }}
        onMouseLeave={(e) => {
          const el = e.target as HTMLElement
          el.style.transform = 'translateY(0)'
          el.style.boxShadow = '0 4px 16px rgba(255,106,0,.3)'
        }}>
          Join Pro to See All Rankings
        </Link>
      </div>
    </div>
  )
}
