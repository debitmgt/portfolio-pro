// components/NewsletterIssueView.tsx
// Shared presentational component for one month's newsletter issue, rendered
// on the public archive pages (app/newsletter/archive/[period]). Same data,
// same three cap-tier sections, as the emailed version in
// lib/email/newsletter-templates.ts — this is just a light-themed, in-browser
// rendering of the identical public content (never personalized, no auth
// required to view).
import type { MonthlyRanking, CapTier, NewsletterEditorial, WeightedReturnRanking } from '@/lib/supabase/types'

const TIER_LABEL: Record<CapTier, string> = {
  large: 'Large Cap Top 25',
  mid: 'Mid Cap Top 25',
  small: 'Small Cap Top 25',
}

const TIER_ORDER: CapTier[] = ['large', 'mid', 'small']

function fmtPct(v: number | null): string {
  if (v == null) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}%`
}

export function periodTitle(periodLabel: string): string {
  const [y, m] = periodLabel.split('-').map(Number)
  const d = new Date(Date.UTC(y, (m ?? 1) - 1, 1))
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export default function NewsletterIssueView({
  periodLabel,
  rankings,
  weightedTop50,
  editorial,
}: {
  periodLabel: string
  rankings: MonthlyRanking[]   // full set for the period, any tier, any rank
  weightedTop50?: WeightedReturnRanking[]   // already sorted + limited to top 50
  editorial: NewsletterEditorial | null
}) {
  const byTier: Record<CapTier, MonthlyRanking[]> = { large: [], mid: [], small: [] }
  for (const r of rankings) {
    if (r.cap_tier && byTier[r.cap_tier]) byTier[r.cap_tier].push(r)
  }
  for (const tier of TIER_ORDER) {
    byTier[tier] = [...byTier[tier]].sort((a, b) => a.rank - b.rank).slice(0, 25)
  }

  return (
    <div style={{ width: '100%', maxWidth: 720 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.5px', color: 'var(--text)' }}>
        Top 25 — {periodTitle(periodLabel)}
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 28 }}>
        The 25 highest trailing 1-year total returns in each of three cap tiers — large, mid, and small — from Ownfolio's tracked universe. Same lists every subscriber received.
      </p>

      {editorial && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)',
          borderRadius: 8, padding: '16px 20px', marginBottom: 32,
        }}>
          <div style={{ fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 700, marginBottom: 6 }}>
            This Month's Spotlight{editorial.symbol ? ` · ${editorial.symbol}` : ''}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{editorial.headline}</div>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.6 }}>{editorial.body}</p>
          <p style={{ margin: '8px 0 0 0', color: 'var(--muted)', fontSize: 11, opacity: 0.8 }}>
            Commentary only — not a recommendation to buy, sell, or hold.
          </p>
        </div>
      )}

      {TIER_ORDER.map(tier => (
        <div key={tier} style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: 'var(--text)' }}>{TIER_LABEL[tier]}</h2>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '9px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em', width: 36 }}>Rank</th>
                  <th style={{ padding: '9px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Symbol</th>
                  <th style={{ padding: '9px 14px', textAlign: 'right', color: 'var(--muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }}>1Y Return</th>
                </tr>
              </thead>
              <tbody>
                {byTier[tier].length === 0 && (
                  <tr><td colSpan={3} style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--muted)' }}>No ranked symbols for this tier this month.</td></tr>
                )}
                {byTier[tier].map(r => (
                  <tr key={r.symbol} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '9px 14px', color: 'var(--muted)' }}>{r.rank}</td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text)' }}>{r.symbol}</span>
                      {r.company_name && <span style={{ color: 'var(--muted)', fontSize: 12 }}> · {r.company_name}</span>}
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{fmtPct(r.trailing_return_1y)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {!!weightedTop50?.length && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>Top 50 — Weighted Return</h2>
          <p style={{ color: 'var(--muted)', fontSize: 12.5, marginBottom: 10, lineHeight: 1.5 }}>
            One combined list across all cap sizes, not split by tier. Weighted 50% on the trailing 13-week return, 30% on 26-week, 20% on 52-week — recent performance counts more, in the same spirit as "weighted alpha" indicators used elsewhere, without claiming to beat the market (it's not measured against any index).
          </p>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '9px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em', width: 36 }}>Rank</th>
                  <th style={{ padding: '9px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Symbol</th>
                  <th style={{ padding: '9px 14px', textAlign: 'right', color: 'var(--muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Weighted Score</th>
                </tr>
              </thead>
              <tbody>
                {weightedTop50.slice(0, 50).map(r => (
                  <tr key={r.symbol} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '9px 14px', color: 'var(--muted)' }}>{r.rank}</td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text)' }}>{r.symbol}</span>
                      {r.company_name && <span style={{ color: 'var(--muted)', fontSize: 12 }}> · {r.company_name}</span>}
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{fmtPct(r.weighted_score)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6 }}>
        Ranked by trailing 1-year price return, computed identically for every tracked symbol from public market data. Cap tier (large/mid/small) is classified from live market capitalization at scoring time. The Top 50 combined list (if shown) uses a separate, recency-weighted blend of trailing returns. Both are historical performance only — not tailored to any individual and not a signal to act now. Not financial advice.
      </p>
    </div>
  )
}
