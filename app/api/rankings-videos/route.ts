// app/api/rankings-videos/route.ts
//
// Serves the monthly Top 25 clips to RankingsVideoHero: one clip per cap
// tier (Part 01 of each tier), in the order large -> mid -> small.
//
// Restored Oct 2026. The Sep 21 change had pointed this at the single
// "What Moved" video by mistake. "What Moved" (movers_*.mp4) videos are
// advertising-only and are never served by this route.
//
// Files live in the monthly-videos bucket as {YYYY-MM}/{tier}_{YYYY-MM}_partNN_of_13_final.mp4,
// uploaded by scripts/upload-monthly-videos.mjs.
//
// Month selection: the current month's folder if it has clips; otherwise
// the most recent earlier month that does (so the section is not blank in
// the first days of a month, before new clips are uploaded). To turn the
// fallback off, set FALLBACK_TO_LATEST_MONTH to false.
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase environment variables not configured')
}

const supabase = createClient(supabaseUrl, supabaseKey)

type Tier = 'large' | 'mid' | 'small'

interface RankingVideo {
  tier: Tier
  url: string
  month: string
}

const FALLBACK_TO_LATEST_MONTH = true
const TIERS: Tier[] = ['large', 'mid', 'small']
const CLIP_PART = '01'

// e.g. large_2026-10_part01_of_13_final.mp4 (movers_* never matches)
const CLIP_FILENAME = /^(large|mid|small)_(\d{4}-\d{2})_part(\d{2})_of_\d+_final\.mp4$/

async function clipsForMonth(month: string): Promise<RankingVideo[]> {
  const { data, error } = await supabase.storage
    .from('monthly-videos')
    .list(month, { limit: 200 })

  if (error) throw error
  if (!data) return []

  const videos: RankingVideo[] = []
  for (const tier of TIERS) {
    const file = data.find(f => {
      const m = f.name ? CLIP_FILENAME.exec(f.name) : null
      return m && m[1] === tier && m[3] === CLIP_PART
    })
    if (file) {
      videos.push({
        tier,
        month,
        url: `${supabaseUrl}/storage/v1/object/public/monthly-videos/${month}/${file.name}`,
      })
    }
  }
  return videos
}

export async function GET() {
  try {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    let videos = await clipsForMonth(currentMonth)

    if (videos.length === 0 && FALLBACK_TO_LATEST_MONTH) {
      // Look at the month folders in the bucket, newest first.
      const { data: folders, error } = await supabase.storage
        .from('monthly-videos')
        .list('', { limit: 100 })

      if (error) throw error

      const months = (folders || [])
        .map(f => f.name)
        .filter(name => /^\d{4}-\d{2}$/.test(name) && name < currentMonth)
        .sort()
        .reverse()

      for (const month of months) {
        videos = await clipsForMonth(month)
        if (videos.length > 0) break
      }
    }

    return NextResponse.json({ videos })
  } catch (err) {
    console.error('API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
