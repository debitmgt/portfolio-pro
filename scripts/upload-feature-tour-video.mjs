// scripts/upload-feature-tour-video.mjs
//
// Uploads the homepage "See it in action" feature-tour video to Supabase
// Storage. This is a one-off static asset (unlike the monthly ranking
// videos), but public/*.mp4 is gitignored repo-wide on purpose — video files
// don't belong in git history — so this file can't just live in public/ and
// get committed. Supabase Storage is the same pattern already used for the
// monthly ranking videos (see scripts/upload-monthly-videos.mjs and
// app/api/rankings-videos/route.ts), just a separate "site-assets" bucket
// since this content doesn't rotate monthly and doesn't need that API
// route's filename-pattern parsing.
//
// Usage (run from the folder with the real .env.local — Downloads, not
// Desktop, per the project notes):
//   node --env-file=.env.local scripts/upload-feature-tour-video.mjs
//
// Expects public/videos/feature-tour.mp4 to already exist locally (it was
// written into this folder directly). Creates the "site-assets" bucket if it
// doesn't exist yet, uploads the video (upsert: true, so re-running this
// after swapping in a new export just replaces it at the same URL — no code
// change needed), and prints the public URL.
//
// The poster JPG (public/videos/feature-tour-poster.jpg) is NOT uploaded
// here — it's small enough to stay a normal git-tracked file in public/ and
// is not covered by the *.mp4 gitignore rule, so it deploys fine on its own.

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'

const BUCKET = 'site-assets'
const FILES = [
  { local: './public/videos/feature-tour.mp4', remote: 'feature-tour.mp4', contentType: 'video/mp4' },
]

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in your env.')
  console.error('Run with: node --env-file=.env.local scripts/upload-feature-tour-video.mjs')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

for (const f of FILES) {
  if (!existsSync(f.local)) {
    console.error(`Missing local file: ${f.local}`)
    process.exit(1)
  }
}

console.log(`Ensuring bucket "${BUCKET}" exists and is public...`)
const { data: buckets, error: listErr } = await supabase.storage.listBuckets()
if (listErr) {
  console.error('Could not list buckets:', listErr.message)
  process.exit(1)
}
if (!buckets.some((b) => b.name === BUCKET)) {
  const { error: createErr } = await supabase.storage.createBucket(BUCKET, { public: true })
  if (createErr) {
    console.error(`Could not create bucket "${BUCKET}":`, createErr.message)
    process.exit(1)
  }
  console.log(`Created bucket "${BUCKET}".`)
} else {
  console.log(`Bucket "${BUCKET}" already exists.`)
}

console.log('\nUploading...\n')

let failed = 0
for (const f of FILES) {
  const bytes = readFileSync(f.local)
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(f.remote, bytes, { contentType: f.contentType, upsert: true })

  if (error) {
    console.error(`✗ ${f.remote}: ${error.message}`)
    failed++
    continue
  }

  const publicUrl = `${url}/storage/v1/object/public/${BUCKET}/${f.remote}`
  console.log(`✓ ${f.remote} -> ${publicUrl}`)
}

if (failed > 0) {
  console.error(`\n${failed} file(s) failed to upload.`)
  process.exit(1)
}

console.log('\nDone. FeatureTourVideo.tsx already points at this URL via NEXT_PUBLIC_SUPABASE_URL — no further code change needed.')
