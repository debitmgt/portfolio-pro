// scripts/upload-monthly-videos.mjs
//
// Uploads locally-rendered monthly ranking videos (from ./monthly_videos/,
// produced by build_monthly_videos_auto.py) into the Supabase `monthly-videos`
// storage bucket, which is what powers the RankingsVideoHero component on
// the pricing page (app/components/RankingsVideoHero.tsx, read via
// app/api/rankings-videos/route.ts).
//
// Only uploads files matching the exact naming pattern the API route
// expects: {tier}_{YYYY-MM}_partNN_of_TOTAL_final.mp4 — e.g.
// large_2026-08_part01_of_13_final.mp4. Anything else in the folder
// (silent intermediates, .bak files, etc.) is skipped.
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

const FILENAME_PATTERN = /^(large|mid|small)_(\d{4}-\d{2})_part(\d+)_of_(\d+)_final\.mp4$/

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

const matches = entries.filter((name) => FILENAME_PATTERN.test(name))

if (matches.length === 0) {
  console.error(`No files in "${folder}" match the expected pattern (e.g. large_2026-08_part01_of_13_final.mp4).`)
  console.error(`Found ${entries.length} file(s) total — check the folder path and that build_monthly_videos_auto.py has run.`)
  process.exit(1)
}

console.log(`Found ${matches.length} matching video(s) in "${folder}". Uploading...\n`)

let uploaded = 0
let failed = 0

for (const name of matches) {
  const match = name.match(FILENAME_PATTERN)
  const month = match[2] // YYYY-MM
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
