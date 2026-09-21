// scripts/upload-monthly-videos.mjs
//
// Uploads a locally-rendered monthly "What Moved" video (from
// ./monthly_videos/, produced by render_movers.py) into the Supabase
// `monthly-videos` storage bucket, which is what powers the
// RankingsVideoHero component on the pricing page
// (components/RankingsVideoHero.tsx, read via
// app/api/rankings-videos/route.ts).
//
// Only uploads files matching the naming pattern the API route expects:
//   movers_{YYYY-MM}_final.mp4 — e.g. movers_2026-09_final.mp4
// The old per-tier 13-part narrated format (large_2026-08_part01_of_13_
// final.mp4) is retired as of Sep 16, 2026 but still matched here so old
// local folders don't silently no-op; anything else in the folder (silent
// intermediates, .bak files, etc.) is skipped.
//
// Usage:
//   node --env-file=.env.local scripts/upload-monthly-videos.mjs [path-to-folder]
//
// Defaults to ./monthly_videos if no folder is given. Requires
// NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your env (the
// bucket is public-read but write-restricted, so this needs the service
// role key — never the anon key — same as the other admin scripts here).

import { createClient } from '@supabase/supabase-js'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const MOVERS_PATTERN = /^movers_(\d{4}-\d{2})_final\.mp4$/
const LEGACY_PART_PATTERN = /^(large|mid|small)_(\d{4}-\d{2})_part(\d+)_of_(\d+)_final\.mp4$/

const folder = process.argv[2] || './monthly_videos'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in your env.')
  console.error('Run with: node --env-file=.env.local scripts/upload-monthly-videos.mjs')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

let entries
try {
  entries = readdirSync(folder)
} catch (err) {
  console.error(`Could not read folder "${folder}": ${err.message}`)
  process.exit(1)
}

// Each entry: [filename, YYYY-MM]
const matches = entries
  .map((name) => {
    const moversMatch = name.match(MOVERS_PATTERN)
    if (moversMatch) return [name, moversMatch[1]]
    const legacyMatch = name.match(LEGACY_PART_PATTERN)
    if (legacyMatch) return [name, legacyMatch[2]]
    return null
  })
  .filter(Boolean)

if (matches.length === 0) {
  console.error(`No files in "${folder}" match the expected pattern (e.g. movers_2026-09_final.mp4).`)
  console.error(`Found ${entries.length} file(s) total — check the folder path and that render_movers.py has run.`)
  process.exit(1)
}

console.log(`Found ${matches.length} matching video(s) in "${folder}". Uploading...\n`)

let uploaded = 0
let failed = 0

for (const [name, month] of matches) {
  const storagePath = `${month}/${name}`
  const filePath = join(folder, name)

  process.stdout.write(`  ${storagePath} ... `)

  const fileBuffer = readFileSync(filePath)
  const { error } = await supabase.storage
    .from('monthly-videos')
    .upload(storagePath, fileBuffer, {
      contentType: 'video/mp4',
      upsert: true, // safe to re-run — re-uploading replaces the same file
    })

  if (error) {
    console.log(`FAILED (${error.message})`)
    failed++
  } else {
    console.log('done')
    uploaded++
  }
}

console.log(`\n${uploaded} uploaded, ${failed} failed, out of ${matches.length} matched.`)
if (failed > 0) process.exit(1)
