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
// Portrait (9:16) source, so the box uses aspectRatio instead of
// RankingsVideoHero's 16:9 padding-bottom trick — a landscape box was tried
// and rejected (Aug 22, 2026) because it pillarboxes this portrait clip with
// wide black bars on desktop; the portrait card fills its frame with no
// dead space.
//
// The poster JPG stays local (public/videos/feature-tour-poster.jpg) — it's
// 22KB, git-tracked fine (only *.mp4 is gitignored), and already deployed
// successfully. Only the video itself needs the Supabase URL.
//
// Autoplay-muted-with-a-toggle mirrors RankingsVideoHero's approach (see that
// file's comments): browsers block autoplay-with-sound outright, and even
// where allowed it's a bad surprise on a page nobody asked to make noise.
const VIDEO_SRC = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site-assets/feature-tour.mp4`

export default function FeatureTourVideo() {
  const [muted, setMuted] = useState(true)
  const toggleMuted = () => setMuted(m => !m)

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      maxWidth: 340,
      margin: '0 auto',
      aspectRatio: '9 / 16',
      borderRadius: 14,
      overflow: 'hidden',
      background: '#000',
      border: '1px solid var(--border)',
      boxShadow: '0 16px 44px rgba(0,0,0,.16)',
    }}>
      <video
        autoPlay
        muted={muted}
        loop
        playsInline
        poster="/videos/feature-tour-poster.jpg"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
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
