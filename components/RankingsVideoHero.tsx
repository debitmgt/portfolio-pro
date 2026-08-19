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
      position: 'relative',
      background: '#000',
      overflow: 'hidden',
    }}>
      {/* Mobile tuning (Aug 13, 2026): the box below keeps its 16:9 shape via
          padding-bottom, which on a narrow phone works out to only ~190px
          tall — too short for the title/description/button/dots to fit
          comfortably. minHeight gives it a floor on small screens (no effect
          on desktop, where 16:9-of-width is already taller than this). The
          rvh-overlay class also shrinks padding/gaps/font sizes below 480px
          so the text has room to breathe instead of feeling crammed. */}
      <style>{`
        .rvh-video-box { min-height: 0; }
        @media (max-width: 480px) {
          .rvh-video-box { min-height: 320px; }
          .rvh-overlay { padding: 14px !important; }
          .rvh-tier-label { margin-bottom: 4px !important; }
          .rvh-tier-name { font-size: 17px !important; }
          .rvh-tier-desc { font-size: 12.5px !important; margin-bottom: 12px !important; }
          .rvh-cta-button { padding: 10px 22px !important; font-size: 13px !important; }
        }
      `}</style>
      {/* Video container with aspect ratio */}
      <div className="rvh-video-box" style={{
        position: 'relative',
        width: '100%',
        paddingBottom: '56.25%', // 16:9 ratio
        background: '#000',
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

        {/* Overlay gradient and text */}
        <div className="rvh-overlay" style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,.2) 0%, transparent 40%, transparent 60%, rgba(0,0,0,.6) 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '24px',
          alignItems: 'center',
        }}>
          {/* Top: Tier label with transition */}
          <div style={{
            opacity: 1,
            transition: 'opacity 0.6s ease-in-out',
            textAlign: 'center',
          }}>
            <div className="rvh-tier-label" style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--green)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              This Month's Rankings
            </div>
          </div>

          {/* Center: Main CTA with tier info */}
          <div style={{
            textAlign: 'center',
          }}>
            <div className="rvh-tier-name" style={{
              fontSize: 20,
              fontWeight: 700,
              color: '#fff',
              marginBottom: 4,
              letterSpacing: '-0.3px',
            }}>
              {tierLabels[tier]}
            </div>
            <div className="rvh-tier-desc" style={{
              fontSize: 14,
              color: 'rgba(255,255,255,0.8)',
              marginBottom: 20,
            }}>
              Top 25 performers ranked by 1-year return
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
          </div>

          {/* Bottom: Tier indicators */}
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
                  background: idx === currentIndex ? 'var(--accent)' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                title={tierLabels[video.tier]}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
