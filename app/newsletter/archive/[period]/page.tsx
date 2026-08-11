// app/newsletter/archive/[period]/page.tsx
// Per-issue archive page.
//
// Access rule (Morningstar-style): the CURRENT month is gated for signed-out
// visitors — rank 1 and rank 25 shown per tier, the rest behind a free account.
// Every EARLIER month stays fully public, no account required, exactly as
// before. Signed-in users always see the full issue.
//
// Two things to preserve if this file is edited:
//   1. The gated branch queries ONLY ranks 1 and 25. Never fetch the full set
//      and hide rows in styling — the middle names would ship in the HTML.
//   2. This route is force-dynamic. It used ISR (revalidate = 3600), which
//      cannot be kept once output depends on session state: a cached gated page
//      could be served to a signed-in user, or worse, a cached full issue to a
//      signed-out one.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import NewsletterIssueView from '@/components/NewsletterIssueView'
import GatedIssueView, { type TeaserRow, type TeaserTier } from '@/components/GatedIssueView'
import type { CapTier } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export default async function NewsletterArchiveIssuePage(
  props: {
    params: Promise<{ period: string }>
  }
) {
  const params = await props.params;
  const periodLabel = params.period
  const supabase = await createServerClient()

  // Newest published period, and whether this visitor is signed in.
  const [{ data: newest }, { data: { user } }] = await Promise.all([
    supabase
      .from('monthly_rankings')
      .select('period_label')
      .order('period_label', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.auth.getUser(),
  ])

  const isCurrentMonth = !!newest && newest.period_label === periodLabel
  const gated = isCurrentMonth && !user

  if (gated) {
    const { data: edges } = await supabase
      .from('monthly_rankings')
      .select('cap_tier, rank, symbol, company_name, trailing_return_1y')
      .eq('period_label', periodLabel)
      .in('rank', [1, 25])

    if (!edges || edges.length === 0) notFound()

    const teaser: Record<CapTier, TeaserTier> = {
      large: { first: null, last: null },
      mid: { first: null, last: null },
      small: { first: null, last: null },
    }

    for (const r of edges) {
      const tier = r.cap_tier as CapTier
      if (!tier || !teaser[tier]) continue
      const row: TeaserRow = {
        rank: r.rank,
        symbol: r.symbol,
        company_name: r.company_name,
        trailing_return_1y: r.trailing_return_1y == null ? null : Number(r.trailing_return_1y),
      }
      if (r.rank === 1) teaser[tier].first = row
      else teaser[tier].last = row
    }

    return (
      <main style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', background: 'var(--bg)', padding: '56px 24px',
      }}>
        <div style={{ width: '100%', maxWidth: 720, marginBottom: 20 }}>
          <Link href="/newsletter/archive" style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 13 }}>← All issues</Link>
        </div>

        <GatedIssueView periodLabel={periodLabel} teaser={teaser} />
      </main>
    )
  }

  // Prior months, and any signed-in visitor: unchanged behaviour.
  const [{ data: rankings }, { data: editorial }, { data: weightedTop50 }] = await Promise.all([
    supabase
      .from('monthly_rankings')
      .select('*')
      .eq('period_label', periodLabel)
      .order('rank', { ascending: true }),
    supabase
      .from('newsletter_editorial')
      .select('*')
      .eq('period_label', periodLabel)
      .maybeSingle(),
    supabase
      .from('weighted_return_rankings')
      .select('*')
      .eq('period_label', periodLabel)
      .order('rank', { ascending: true }),
  ])

  if (!rankings || rankings.length === 0) notFound()

  return (
    <main style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', background: 'var(--bg)', padding: '56px 24px',
    }}>
      <div style={{ width: '100%', maxWidth: 720, marginBottom: 20 }}>
        <Link href="/newsletter/archive" style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 13 }}>← All issues</Link>
      </div>

      <NewsletterIssueView
        periodLabel={periodLabel}
        rankings={rankings}
        weightedTop50={weightedTop50 ?? []}
        editorial={editorial ?? null}
      />

      <div style={{ width: '100%', maxWidth: 720, marginTop: 36, paddingTop: 28, borderTop: '1px solid var(--border)' }}>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 12 }}>
          Get next month&apos;s issue in your inbox, free.
        </p>
        <Link
          href="/pricing#newsletter"
          className="btn-primary"
          style={{
            display: 'inline-block', padding: '10px 22px', fontSize: 14,
            fontWeight: 600, borderRadius: 4,
          }}
        >
          Subscribe for free
        </Link>
      </div>
    </main>
  )
}
