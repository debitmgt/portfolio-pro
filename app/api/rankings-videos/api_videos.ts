// app/api/rankings-videos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase environment variables not configured')
}

const supabase = createClient(supabaseUrl, supabaseKey)

interface RankingVideo {
  tier: 'large' | 'mid' | 'small'
  url: string
  month: string
  part: number
}

export async function GET(request: NextRequest) {
  try {
    // Get current month in YYYY-MM format
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    
    // List all files in monthly-videos bucket
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
    
    // Parse filenames and build URLs
    const videos: RankingVideo[] = data
      .filter(file => file.name?.endsWith('.mp4'))
      .map(file => {
        const name = file.name || ''
        // Expect: large_2026-08_part01_of_13_final.mp4
        const match = name.match(/^(large|mid|small)_(\d{4}-\d{2})_part(\d+)_of_\d+_final\.mp4$/)
        
        if (!match) return null
        
        const [, tier, month, part] = match
        const url = `${supabaseUrl}/storage/v1/object/public/monthly-videos/${currentMonth}/${name}`
        
        return {
          tier: tier as 'large' | 'mid' | 'small',
          url,
          month,
          part: parseInt(part, 10),
        }
      })
      .filter((v): v is RankingVideo => v !== null)
    
    // Return only the first part of each tier for the hero rotation
    const featured = ['large', 'mid', 'small']
      .map(tier => videos.find(v => v.tier === tier && v.part === 1))
      .filter((v): v is RankingVideo => v !== null)
    
    return NextResponse.json({ videos: featured })
  } catch (err) {
    console.error('API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
