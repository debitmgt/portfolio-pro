'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

interface RankingVideo {
  tier: 'large' | 'mid' | 'small'
  url: string
}

const tierLabels = {
  large: 'Large Cap ($10B+)',
  mid: 'Mid Cap ($2B-$10B)',
  small: 'Small Cap ($250M-$2B)',
}

export default function RankingsVideoHero() {
  const [videos, setVideos] = useState<RankingVideo[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  // Starts muted — browsers block autoplay-with-sound outright, and even
  // where it's technically allowed it's a bad surprise on a page nobody
  // asked to make noise. This is React state (not just the video's own
  // `muted` attribute) so a click can flip it, and so the choice survives
  // the video element remounting every time the carousel switches tiers
  // (see `key={currentVideo.url}` below).
  const [muted, setMuted] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)

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

  useEffect(() => {
    if (videos.length === 0) return

    // Cycle through videos every 8 seconds
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % videos.length)
    }, 8000)

    return () => clearInterval(interval)
  }, [videos.length])

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

  // No videos uploaded for the current month yet — render nothing rather
  // than getting stuck showing "Loading..." forever. Once at least one
  // month's videos are uploaded to the Supabase `monthly-videos` bucket,
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
          effect on desktop, where 16:9-of-width is already taller than
          this). */}
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

      {/* Fixed (Aug 16, 2026): this used to have a text/CTA layer absolutely
          positioned on top of the video (top label + centered tier name/
          description/"Join Pro" button + bottom dots). The rendered video
          already draws its own logo, header and — for roughly half of every
          clip — a centered white "chart card" popup with a ticker and
          return %. Because both layers centered their content, the "Join
          Pro" button and top label ended up stacked directly on top of
          whatever the video happened to be showing at that moment (e.g. a
          mid-animation ARWR chart card reading a transient -45.6% while the
          card behind it read +435.8%) — a confusing, broken-looking overlap.
          See RankingsVideoHero.tsx.bak-overlap for the old version.
          Fix: the video is now just a video (no overlay on top of it at
          all), and the tier name/description/CTA/dots live in a plain
          panel below it. Nothing is ever drawn on top of the video, so
          there's nothing left to collide with it. */}
      <div className="rvh-video-box" style={{
        position: 'relative',
        width: '100%',
        paddingBottom: '56.25%', // 16:9 ratio
        background: '#000',
        overflow: 'hidden',
      }}>
        <video
          ref={videoRef}
          key={currentVideo.url}
          autoPlay
          muted={muted}
          loop
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

        {/* Mute/unmute toggle. Not every clip has narration yet (older
            renders and any that failed ElevenLabs synthesis fall back to
            silent) — the button is always shown rather than trying to
            detect that, since clicking it on a silent clip is harmless. */}
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
          This Month's Rankings
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
          Join Pro to See All Product Features
        </Link>

        {/* Tier indicators */}
        <div style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'center',
        }}>
          {videos.map((video, idx) => (
            <div
              key={video.tier}
              onClick={() => setCurrentIndex(idx)}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: idx === currentIndex ? 'var(--accent)' : 'var(--border)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
              title={tierLabels[video.tier]}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
