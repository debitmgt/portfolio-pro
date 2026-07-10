// lib/email/newsletter-templates.ts
//
// Hand-rolled HTML (not a templating library — inline styles because email
// clients ignore stylesheets) for the two newsletter emails:
//   - Top 25 (free): three Top 25 lists — large cap, mid cap, small cap —
//     from monthly_rankings, identical for every free subscriber.
//   - Watchlist digest (Pro): monthly_rankings filtered down to a Pro user's
//     own watchlist_items, grouped by the same three tiers. Same underlying
//     ranked data as the free email — selection, not computation, is what's
//     personalized. See Ownfolio_Publishers_Exclusion_Attorney_Memo_v2.docx.
//
// Both emails carry the CAN-SPAM basics: a physical mailing address (from
// NEWSLETTER_MAILING_ADDRESS — must be set, see note below) and a working
// one-click unsubscribe link.
import type { MonthlyRanking, CapTier, NewsletterEditorial, WeightedReturnRanking } from '@/lib/supabase/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ownfolio.net'

// CAN-SPAM requires a valid physical postal address in every commercial
// email. This is NOT something Claude can fill in — Dwight needs to set
// NEWSLETTER_MAILING_ADDRESS (Vercel env var) to a real address before the
// send route is used for anything beyond testing.
const MAILING_ADDRESS = process.env.NEWSLETTER_MAILING_ADDRESS
  ?? '[SET NEWSLETTER_MAILING_ADDRESS ENV VAR — CAN-SPAM requires a real physical mailing address here]'

const TIER_LABEL: Record<CapTier, string> = {
  large: 'Large Cap Top 25',
  mid: 'Mid Cap Top 25',
  small: 'Small Cap Top 25',
}

const TIER_ORDER: CapTier[] = ['large', 'mid', 'small']

