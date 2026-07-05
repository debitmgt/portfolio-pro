// app/newsletter/archive/[period]/page.tsx
// Public per-issue archive page — no auth required. Renders the exact same
// public content that went out in that month's email: three cap-tier Top 25
// tables plus the optional editorial spotlight. Reads via createServerClient()
// (anon key, RLS-respecting). Works because both monthly_rankings and
// newsletter_editorial have public SELECT policies.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import NewsletterIssueView from '@/components/NewsletterIssueView'

export const revalidate = 3600

export default async function NewsletterArchiveIssuePage({
  params,
}: {
  params: { period: string }
}) {
  const periodLabel = params.period
  const supabase = createServerClient()

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
          Get next month's issue in your inbox, free.
        </p>
        <Link href="/pricing#newsletter">
          <button className="btn-primary" style={{ padding: '10px 22px', fontSize: 14, fontWeight: 600 }}>
            Subscribe for free
          </button>
        </Link>
      </div>
    </main>
  )
}
