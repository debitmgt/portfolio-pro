// scripts/verify-webhook-sync.mjs
//
// Checks whether the Stripe webhook actually synced a user's subscription
// state into Supabase correctly. Run this AFTER firing a test event with
// the fixtures in scripts/stripe-fixtures/.
//
// Usage:
//   node --env-file=.env.local scripts/verify-webhook-sync.mjs <supabase_user_id> <expected_plan>
//
// Example:
//   node --env-file=.env.local scripts/verify-webhook-sync.mjs 1234-5678-uuid pro
//   node --env-file=.env.local scripts/verify-webhook-sync.mjs 1234-5678-uuid free

import { createClient } from '@supabase/supabase-js'

const [, , userId, expectedPlan] = process.argv

if (!userId || !expectedPlan) {
  console.error('Usage: node --env-file=.env.local scripts/verify-webhook-sync.mjs <supabase_user_id> <expected_plan>')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in your env.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let failed = false

console.log(`\nChecking profile for user ${userId}...`)

const { data: profile, error: profileError } = await admin
  .from('profiles')
  .select('id, plan')
  .eq('id', userId)
  .single()

if (profileError) {
  console.error('  ✗ Could not read profile:', profileError.message)
  failed = true
} else if (profile.plan !== expectedPlan) {
  console.error(`  ✗ profiles.plan = "${profile.plan}", expected "${expectedPlan}"`)
  failed = true
} else {
  console.log(`  ✓ profiles.plan = "${profile.plan}" as expected`)
}

console.log(`\nChecking subscriptions table for user ${userId}...`)

const { data: subs, error: subsError } = await admin
  .from('subscriptions')
  .select('id, status, price_id, current_period_end, cancel_at_period_end')
  .eq('user_id', userId)
  .order('updated_at', { ascending: false })
  .limit(1)

if (subsError) {
  console.error('  ✗ Could not read subscriptions:', subsError.message)
  failed = true
} else if (!subs || subs.length === 0) {
  console.error('  ✗ No subscription row found for this user')
  failed = true
} else {
  console.log('  ✓ Latest subscription row:', subs[0])
}

console.log(failed ? '\n❌ Webhook sync verification FAILED\n' : '\n✅ Webhook sync verification PASSED\n')
process.exit(failed ? 1 : 0)
