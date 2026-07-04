// app/newsletter/archive/page.tsx
// Public archive index — no auth required. Lists every period_label that has
// monthly_rankings data, most recent first. Reads via createServerClient()
// (anon key, RLS-respecting), matching the codebase's documented convention
// for Server Component reads (see lib/supabase/server.ts). Works because
// monthly_rankings already has a public SELECT policy
// ("monthly_rankings readable by anyone").
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { periodTitle } from '@/components/NewsletterIssueView'

// New issues land via a monthly cron job independent of any deploy — refresh
// this list periodically rather than freezing it at build/deploy time.
export const revalidate = 3600

export default async function NewsletterArchivePage() {
  const supabase = createServerClient()

  const { data } = await supabase
    .from('monthly_rankings')
    .select('period_label')
    .order('period_label', { ascending: false })

  const periods = Array.from(new Set((data ?? []).map(r => r.period_label)))

  return (
    <main style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', background: 'var(--bg)', padding: '56px 24px',
    }}>
      <div style={{ width: '100%', maxWidth: 720 }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.5px', color: 'var(--text)' }}>
          Newsletter Archive
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 14.5, marginBottom: 32 }}>
          Every past issue of the Top 25 — large, mid, and small cap — stays here permanently, whether or not you were subscribed at the time.
        </p>

        {periods.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>No issues published yet — check back after the next monthly send.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {periods.map(p => (
            <Link
              key={p}
              href={`/newsletter/archive/${p}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 20px', borderRadius: 8,
                background: 'var(--surface)', border: '1px solid var(--border)', color: 'inherit',
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{periodTitle(p)}</span>
              <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>View issue →</span>
            </Link>
          ))}
        </div>

        <p style={{ marginTop: 40, fontSize: 13 }}>
          <Link href="/pricing" style={{ color: 'var(--accent)', fontWeight: 600 }}>← Back to Ownfolio</Link>
        </p>
      </div>
    </main>
  )
}
