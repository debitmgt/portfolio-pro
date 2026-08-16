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
  const videoRef = useRef<HTMLVideoElement>(null)

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
          muted
          loop
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
          Join Pro to See All Rankings
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
