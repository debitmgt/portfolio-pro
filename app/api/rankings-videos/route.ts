// app/api/rankings-videos/route.ts
//
// Serves the current month's "What Moved" video to RankingsVideoHero.
//
// Updated Sep 2026 for the "What Moved" pipeline (render_movers.py): one
// combined ~34s vertical video per month covering all three cap tiers'
// rank changes, instead of the retired 13-part-per-tier narrated countdown
// format. Expected filename: movers_2026-09_final.mp4, uploaded by
// scripts/upload-monthly-videos.mjs to monthly-videos/{YYYY-MM}/.
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase environment variables not configured')
}

const supabase = createClient(supabaseUrl, supabaseKey)

interface RankingVideo {
  url: string
  month: string
}

const MOVERS_FILENAME = /^movers_(\d{4}-\d{2})_final\.mp4$/

export async function GET() {
  try {
    // Get current month in YYYY-MM format
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // List all files in monthly-videos bucket for the current month
    const { data, error } = await supabase.storage
      .from('monthly-videos')
      .list(currentMonth, { limit: 100 })

    if (error) {
      console.error('Supabase storage error:', error)
      return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ videos: [] })
    }

    // Find this month's single "What Moved" file. If it hasn't been
    // uploaded yet, videos comes back empty and the hero renders nothing
    // (same graceful-empty behavior as before).
    const match = data.find(file => file.name && MOVERS_FILENAME.test(file.name))

    if (!match) {
      return NextResponse.json({ videos: [] })
    }

    const url = `${supabaseUrl}/storage/v1/object/public/monthly-videos/${currentMonth}/${match.name}`
    const videos: RankingVideo[] = [{ url, month: currentMonth }]

    return NextResponse.json({ videos })
  } catch (err) {
    console.error('API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
