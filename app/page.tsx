import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import HomeLedger, { PRICING, type TeaserTier } from './HomeLedger'
import FeatureTourVideo from '@/components/FeatureTourVideo'

export const dynamic = 'force-dynamic'


const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function prettyPeriod(label: string | null): string {
  if (!label) return ''
  const [y, m] = label.split('-')
  const idx = Number(m) - 1
  return MONTHS[idx] ? `${MONTHS[idx]} ${y}` : label
}

export default async function Home() {
  const supabase = await createServerClient()

  // Signed-in visitors never see the marketing page — same behaviour as before.
  const { data: { session } } = await supabase.auth.getSession()
  if (session) redirect('/dashboard')

  // Newest published month.
  const { data: latest } = await supabase
    .from('monthly_rankings')
    .select('period_label')
    .order('period_label', { ascending: false })
    .limit(1)
    .maybeSingle()

  const period: string | null = latest?.period_label ?? null

  // IMPORTANT: only ranks 1 and 25 are ever queried, so ranks 2-24 never reach
  // the browser at all. Do not widen this select to fetch all 25 and hide the
  // middle with CSS — the blur is a visual device, not a security boundary.
  const teaser: Record<string, TeaserTier> = {
    large: { first: null, last: null },
    mid: { first: null, last: null },
    small: { first: null, last: null },
  }

  if (period) {
    const { data: rows } = await supabase
      .from('monthly_rankings')
      .select('cap_tier, rank, symbol, company_name, trailing_return_1y')
      .eq('period_label', period)
      .in('rank', [1, 25])

    for (const r of rows ?? []) {
      const tier = teaser[r.cap_tier as keyof typeof teaser]
      if (!tier) continue
      const row = {
        rank: r.rank,
        symbol: r.symbol,
        // Supabase types company_name as nullable. Fall back to the ticker so a
        // missing name renders as the symbol rather than an empty cell.
        company_name: r.company_name ?? r.symbol,
        trailing_return_1y: Number(r.trailing_return_1y),
      }
      if (r.rank === 1) tier.first = row
      else tier.last = row
    }
  }

  const monthLabel = prettyPeriod(period)

  return (
    <div className="ofh">
      <style>{CSS}</style>

      <nav className="ofh-nav">
        <div className="ofh-wrap ofh-nav-in">
          <a className="ofh-mark" href="#top">Own<span>folio</span></a>
          <div className="ofh-nav-links">
            <a href="#rankings">Top 25</a>
            <a href="#features">Features</a>
            <a href="/pricing">Pricing</a>
          </div>
          <div className="ofh-nav-cta">
            <a className="ofh-btn ofh-btn-quiet" href="/auth/login">Sign in</a>
            <a className="ofh-btn ofh-btn-primary" href={PRICING}>See pricing</a>
          </div>
        </div>
      </nav>

      {/* ---------------- hero ---------------- */}
      <header className="ofh-hero" id="top">
        <div className="ofh-wrap ofh-hero-grid">
          <div>
            {monthLabel && (
              <p className="ofh-eyebrow">Monthly rankings — <span className="ofh-eyebrow-month">{monthLabel}</span></p>
            )}
            <h1>Ranks 2 through 24 are behind a free account.</h1>
            <p className="ofh-lede">
              Every month Ownfolio ranks the top 25 highest trailing 1-year
              returns in each market cap tier — large, mid, and small — using
              the same calculation for every stock. AI helps gather and
              process the underlying market data, but the ranking itself
              isn&apos;t AI-picked — it&apos;s a straight calculation, run the
              same way every month. The list is free. It just requires an
              account.
            </p>
            <div className="ofh-hero-cta">
              <a className="ofh-btn ofh-btn-primary ofh-btn-lg" href={PRICING}>
                See pricing
              </a>
            </div>
            <p className="ofh-fine">No card required · Email address only · Cancel any time</p>
          </div>

          <HomeLedger teaser={teaser} monthLabel={monthLabel} />
        </div>
      </header>

      {/* ---------------- feature tour video ---------------- */}
      {/* Reuses the hero's two-column grid (ofh-hero-grid) instead of
          centering the portrait video card alone in a full-width section —
          a centered 340px card left wide bands of empty space on either
          side on desktop. Text fills the other column instead. */}
      <section id="tour">
        <div className="ofh-wrap ofh-hero-grid">
          <div>
            <h2>See it in action</h2>
            <p className="ofh-lede">
              A quick look at tracking your own holdings inside Ownfolio —
              add what you own, watch it update live, and see how your
              actual allocation compares to the targets you set.
            </p>
          </div>

          <FeatureTourVideo />
        </div>
      </section>

      {/* ---------------- what free gets ---------------- */}
      <section id="rankings">
        <div className="ofh-wrap">
          <h2>What a free account opens up</h2>
          <p className="ofh-note">
            Available the minute you confirm your email. Nothing here expires into a trial.
          </p>
          <div className="ofh-cards">
            <div className="ofh-card">
              <h3>All 75 ranked names</h3>
              <p>
                The complete Top 25 for large, mid, and small cap — ranks, tickers,
                and trailing 1-year returns, published on the first of each month.
              </p>
            </div>
            <div className="ofh-card">
              <h3>Every past issue</h3>
              <p>
                The full archive of previous months, so you can see how the same
                methodology has read the market over time.
              </p>
            </div>
            <div className="ofh-card">
              <h3>Track {FREE_LIMIT} holdings</h3>
              <p>
                Add up to {FREE_LIMIT} positions and follow cost basis, market value,
                and return since purchase — plus returns, allocation, concentration,
                charts, news, and drawdown alerts, all on the free plan.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- tab matrix ---------------- */}
      <section id="features">
        <div className="ofh-wrap">
          <h2>Most of the dashboard is free.</h2>
          <p className="ofh-note">
            Eleven tabs. Eight of them work on the free plan. Ownfolio publishes data
            and analytics for people who already own their positions — nothing here is
            a buy or sell recommendation.
          </p>
          <div className="ofh-tabs">
            {TABS.map((t) => (
              <div className="ofh-tab" key={t.name}>
                <div className="ofh-tab-body">
                  <h3>{t.name}</h3>
                  <p>{t.desc}</p>
                </div>
                <span className={PRO_ONLY_TABS.includes(t.name) ? 'ofh-badge ofh-badge-pro' : 'ofh-badge ofh-badge-free'}>
                  {PRO_ONLY_TABS.includes(t.name) ? 'Pro' : 'Free'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- close ---------------- */}
      <section className="ofh-close">
        <div className="ofh-wrap">
          <h2>The next list publishes on the 1st.</h2>
          <p className="ofh-lede ofh-center">
            See pricing now, so you&apos;re ready the morning the next list goes out.
          </p>
          <a className="ofh-btn ofh-btn-primary ofh-btn-lg" href={PRICING}>
            See pricing
          </a>
        </div>
      </section>

      <footer className="ofh-foot">
        <div className="ofh-wrap">
          <div className="ofh-foot-links">
            <a href="/pricing">Pricing</a>
            <a href="/newsletter/archive">Past issues</a>
            <a href="/disclaimer">Disclaimer</a>
            <a href="/support">Support</a>
          </div>
          {/* Single source of truth for the attorney-approved language. Rendering the
              shared component rather than copying the text means this page cannot
              drift if the wording is ever revised. Do not inline a copy here. */}
          <div className="ofh-disclaimer-slot">
            <DisclaimerFooter />
          </div>
          <p className="ofh-copy">© {new Date().getFullYear()} Ownfolio LLC</p>
        </div>
      </footer>
    </div>
  )
}

// Mirrors app/dashboard/DashboardClient.tsx. FREE_LIMIT and PRO_ONLY_TABS are
// the values actually enforced there — if they change, change them here too.
// This page shows no prices — it links to /pricing, which renders from PLANS.
const FREE_LIMIT = 10
const PRO_ONLY_TABS = ['Fundamentals', 'Watchlist', 'Risk']

const TABS = [
  { name: 'Tracker', desc: 'Symbol, shares, cost per share, current price, market value, gain or loss, and trailing stop level.' },
  { name: 'My Returns', desc: 'Holdings sorted by return since your own purchase price.' },
  { name: 'Fundamentals', desc: 'Dividends, growth, valuation, profitability, and daily percentile scores per ticker.' },
  { name: 'Charts', desc: 'Portfolio allocation by symbol and gain/loss by position.' },
  { name: 'Allocation View', desc: 'Current holdings against the targets you set, with small positions flagged.' },
  { name: 'News', desc: 'Live headlines for each company you hold. Headlines only, no commentary.' },
  { name: 'Position Status', desc: 'How each position sits relative to its cost basis and stop threshold.' },
  { name: 'Concentration', desc: 'Share of portfolio per holding, and the same breakdown grouped by industry.' },
  { name: 'Drawdown Alerts', desc: "Notification when a position reaches the threshold you've set for it." },
  { name: 'Risk', desc: 'Per-holding and portfolio beta.' },
  { name: 'Watchlist', desc: "Names you're following but don't own yet, with live pricing." },
]

/* Every colour below resolves to a variable already defined in globals.css,
   so this page follows the rest of the site automatically. */
const CSS = `
.ofh{color:var(--text);background:var(--bg);font-size:16px;line-height:1.55}
.ofh *{box-sizing:border-box}
.ofh-wrap{max-width:1180px;margin:0 auto;padding:0 24px}
.ofh h1{font-size:clamp(34px,5.4vw,60px);line-height:1.03;letter-spacing:-.022em;font-weight:700;margin:0 0 20px}
.ofh h2{font-size:clamp(24px,3.2vw,36px);line-height:1.08;letter-spacing:-.018em;font-weight:700;margin:0 0 12px}
.ofh h3{font-size:16px;font-weight:600;margin:0 0 6px;letter-spacing:-.01em}
.ofh p{margin:0 0 16px}
.ofh a{color:inherit}
.ofh :focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:2px}
.ofh-eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:0 0 18px}
.ofh-eyebrow-month{color:var(--accent);font-weight:600}
.ofh-lede{font-size:17px;color:var(--muted);max-width:52ch}
.ofh-note{color:var(--muted);max-width:56ch;margin-bottom:34px}
.ofh-center{margin-left:auto;margin-right:auto;margin-bottom:26px}
.ofh-fine{font-size:12px;color:var(--muted-2);margin:16px 0 0}

.ofh-nav{position:sticky;top:0;z-index:50;background:var(--bg);border-bottom:1px solid var(--border)}
.ofh-nav-in{display:flex;align-items:center;gap:28px;height:64px}
.ofh-mark{font-size:20px;font-weight:700;letter-spacing:-.02em;text-decoration:none}
.ofh-mark span{color:var(--accent)}
.ofh-nav-links{display:flex;gap:22px;margin-left:auto;font-size:14px}
.ofh-nav-links a{text-decoration:none;color:var(--muted)}
.ofh-nav-links a:hover{color:var(--text)}
.ofh-nav-cta{display:flex;gap:10px;align-items:center}

.ofh-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:600;padding:11px 20px;border-radius:4px;border:1px solid transparent;text-decoration:none;cursor:pointer;transition:background .15s,border-color .15s,color .15s}
.ofh-btn-primary{background:var(--accent);color:#fff}
.ofh-btn-primary:hover{background:var(--accent-hover)}
.ofh-btn-ghost{border-color:var(--border);color:var(--text);background:transparent}
.ofh-btn-ghost:hover{border-color:var(--muted-2)}
.ofh-btn-quiet{color:var(--muted);padding:11px 0}
.ofh-btn-quiet:hover{color:var(--text)}
.ofh-btn-lg{padding:14px 26px;font-size:15px}

.ofh-hero{padding:72px 0 80px;border-bottom:1px solid var(--border)}
.ofh-hero-grid{display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:start}
.ofh-hero-cta{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:28px}

.ofh section{padding:74px 0;border-bottom:1px solid var(--border)}
.ofh-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.ofh-card{background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:24px}
.ofh-card p{color:var(--muted);font-size:14px;margin:0}

.ofh-tabs{display:grid;grid-template-columns:repeat(2,1fr);border:1px solid var(--border);border-radius:6px;overflow:hidden}
.ofh-tab{display:flex;align-items:flex-start;gap:14px;padding:18px 20px;border-bottom:1px solid var(--border);background:var(--bg)}
.ofh-tab:nth-child(odd){border-right:1px solid var(--border)}
.ofh-tab:nth-last-child(-n+2){border-bottom:none}
.ofh-tab-body{flex:1}
.ofh-tab-body p{font-size:13px;color:var(--muted);margin:0}
.ofh-badge{font-size:10px;letter-spacing:.1em;text-transform:uppercase;padding:4px 8px;border-radius:3px;white-space:nowrap;flex-shrink:0;margin-top:2px;font-weight:600}
.ofh-badge-free{background:var(--green-tint);color:var(--green)}
.ofh-badge-pro{background:var(--accent-tint);color:var(--accent)}

.ofh-close{text-align:center;padding:82px 0}
.ofh-close h2{max-width:16ch;margin-left:auto;margin-right:auto}

.ofh-foot{padding:42px 0 60px;color:var(--muted);font-size:13px}
.ofh-foot-links{display:flex;gap:20px;flex-wrap:wrap;margin-bottom:22px}
.ofh-foot-links a{text-decoration:none}
.ofh-foot-links a:hover{color:var(--text)}
.ofh-disclaimer-slot{max-width:78ch}
.ofh-copy{margin-top:22px;font-size:12px;color:var(--muted-2)}

@media (max-width:900px){
  .ofh-hero-grid{grid-template-columns:1fr;gap:40px}
  .ofh-cards{grid-template-columns:1fr}
  .ofh-tabs{grid-template-columns:1fr}
  .ofh-tab:nth-child(odd){border-right:none}
  .ofh-tab:nth-last-child(2){border-bottom:1px solid var(--border)}
  .ofh-nav-links{display:none}
  .ofh-hero{padding:48px 0 56px}
  .ofh section{padding:54px 0}
}
@media (max-width:520px){
  .ofh-nav-in{gap:12px}
  .ofh-btn{padding:10px 14px;font-size:13px}
  .ofh-wrap{padding:0 18px}
}
`
