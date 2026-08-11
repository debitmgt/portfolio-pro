'use client'

import { useState } from 'react'
// Shared by this file and app/page.tsx. Defined here, in the client component,
// so the server page can import it without dragging server-only modules
// (createServerClient / next/headers) into the browser bundle.
export const SIGNUP = '/auth/login?mode=signup'

export type TeaserRow = {
  rank: number
  symbol: string
  company_name: string
  trailing_return_1y: number
}

export type TeaserTier = { first: TeaserRow | null; last: TeaserRow | null }

const TIERS = [
  { key: 'large', label: 'Large' },
  { key: 'mid', label: 'Mid' },
  { key: 'small', label: 'Small' },
] as const

// Filler for the locked rows. Deliberately NOT real tickers: the middle ranks
// are never sent to the browser, so there is nothing here to un-blur.
const LOCKED_ROWS = 6

function fmtReturn(v: number): string {
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}%`
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export default function HomeLedger({
  teaser,
  monthLabel,
}: {
  teaser: Record<string, TeaserTier>
  monthLabel: string
}) {
  const [tier, setTier] = useState<string>('large')
  const active = teaser[tier] ?? { first: null, last: null }

  const renderRow = (
    rank: string,
    symbol: string,
    name: string,
    ret: number | null,
    locked: boolean,
  ) => (
    <div
      className={locked ? 'ofl-row ofl-locked' : 'ofl-row'}
      key={`${rank}-${symbol}-${locked}`}
      aria-hidden={locked || undefined}
    >
      <span className="ofl-rank">{rank}</span>
      <span className="ofl-tkr">
        {symbol}
        <span className="ofl-name">{name}</span>
      </span>
      <span
        className="ofl-ret"
        style={ret !== null && ret < 0 ? { color: 'var(--red)' } : undefined}
      >
        {ret === null ? '——.—%' : fmtReturn(ret)}
      </span>
    </div>
  )

  return (
    <div className="ofl">
      <style>{CSS}</style>

      <div className="ofl-head">
        <span className="ofl-title">
          Top 25 · 1-year return{monthLabel ? ` · ${monthLabel}` : ''}
        </span>
        {TIERS.map((t) => (
          <button
            key={t.key}
            className="ofl-tier"
            aria-pressed={tier === t.key}
            onClick={() => setTier(t.key)}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="ofl-cols">
        <span>Rank</span>
        <span>Company</span>
        <span>1Y</span>
      </div>

      <div>
        {active.first
          ? renderRow('01', active.first.symbol, active.first.company_name, active.first.trailing_return_1y, false)
          : renderRow('01', '———', 'Publishing shortly', null, false)}

        {Array.from({ length: LOCKED_ROWS }, (_, i) =>
          renderRow(pad(i + 2), '————', '——————————', null, true),
        )}

        {active.last
          ? renderRow('25', active.last.symbol, active.last.company_name, active.last.trailing_return_1y, false)
          : renderRow('25', '———', 'Publishing shortly', null, false)}
      </div>

      <div className="ofl-gate">
        <p>Ranks 2–24 unlock the moment you create an account.</p>
        <a className="ofh-btn ofh-btn-primary" href={SIGNUP}>Show me the full list</a>
        <p className="ofl-gate-fine">Free · includes all three cap tiers</p>
      </div>
    </div>
  )
}

const CSS = `
.ofl{background:var(--surface);border:1px solid var(--border);border-radius:6px;overflow:hidden}
.ofl-head{display:flex;align-items:center;gap:6px;padding:14px 16px;border-bottom:1px solid var(--border)}
.ofl-title{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-right:auto}
.ofl-tier{font-size:11px;letter-spacing:.06em;text-transform:uppercase;background:transparent;border:1px solid var(--border);color:var(--muted);padding:5px 10px;border-radius:3px;cursor:pointer;transition:.15s;font-weight:600}
.ofl-tier:hover{color:var(--text)}
.ofl-tier[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff}
.ofl-cols{display:grid;grid-template-columns:52px 1fr auto;gap:12px;padding:9px 16px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted-2);border-bottom:1px solid var(--border)}
.ofl-row{display:grid;grid-template-columns:52px 1fr auto;gap:12px;align-items:baseline;padding:13px 16px;border-bottom:1px solid var(--border)}
.ofl-rank{font-size:20px;line-height:1;font-weight:700;color:var(--muted-2);font-variant-numeric:tabular-nums}
.ofl-row:not(.ofl-locked) .ofl-rank{color:var(--accent)}
.ofl-tkr{font-size:15px;font-weight:700;letter-spacing:.02em}
.ofl-name{display:block;font-size:12px;color:var(--muted);font-weight:400;letter-spacing:0;margin-top:2px}
.ofl-ret{font-size:15px;font-weight:700;color:var(--green);font-variant-numeric:tabular-nums}
.ofl-locked .ofl-rank,.ofl-locked .ofl-tkr,.ofl-locked .ofl-ret,.ofl-locked .ofl-name{filter:blur(5px);user-select:none}
.ofl-gate{padding:26px 16px 24px;text-align:center;background:linear-gradient(180deg,rgba(255,255,255,0) 0%,var(--surface) 46%);margin-top:-70px;position:relative}
.ofl-gate p{font-size:14px;color:var(--text);margin:0 auto 14px;max-width:34ch}
.ofl-gate-fine{font-size:11px;color:var(--muted-2);margin:12px auto 0}
@media (prefers-reduced-motion:reduce){.ofl *{transition:none}}
`
