// components/MarketNewsFeed.tsx
// Public, generic market headlines for the pricing/landing page — the same
// content for every visitor, logged in or not. Deliberately NOT the same
// data path as the dashboard's per-holding News tab:
//   - Dashboard News tab: authenticated, per-symbol, /api/finnhub?type=news
//     (see app/api/finnhub/route.ts), called from the browser by a logged-in
//     user viewing their own holdings.
//   - This feed: unauthenticated, broad-market, fetched directly here as an
//     async Server Component during render. No client fetch, no API route,
//     no personalization of any kind — about as generic as content gets
//     under the publisher's-exclusion framing (see
//     Ownfolio_Publishers_Exclusion_Attorney_Memo_v2.docx): identical
//     headlines for every visitor, verbatim from Finnhub, no commentary.
//
// Caching: this renders on every /pricing page view, including anonymous
// traffic, so it leans on Next's fetch cache (`next: { revalidate }`) rather
// than calling Finnhub per-request — a 15-minute window keeps this well
// within Finnhub's free-tier rate limit even under real traffic, matching
// the cadence already used for the per-symbol News tab.
interface MarketNewsItem {
  headline: string
  source: string
  url: string
  datetime: number   // ms
  summary: string
}

async function fetchMarketNews(): Promise<MarketNewsItem[]> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return []

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/news?category=general&token=${key}`,
      { next: { revalidate: 900 } }   // 15 min — matches the per-symbol News tab's cadence
    )
    if (!res.ok) return []

    const raw: Array<{ headline: string; source: string; url: string; datetime: number; summary: string }> = await res.json()

    return (Array.isArray(raw) ? raw : [])
      .filter(a => a.headline && a.url)
      .sort((a, b) => b.datetime - a.datetime)
      .slice(0, 6)
      .map(a => ({
        headline: a.headline,
        source: a.source,
        url: a.url,
        datetime: a.datetime * 1000,   // Finnhub returns seconds; JS Date wants ms
        summary: a.summary,
      }))
  } catch {
    return []
  }
}

function timeAgo(ms: number): string {
  const mins = Math.floor((Date.now() - ms) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default async function MarketNewsFeed() {
  const items = await fetchMarketNews()
  if (items.length === 0) return null   // fail quiet — this is a nice-to-have, not core to the page

  return (
    <div style={{ width: '100%', maxWidth: 720, marginBottom: 52 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Market headlines</h2>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Same for every visitor · not commentary</span>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((item, i) => (
          <a
            key={`${item.url}-${i}`}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'block', padding: '12px 16px', borderRadius: 8,
              background: 'var(--surface)', border: '1px solid var(--border)', color: 'inherit',
            }}
          >
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 3, lineHeight: 1.35, color: 'var(--text)' }}>{item.headline}</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{item.source} · {timeAgo(item.datetime)}</div>
          </a>
        ))}
      </div>
      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, opacity: 0.8 }}>
        Public market headlines from Finnhub · Informational only, not investment advice.
      </p>
    </div>
  )
}