function fmtPct(v: number | null): string {
  if (v == null) return '—'
  // Finnhub's 52WeekPriceReturnDaily is already a plain percent value (e.g.
  // 25.43 means 25.43%), not a fraction — no rescaling needed.
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}%`
}

function periodTitle(periodLabel: string): string {
  const [y, m] = periodLabel.split('-').map(Number)
  const d = new Date(Date.UTC(y, (m ?? 1) - 1, 1))
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

interface SectionRow { rank: number; symbol: string; name: string | null; returnPct: string }
interface Section { title: string; note?: string; rows: SectionRow[] }

function renderSectionTable(section: Section): string {
  const rowsHtml = section.rows.length
    ? section.rows.map(r => `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #2a2d36;color:#8a8f9c;font-size:13px;width:36px;">${r.rank}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #2a2d36;">
            <span style="color:#f2f3f5;font-weight:700;font-size:14px;">${r.symbol}</span>
            ${r.name ? `<span style="color:#8a8f9c;font-size:12px;"> · ${r.name}</span>` : ''}
          </td>
          <td style="padding:10px 8px;border-bottom:1px solid #2a2d36;text-align:right;color:#ff6a00;font-weight:700;font-size:14px;">${r.returnPct}</td>
        </tr>`).join('')
    : `<tr><td colspan="3" style="padding:16px 8px;color:#8a8f9c;font-size:13px;">No ranked symbols to show this month.</td></tr>`

  return `
    <tr><td style="padding:20px 24px 4px 24px;">
      <h2 style="margin:0 0 2px 0;color:#f2f3f5;font-size:15px;">${section.title}</h2>
      ${section.note ? `<p style="margin:0 0 10px 0;color:#8a8f9c;font-size:12px;line-height:1.5;">${section.note}</p>` : ''}
    </td></tr>
    <tr><td style="padding:0 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <th align="left" style="padding:0 8px 8px 8px;color:#8a8f9c;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">Rank</th>
          <th align="left" style="padding:0 8px 8px 8px;color:#8a8f9c;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">Symbol</th>
          <th align="right" style="padding:0 8px 8px 8px;color:#8a8f9c;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">1Y Return</th>
        </tr>
        ${rowsHtml}
      </table>
    </td></tr>`
}

// ─── Combined Top 50, recency-weighted return ────────────────────────────────
// Separate renderer from the tiered Top 25 tables: the column is a blended
// score, not a plain 1-year return, so it gets its own header + disclosed
// weighting note rather than reusing renderSectionTable.
interface WeightedRow { rank: number; symbol: string; name: string | null; scoreStr: string }

function renderWeightedSectionTable(rows: WeightedRow[]): string {
  const rowsHtml = rows.length
    ? rows.map(r => `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #2a2d36;color:#8a8f9c;font-size:13px;width:36px;">${r.rank}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #2a2d36;">
            <span style="color:#f2f3f5;font-weight:700;font-size:14px;">${r.symbol}</span>
            ${r.name ? `<span style="color:#8a8f9c;font-size:12px;"> · ${r.name}</span>` : ''}
          </td>
          <td style="padding:10px 8px;border-bottom:1px solid #2a2d36;text-align:right;color:#ff6a00;font-weight:700;font-size:14px;">${r.scoreStr}</td>
        </tr>`).join('')
    : `<tr><td colspan="3" style="padding:16px 8px;color:#8a8f9c;font-size:13px;">No ranked symbols to show this month.</td></tr>`

  return `
    <tr><td style="padding:20px 24px 4px 24px;">
      <h2 style="margin:0 0 2px 0;color:#f2f3f5;font-size:15px;">Top 50 — Weighted Return</h2>
      <p style="margin:0 0 10px 0;color:#8a8f9c;font-size:12px;line-height:1.5;">One combined list across all cap sizes, not split by tier. Weighted 50% on the trailing 13-week return, 30% on 26-week, 20% on 52-week — recent performance counts more, in the same spirit as "weighted alpha" indicators used elsewhere, without claiming to beat the market (it's not measured against any index).</p>
    </td></tr>
    <tr><td style="padding:0 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <th align="left" style="padding:0 8px 8px 8px;color:#8a8f9c;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">Rank</th>
          <th align="left" style="padding:0 8px 8px 8px;color:#8a8f9c;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">Symbol</th>
          <th align="right" style="padding:0 8px 8px 8px;color:#8a8f9c;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">Weighted Score</th>
        </tr>
        ${rowsHtml}
      </table>
    </td></tr>`
}

function renderEditorial(editorial: NewsletterEditorial | null): string {
  if (!editorial) return ''
  return `
    <tr><td style="padding:20px 24px 0 24px;">
      <div style="background:#1a1d24;border:1px solid #2a2d36;border-left:3px solid #ff6a00;border-radius:6px;padding:14px 16px;">
        <div style="font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:#ff6a00;font-weight:700;margin-bottom:6px;">This Month's Spotlight${editorial.symbol ? ` · ${editorial.symbol}` : ''}</div>
        <div style="color:#f2f3f5;font-size:14px;font-weight:700;margin-bottom:6px;">${editorial.headline}</div>
        <p style="margin:0;color:#b6bac4;font-size:13px;line-height:1.6;">${editorial.body}</p>
        <p style="margin:8px 0 0 0;color:#6b6f7a;font-size:11px;">Commentary only — not a recommendation to buy, sell, or hold.</p>
      </div>
    </td></tr>`
}

function baseLayout(opts: {
  preheader: string
  title: string
  intro: string
  editorial?: NewsletterEditorial | null
  sections: Section[]
  extraSectionsHtml?: string
  methodologyNote: string
  unsubscribeUrl: string
}): string {
  const { preheader, title, intro, editorial, sections, extraSectionsHtml, methodologyNote, unsubscribeUrl } = opts

  const sectionsHtml = sections.map(renderSectionTable).join('') + (extraSectionsHtml ?? '')

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0e0f13;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <span style="display:none;font-size:1px;color:#0e0f13;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e0f13;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#14161c;border:1px solid #2a2d36;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:24px 24px 8px 24px;">
          <div style="font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:#8a8f9c;font-weight:600;">Ownfolio LLC</div>
          <h1 style="margin:8px 0 4px 0;color:#f2f3f5;font-size:20px;">${title}</h1>
          <p style="margin:0 0 4px 0;color:#b6bac4;font-size:13px;line-height:1.6;">${intro}</p>
        </td></tr>
        ${renderEditorial(editorial ?? null)}
        ${sectionsHtml}
        <tr><td style="padding:20px 24px 24px 24px;">
          <p style="margin:0;color:#6b6f7a;font-size:11px;line-height:1.6;">${methodologyNote}</p>
          <p style="margin:16px 0 0 0;color:#6b6f7a;font-size:11px;line-height:1.6;">
            <strong style="color:#8a8f9c;">Disclosure</strong><br/>
            This newsletter is a general, impersonal publication based solely on historical market data. It is not tailored to your objectives, financial situation, or portfolio, and does not provide investment advice, legal advice, tax advice, or a recommendation to buy, sell, or hold any security. Ownfolio LLC does not act as an investment adviser or broker and does not evaluate the suitability of any security or strategy for any person. Past performance is not indicative of future results; investing involves risk, including possible loss of principal.
          </p>
          <p style="margin:10px 0 0 0;color:#6b6f7a;font-size:11px;line-height:1.6;">
            <a href="${APP_URL}/disclaimer" style="color:#8a8f9c;">Full disclaimer</a>.
          </p>
        </td></tr>
      </table>
      <table role="presentation" width="100%" style="max-width:560px;">
        <tr><td style="padding:16px 24px;text-align:center;">
          <p style="margin:0;color:#4a4d57;font-size:11px;line-height:1.6;">
            ${MAILING_ADDRESS}<br/>
            <a href="${unsubscribeUrl}" style="color:#6b6f7a;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── Free: three Top 25s (large/mid/small cap) + combined Top 50 ────────────
export function renderMultiTierTop25Email(opts: {
  periodLabel: string
  byTier: Record<CapTier, MonthlyRanking[]> // each already sorted + limited to top 25
  weightedTop50?: WeightedReturnRanking[]   // already sorted + limited to top 50
  editorial?: NewsletterEditorial | null
  unsubscribeToken: string
}): { subject: string; html: string } {
  const { periodLabel, byTier, weightedTop50, editorial, unsubscribeToken } = opts
  const monthTitle = periodTitle(periodLabel)

  const sections: Section[] = TIER_ORDER.map(tier => ({
    title: TIER_LABEL[tier],
    rows: (byTier[tier] ?? []).map(r => ({
      rank: r.rank,
      symbol: r.symbol,
      name: r.company_name,
      returnPct: fmtPct(r.trailing_return_1y),
    })),
  }))

  const extraSectionsHtml = weightedTop50?.length
    ? renderWeightedSectionTable(weightedTop50.map(r => ({
        rank: r.rank,
        symbol: r.symbol,
        name: r.company_name,
        scoreStr: fmtPct(r.weighted_score),
      })))
    : ''

  const html = baseLayout({
    preheader: `This month's Top 25 by trailing 1-year return — large, mid, and small cap`,
    title: `Top 25 — ${monthTitle}`,
    intro: `The 25 highest trailing 1-year total returns in each of three cap tiers — large, mid, and small — from Ownfolio LLC's tracked universe. Same lists, same methodology, for every free subscriber.`,
    editorial,
    sections,
    extraSectionsHtml,
    methodologyNote: `Ranked by trailing 1-year price return, computed identically for every tracked symbol on the 1st of each month from public market data. Cap tier (large/mid/small) is classified from live market capitalization at scoring time. The Top 50 combined list uses a separate, recency-weighted blend of trailing returns (see note above). Both are historical performance only — not tailored to you and not a signal to act now.`,
    unsubscribeUrl: `${APP_URL}/api/newsletter/unsubscribe?token=${unsubscribeToken}`,
  })

  return { subject: `Ownfolio LLC Top 25 — ${monthTitle}`, html }
}

