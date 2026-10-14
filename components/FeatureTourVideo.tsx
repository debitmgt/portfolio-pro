'use client'

import { useState } from 'react'

// Static feature-tour clip for the homepage — unlike RankingsVideoHero this
// doesn't rotate, it's one fixed clip. Hosted on Supabase Storage (the
// "site-assets" bucket — see scripts/upload-feature-tour-video.mjs), NOT in
// public/: public/*.mp4 is gitignored repo-wide on purpose (video files
// don't belong in git history), so a file placed in public/videos/ locally
// would silently fail to deploy — `git add` skips it, Vercel never sees it,
// and the <video> tag 404s in production even though it works fine in local
// dev. Learned this the hard way (Aug 22, 2026) after the video didn't show
// up live post-deploy. The poster JPG is small enough to just live in
// public/ normally (git-tracked, not covered by the *.mp4 rule).
//
// Oct 14, 2026: replaced the portrait (9:16) clip with the landscape
// "Full Portfolio Tour" (1280x582, 2:22). The box now uses the clip's own
// aspect ratio with objectFit: contain so nothing is cropped, and spans both
// columns of the parent ofh-hero-grid (gridColumn 1 / -1) so it sits full
// width under the heading instead of squeezed into one half-column. On mobile
// the grid is already one column, so the span has no effect there.
// New filename (feature-tour-v2.mp4) instead of overwriting feature-tour.mp4,
// so the old portrait layout never serves the landscape file (or vice versa)
// while the upload and the deploy happen at different times, and no CDN
// cache of the old file is involved.
//
// The poster JPG stays local (public/videos/feature-tour-v2-poster.jpg) — it's
// ~16KB, git-tracked fine (only *.mp4 is gitignored), and already deployed
// successfully. Only the video itself needs the Supabase URL.
//
// Autoplay-muted-with-a-toggle mirrors RankingsVideoHero's approach (see that
// file's comments): browsers block autoplay-with-sound outright, and even
// where allowed it's a bad surprise on a page nobody asked to make noise.
const VIDEO_SRC = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site-assets/feature-tour-v2.mp4`

export default function FeatureTourVideo() {
  const [muted, setMuted] = useState(true)
  const toggleMuted = () => setMuted(m => !m)

  return (
    <div style={{
      position: 'relative',
      gridColumn: '1 / -1',
      width: '100%',
      aspectRatio: '1280 / 582',
      borderRadius: 14,
      overflow: 'hidden',
      background: '#fff',
      border: '1px solid var(--border)',
      boxShadow: '0 16px 44px rgba(0,0,0,.16)',
    }}>
      <video
        autoPlay
        muted={muted}
        loop
        playsInline
        poster="/videos/feature-tour-v2-poster.jpg"
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      >
        <source src={VIDEO_SRC} type="video/mp4" />
      </video>

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
  )
}
