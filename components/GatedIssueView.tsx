// components/GatedIssueView.tsx
// Teaser rendering of the CURRENT month's issue for signed-out visitors.
// Prior months are never gated — they render through NewsletterIssueView as
// before. Deliberately mirrors the reveal rule used in the monthly videos and
// Reddit posts (rank 1 and rank 25 shown, everything between withheld) so the
// format is the same wherever someone first meets the list.
//
// IMPORTANT: this component only ever receives ranks 1 and 25. The middle rows
// are literal placeholder dashes, not real data blurred with CSS — there is
// nothing here to recover from the page source. Do not "simplify" this by
// passing the full ranking set and hiding rows in styling.
import Link from 'next/link'
import { periodTitle } from '@/components/NewsletterIssueView'
import type { CapTier } from '@/lib/supabase/types'

export type TeaserRow = {
  rank: number
  symbol: string
  company_name: string | null
  trailing_return_1y: number | null
}

export type TeaserTier = { first: TeaserRow | null; last: TeaserRow | null }

const TIER_LABEL: Record<CapTier, string> = {
  large: '🏛️ Large Cap Top 25',
  mid: '🏗️ Mid Cap Top 25',
  small: '🚜 Small Cap Top 25',
}

const TIER_RANGE: Record<CapTier, string> = {
  large: 'Market cap ≥ $10B',
  mid: 'Market cap $2B–$10B',
  small: 'Market cap $250M–$2B',
}

const TIER_ORDER: CapTier[] = ['large', 'mid', 'small']

const LOCKED_ROWS = 5

function fmtPct(v: number | null): string {
  if (v == null) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}%`
}

const cellBase: React.CSSProperties = { padding: '9px 10px' }

function Row({ row, rankLabel }: { row: TeaserRow | null; rankLabel?: string }) {
  if (!row) return null
  const neg = row.trailing_return_1y != null && row.trailing_return_1y < 0
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ ...cellBase, color: 'var(--muted)' }}>{rankLabel ?? row.rank}</td>
      <td style={cellBase}>
        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{row.symbol}</span>
        {row.company_name && (
          <span style={{ color: 'var(--muted)', fontSize: 12 }}> · {row.company_name}</span>
        )}
      </td>
      <td style={{
        ...cellBase, textAlign: 'right', fontWeight: 700,
        color: neg ? 'var(--red)' : 'var(--accent)',
      }}>
        {fmtPct(row.trailing_return_1y)}
      </td>
    </tr>
  )
}

function LockedRow({ n }: { n: number }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }} aria-hidden="true">
      <td style={{ ...cellBase, color: 'var(--muted)', filter: 'blur(4px)', userSelect: 'none' }}>{n}</td>
      <td style={{ ...cellBase, filter: 'blur(4px)', userSelect: 'none' }}>
        <span style={{ fontWeight: 700, color: 'var(--text)' }}>————</span>
        <span style={{ color: 'var(--muted)', fontSize: 12 }}> · ————————————</span>
      </td>
      <td style={{
        ...cellBase, textAlign: 'right', fontWeight: 700,
        color: 'var(--accent)', filter: 'blur(4px)', userSelect: 'none',
      }}>
        ——.—%
      </td>
    </tr>
  )
}

export default function GatedIssueView({
  periodLabel,
  teaser,
}: {
  periodLabel: string
  teaser: Record<CapTier, TeaserTier>
}) {
  return (
    <div style={{ width: '100%', maxWidth: 720 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.5px', color: 'var(--text)' }}>
        Top 25 — {periodTitle(periodLabel)}
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 28 }}>
        This month&apos;s issue. Ranks 1 and 25 are shown below in each cap tier — the
        full lists open with a free account. Every earlier issue stays open to
        everyone, no account needed.
      </p>

      {TIER_ORDER.map(tier => (
        <div key={tier} style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2, color: 'var(--text)' }}>{TIER_LABEL[tier]}</h2>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>{TIER_RANGE[tier]}</p>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ ...cellBase, textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em', width: 32 }}>Rank</th>
                  <th style={{ ...cellBase, textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Company</th>
                  <th style={{ ...cellBase, textAlign: 'right', color: 'var(--muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }}>1Y Return</th>
                </tr>
              </thead>
              <tbody>
                <Row row={teaser[tier].first} />
                {Array.from({ length: LOCKED_ROWS }, (_, i) => <LockedRow key={i} n={i + 2} />)}
                <Row row={teaser[tier].last} />
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div style={{
        background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 8,
        padding: '22px 24px', textAlign: 'center',
      }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>
          Open the full lists
        </p>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: '0 0 16px' }}>
          A free account opens all 75 names across the three tiers, plus the
          combined Top 50 weighted list.
        </p>
        {/* Styled anchor rather than a link wrapping a button. Nesting a button inside a link
            produces invalid HTML, breaks keyboard focus order, and makes
            screen readers announce an ambiguous target. */}
        <Link
          href="/auth/login?mode=signup"
          className="btn-primary"
          style={{
            display: 'inline-block', padding: '11px 24px', fontSize: 14.5,
            fontWeight: 600, borderRadius: 4,
          }}
        >
          Create free account
        </Link>
        <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '12px 0 0' }}>
          No card required · Email address only
        </p>
      </div>

      <p style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6, marginTop: 24 }}>
        Ranked by trailing 1-year price return, computed identically for every
        tracked symbol from public market data. AI helps gather and process
        that data, but the ranking itself isn&apos;t AI-picked — it&apos;s a
        straight calculation, run the same way every month. All figures are
        historical performance only — not tailored to any individual and not
        a signal to act now. Not financial advice.
      </p>
    </div>
  )
}