// Double opt-in confirmation email — sent immediately on signup, before any
// ranking content goes out. Not a ranked-content email, so it skips baseLayout.
export function renderConfirmSubscriptionEmail(opts: { confirmToken: string }): { subject: string; html: string } {
  const confirmUrl = `${APP_URL}/api/newsletter/confirm?token=${opts.confirmToken}`
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#0e0f13;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e0f13;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:#14161c;border:1px solid #2a2d36;border-radius:8px;">
        <tr><td style="padding:24px;">
          <div style="font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:#8a8f9c;font-weight:600;">Ownfolio LLC</div>
          <h1 style="margin:8px 0 12px 0;color:#f2f3f5;font-size:18px;">Confirm your subscription</h1>
          <p style="margin:0 0 20px 0;color:#b6bac4;font-size:13px;line-height:1.6;">
            Click below to confirm you'd like the monthly Ownfolio LLC Top 25 — three ranked lists (large, mid, and small cap) of the 25 highest trailing 1-year returns from our tracked universe, plus a combined Top 50 recency-weighted list, sent once a month. Informational only, not financial advice.
          </p>
          <a href="${confirmUrl}" style="display:inline-block;background:#ff6a00;color:#14161c;font-weight:700;font-size:13px;padding:10px 18px;border-radius:6px;text-decoration:none;">Confirm subscription</a>
          <p style="margin:20px 0 0 0;color:#6b6f7a;font-size:11px;line-height:1.6;">
            Didn't request this? Ignore this email and you won't be subscribed.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
  return { subject: 'Confirm your Ownfolio LLC Top 25 subscription', html }
}

