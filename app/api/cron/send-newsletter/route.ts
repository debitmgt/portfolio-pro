// app/api/cron/send-newsletter/route.ts
//
// Scheduled monthly send (see vercel.json — runs a few hours after
// refresh-monthly-rankings to give that job time to finish). Two audiences,
// same underlying monthly_rankings data:
//   - Free: every confirmed, non-unsubscribed newsletter_subscribers row
//     gets three unfiltered Top 25 lists — large/mid/small cap — identical
//     content, identical for everyone.
//   - Pro: every profile with plan='pro', newsletter_opt_out=false, and at
//     least one watchlist_items row gets a digest filtered to their own
//     watchlist symbols, grouped by the same tiers. Selection-based
//     personalization only — this route never reads holdings, shares, or
//     cost basis.
// Both emails also carry an optional editorial spotlight (newsletter_editorial)
// when a row exists for the period — genuine commentary, not computed data.
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendBatch, type BatchEmail } from '@/lib/email/resend'
import { renderMultiTierTop25Email, renderWatchlistDigestEmail } from '@/lib/email/newsletter-templates'
import type { CapTier, MonthlyRanking, WeightedReturnRanking } from '@/lib/supabase/types'
import type { NextRequest } from 'next/server'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

const TOP_N = 25
const TIERS: CapTier[] = ['large', 'mid', 'small']

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const periodLabel = new Date().toISOString().slice(0, 7)

  const { data: allRankings, error: rankingsError } = await admin
    .from('monthly_rankings')
    .select('*')
    .eq('period_label', periodLabel)
    .order('rank', { ascending: true })
  if (rankingsError) {
    return NextResponse.json({ error: rankingsError.message }, { status: 500 })
  }
  if (!allRankings || allRankings.length === 0) {
    return NextResponse.json({ ok: false, note: `No monthly_rankings rows for ${periodLabel} yet — has refresh-monthly-rankings run this month?` })
  }

  const byTier = {} as Record<CapTier, MonthlyRanking[]>
  for (const tier of TIERS) {
    byTier[tier] = (allRankings as MonthlyRanking[])
      .filter(r => r.cap_tier === tier)
      .slice(0, TOP_N)
  }

  // Optional hand-written commentary for this period — omitted entirely if
  // no row exists yet (no admin UI for this; inserted directly when wanted).
  const { data: editorial } = await admin
    .from('newsletter_editorial')
    .select('*')
    .eq('period_label', periodLabel)
    .maybeSingle()

  // Combined (non-tiered) Top 50, recency-weighted — optional too, since
  // refresh-monthly-rankings only started populating this table going
  // forward. Missing rows just mean the email skips that section.
  const { data: weightedTop50 } = await admin
    .from('weighted_return_rankings')
    .select('*')
    .eq('period_label', periodLabel)
    .order('rank', { ascending: true })

  // ── Free tier: three Top 25 lists, identical for everyone ──────────────
  const { data: freeSubs, error: freeError } = await admin
    .from('newsletter_subscribers')
    .select('*')
    .eq('confirmed', true)
    .is('unsubscribed_at', null)
  if (freeError) {
    return NextResponse.json({ error: freeError.message }, { status: 500 })
  }

  const freeBatch: BatchEmail[] = (freeSubs ?? []).map(sub => {
    const rendered = renderMultiTierTop25Email({
      periodLabel,
      byTier,
      weightedTop50: (weightedTop50 ?? []) as WeightedReturnRanking[],
      editorial: editorial ?? null,
      unsubscribeToken: sub.unsubscribe_token,
    })
    return { to: sub.email, subject: rendered.subject, html: rendered.html }
  })

  // ── Pro tier: watchlist digest, filtered by selection only ─────────────
  // Filtering newsletter_opt_out in JS rather than as a second chained .eq()
  // — a compound `.eq('plan','pro').eq('newsletter_opt_out', false)` query
  // reliably returned zero rows even when a row matched both conditions
  // individually (confirmed via diagnostic logging 2026-07-03). Querying by
  // plan alone works correctly, so opt-out is applied as a plain array filter.
  const { data: allProProfiles, error: proError } = await admin
    .from('profiles')
    .select('*')
    .eq('plan', 'pro')
  if (proError) {
    return NextResponse.json({ error: proError.message }, { status: 500 })
  }
  const proProfiles = (allProProfiles ?? []).filter(p => !p.newsletter_opt_out)

  // One watchlist query per Pro user — fine at current scale (a handful of
  // users). If the Pro base grows meaningfully, batch this into a single
  // `.in('user_id', [...])` query and group in memory instead.
  const proBatch: BatchEmail[] = []
  let proSkippedEmptyWatchlist = 0
  for (const profile of proProfiles) {
    if (!profile.email) continue
    const { data: watchlist } = await admin
      .from('watchlist_items')
      .select('symbol')
      .eq('user_id', profile.id)
    const symbols = (watchlist ?? []).map(w => w.symbol)
    if (symbols.length === 0) {
      proSkippedEmptyWatchlist += 1
      continue // nothing to send if they haven't built a watchlist yet
    }
    const rendered = renderWatchlistDigestEmail({
      periodLabel,
      allRankings: allRankings as MonthlyRanking[],
      weightedTop50: (weightedTop50 ?? []) as WeightedReturnRanking[],
      watchlistSymbols: symbols,
      editorial: editorial ?? null,
      unsubscribeToken: profile.newsletter_unsubscribe_token,
    })
    proBatch.push({ to: profile.email, subject: rendered.subject, html: rendered.html })
  }

  const [freeResult, proResult] = await Promise.all([
    sendBatch(freeBatch),
    sendBatch(proBatch),
  ])

  return NextResponse.json({
    ok: true,
    period: periodLabel,
    free: { attempted: freeBatch.length, ...freeResult },
    pro: { attempted: proBatch.length, skippedEmptyWatchlist: proSkippedEmptyWatchlist, ...proResult },
  })
}
