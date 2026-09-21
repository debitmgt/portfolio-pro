'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface RankingVideo {
  url: string
  month: string
}

// 'YYYY-MM' -> 'September 2026'
function monthLabel(month: string): string {
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December']
  const [y, m] = month.split('-')
  const idx = parseInt(m, 10) - 1
  return names[idx] ? `${names[idx]} ${y}` : month
}

export default function RankingsVideoHero() {
  const [video, setVideo] = useState<RankingVideo | null>(null)
  const [loading, setLoading] = useState(true)
  // Starts muted — browsers block autoplay-with-sound outright, and even
  // where it's technically allowed it's a bad surprise on a page nobody
  // asked to make noise. This is React state (not just the video's own
  // `muted` attribute) so a click can flip it.
  const [muted, setMuted] = useState(true)

  const toggleMuted = () => setMuted(m => !m)

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const res = await fetch('/api/rankings-videos')
        const data = await res.json()
        const videos: RankingVideo[] = data.videos || []
        setVideo(videos[0] ?? null)
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

  // No "What Moved" video uploaded for the current month yet — render
  // nothing rather than getting stuck showing "Loading..." forever. Once
  // it's uploaded to the Supabase monthly-videos bucket (still a manual
  // step — see scripts/upload-monthly-videos.mjs), this section appears
  // automatically.
  if (!video) {
    return null
  }

  return (
    <div style={{
      width: '100%',
      background: '#000',
    }}>
      {/* Mobile tuning (Aug 13, 2026, kept): the box below keeps its 16:9
          shape via padding-bottom, which on a narrow phone works out to
          only ~190px tall. minHeight gives it a floor on small screens (no
          effect on desktop, where 16:9-of-width is already taller than
          this). The video itself is vertical (1080x1920) and letterboxes
          inside this box via objectFit: contain, same as the old format. */}
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

      {/* Fixed (Aug 16, 2026): the video is just a video (no overlay drawn
          on top of it) — the rendered "What Moved" clip already draws its
          own logo, header and cards. Label/CTA live in a plain panel below
          it. See RankingsVideoHero.tsx.bak-overlap for the old version. */}
      <div className="rvh-video-box" style={{
        position: 'relative',
        width: '100%',
        paddingBottom: '56.25%', // 16:9 box; the vertical clip letterboxes inside it
        background: '#000',
        overflow: 'hidden',
      }}>
        <video
          key={video.url}
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
          <source src={video.url} type="video/mp4" />
        </video>

        {/* Mute/unmute toggle. The "What Moved" videos are silent by
            design, but the button is shown regardless — clicking it on a
            silent clip is harmless, and it stays ready for any future clip
            that does carry audio. */}
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
          What Moved
        </div>

        <div>
          <div className="rvh-tier-name" style={{
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 4,
            letterSpacing: '-0.3px',
          }}>
            {monthLabel(video.month)}
          </div>
          <div className="rvh-tier-desc" style={{
            fontSize: 14,
            color: 'var(--muted)',
          }}>
            Top 25 rank changes across all 3 cap tiers
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
      </div>
    </div>
  )
}