// ─── Pro: watchlist digest, grouped by the same three tiers ──────────────────
export function renderWatchlistDigestEmail(opts: {
  periodLabel: string
  allRankings: MonthlyRanking[] // full scored universe for the period, all tiers, any rank
  weightedTop50?: WeightedReturnRanking[]   // full combined Top 50 for the period
  watchlistSymbols: string[]
  editorial?: NewsletterEditorial | null
  unsubscribeToken: string
}): { subject: string; html: string } {
  const { periodLabel, allRankings, weightedTop50, watchlistSymbols, editorial, unsubscribeToken } = opts
  const monthTitle = periodTitle(periodLabel)

  const watchlistSet = new Set(watchlistSymbols.map(s => s.toUpperCase()))
  const matched = allRankings.filter(r => watchlistSet.has(r.symbol.toUpperCase()))
  const matchedWeighted = (weightedTop50 ?? []).filter(r => watchlistSet.has(r.symbol.toUpperCase()))

  // Only include tier sections that actually have a match — no point showing
  // an empty "Small Cap" header if nothing on the watchlist landed there.
  const sections: Section[] = TIER_ORDER
    .map(tier => ({
      title: TIER_LABEL[tier],
      rows: matched
        .filter(r => r.cap_tier === tier)
        .sort((a, b) => a.rank - b.rank)
        .map(r => ({
          rank: r.rank,
          symbol: r.symbol,
          name: r.company_name,
          returnPct: fmtPct(r.trailing_return_1y),
        })),
    }))
    .filter(section => section.rows.length > 0)

  const extraSectionsHtml = matchedWeighted.length
    ? renderWeightedSectionTable(
        matchedWeighted
          .sort((a, b) => a.rank - b.rank)
          .map(r => ({ rank: r.rank, symbol: r.symbol, name: r.company_name, scoreStr: fmtPct(r.weighted_score) }))
      )
    : ''

  const html = baseLayout({
    preheader: `Your watchlist's trailing 1-year performance this month`,
    title: `Your Watchlist — ${monthTitle}`,
    intro: `How the symbols on your watchlist ranked this month, out of Ownfolio LLC's full tracked universe, grouped by cap tier. Same ranking data and methodology as the public Top 25 — just filtered to the tickers you chose to follow.`,
    editorial,
    sections: sections.length ? sections : [{ title: 'Your Watchlist', rows: [] }],
    extraSectionsHtml,
    methodologyNote: `Ranked by trailing 1-year price return, computed identically for every tracked symbol on the 1st of each month from public market data, then filtered to your watchlist. Cap tier is classified from live market capitalization, not anything about your portfolio. The Top 50 section (if shown) uses the same recency-weighted blend as the public combined list. Nothing here is derived from your holdings, shares, or cost basis — it's the same published ranking every subscriber sees, narrowed to symbols you picked. Historical performance only, not a signal to act now. Manage your watchlist in the dashboard.`,
    unsubscribeUrl: `${APP_URL}/api/newsletter/unsubscribe?token=${unsubscribeToken}`,
  })

  return { subject: `Your Watchlist Digest — ${monthTitle}`, html }
}
