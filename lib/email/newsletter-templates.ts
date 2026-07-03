// lib/email/newsletter-templates.ts
//
// Hand-rolled HTML (not a templating library — inline styles because email
// clients ignore stylesheets) for the two newsletter emails:
//   - Top 25 (free): the full monthly_rankings top 25, identical for every
//     free subscriber.
//   - Watchlist digest (Pro): monthly_rankings filtered down to a Pro user's
//     own watchlist_items, sorted by rank. Same underlying ranked data as the
//     free email — selection, not computation, is what's personalized. See
//     Ownfolio_Publishers_Exclusion_Attorney_Memo.docx.
//
// Both emails carry the CAN-SPAM basics: a physical mailing address (from
// NEWSLETTER_MAILING_ADDRESS — must be set, see note below) and a working
// one-click unsubscribe link.
import type { MonthlyRanking } from '@/lib/supabase/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ownfolio.net'

// CAN-SPAM requires a valid physical postal address in every commercial
// email. This is NOT something Claude can fill in — Dwight needs to set
// NEWSLETTER_MAILING_ADDRESS (Vercel env var) to a real address before the
// send route is used for anything beyond testing.
const MAILING_ADDRESS = process.env.NEWSLETTER_MAILING_ADDRESS
  ?? '[SET NEWSLETTER_MAILING_ADDRESS ENV VAR — CAN-SPAM requires a real physical mailing address here]'

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

function baseLayout(opts: {
  preheader: string
  title: string
  intro: string
  rows: { rank: number; symbol: string; name: string | null; returnPct: string }[]
  methodologyNote: string
  unsubscribeUrl: string
}): string {
  const { preheader, title, intro, rows, methodologyNote, unsubscribeUrl } = opts

  const rowsHtml = rows.length
    ? rows.map(r => `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #2a2d36;color:#8a8f9c;font-size:13px;width:36px;">${r.rank}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #2a2d36;">
            <span style="color:#f2f3f5;font-weight:700;font-size:14px;">${r.symbol}</span>
            ${r.name ? `<span style="color:#8a8f9c;font-size:12px;"> · ${r.name}</span>` : ''}
          </td>
          <td style="padding:10px 8px;border-bottom:1px solid #2a2d36;text-align:right;color:#ff6a00;font-weight:700;font-size:14px;">${r.returnPct}</td>
        </tr>`).join('')
    : `<tr><td colspan="3" style="padding:16px 8px;color:#8a8f9c;font-size:13px;">No ranked symbols to show this month.</td></tr>`

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0e0f13;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <span style="display:none;font-size:1px;color:#0e0f13;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e0f13;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#14161c;border:1px solid #2a2d36;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:24px 24px 8px 24px;">
          <div style="font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:#8a8f9c;font-weight:600;">Ownfolio</div>
          <h1 style="margin:8px 0 4px 0;color:#f2f3f5;font-size:20px;">${title}</h1>
          <p style="margin:0 0 16px 0;color:#b6bac4;font-size:13px;line-height:1.6;">${intro}</p>
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
        </td></tr>
        <tr><td style="padding:16px 24px 24px 24px;">
          <p style="margin:0;color:#6b6f7a;font-size:11px;line-height:1.6;">${methodologyNote}</p>
          <p style="margin:12px 0 0 0;color:#6b6f7a;font-size:11px;line-height:1.6;">
            This is a description of past performance, not a recommendation to buy, sell, or hold any security. Not financial advice.
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

export function renderTop25Email(opts: {
  periodLabel: string
  rankings: MonthlyRanking[] // pre-sorted by rank, already limited to top 25
  unsubscribeToken: string
}): { subject: string; html: string } {
  const { periodLabel, rankings, unsubscribeToken } = opts
  const monthTitle = periodTitle(periodLabel)

  const rows = rankings.map(r => ({
    rank: r.rank,
    symbol: r.symbol,
    name: r.company_name,
    returnPct: fmtPct(r.trailing_return_1y),
  }))

  const html = baseLayout({
    preheader: `This month's Top 25 by trailing 1-year return`,
    title: `Top 25 — ${monthTitle}`,
    intro: `The 25 highest trailing 1-year total returns from Ownfolio's tracked universe this month. Same list, same methodology, for every free subscriber.`,
    rows,
    methodologyNote: `Ranked by trailing 1-year price return, computed identically for every tracked symbol on the 1st of each month from public market data. This is historical performance only — it is not tailored to you and is not a signal to act now.`,
    unsubscribeUrl: `${APP_URL}/api/newsletter/unsubscribe?token=${unsubscribeToken}`,
  })

  return { subject: `Ownfolio Top 25 — ${monthTitle}`, html }
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
          <div style="font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:#8a8f9c;font-weight:600;">Ownfolio</div>
          <h1 style="margin:8px 0 12px 0;color:#f2f3f5;font-size:18px;">Confirm your subscription</h1>
          <p style="margin:0 0 20px 0;color:#b6bac4;font-size:13px;line-height:1.6;">
            Click below to confirm you'd like the monthly Ownfolio Top 25 — a ranked list of the 25 highest trailing 1-year returns from our tracked universe, sent once a month. Informational only, not financial advice.
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
  return { subject: 'Confirm your Ownfolio Top 25 subscription', html }
}

export function renderWatchlistDigestEmail(opts: {
  periodLabel: string
  allRankings: MonthlyRanking[] // full scored universe for the period, any rank
  watchlistSymbols: string[]
  unsubscribeToken: string
}): { subject: string; html: string } {
  const { periodLabel, allRankings, watchlistSymbols, unsubscribeToken } = opts
  const monthTitle = periodTitle(periodLabel)

  const watchlistSet = new Set(watchlistSymbols.map(s => s.toUpperCase()))
  const matched = allRankings
    .filter(r => watchlistSet.has(r.symbol.toUpperCase()))
    .sort((a, b) => a.rank - b.rank)

  const rows = matched.map(r => ({
    rank: r.rank,
    symbol: r.symbol,
    name: r.company_name,
    returnPct: fmtPct(r.trailing_return_1y),
  }))

  const html = baseLayout({
    preheader: `Your watchlist's trailing 1-year performance this month`,
    title: `Your Watchlist — ${monthTitle}`,
    intro: `How the symbols on your watchlist ranked this month, out of Ownfolio's full tracked universe. Same ranking data and methodology as the public Top 25 — just filtered to the tickers you chose to follow.`,
    rows,
    methodologyNote: `Ranked by trailing 1-year price return, computed identically for every tracked symbol on the 1st of each month from public market data, then filtered to your watchlist. Nothing here is derived from your holdings, shares, or cost basis — it's the same published ranking every subscriber sees, narrowed to symbols you picked. Historical performance only, not a signal to act now. Manage your watchlist in the dashboard.`,
    unsubscribeUrl: `${APP_URL}/api/newsletter/unsubscribe?token=${unsubscribeToken}`,
  })

  return { subject: `Your Watchlist Digest — ${monthTitle}`, html }
}
