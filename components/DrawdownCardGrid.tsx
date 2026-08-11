'use client'
// components/DrawdownCardGrid.tsx
import type { Holding } from '@/lib/supabase/types'

interface PriceMap { [symbol: string]: number }

export function DrawdownCardGrid({
  holdings,
  prices,
  highs,
  colorMap,
}: {
  holdings: Holding[]
  prices: PriceMap
  highs: PriceMap
  colorMap: Record<string, string>
}) {
  // Drawdown is measured from the stock's own 52-week high (public market
  // data), not from the user's cost basis. Purely factual - no action implied.
  const withDrawdown = holdings.map(h => {
    const price = prices[h.symbol]
    const high = highs[h.symbol]
    const hasData = price != null && high != null && high > 0

    // How far below its 52-week high the stock currently sits.
    const drawdownPct = hasData ? ((high - price) / high) * 100 : null
    // The price at which the drawdown would equal the user's chosen trail %.
    const thresholdPrice = hasData ? high * (1 - h.trail_pct / 100) : null
    const belowThreshold = hasData && drawdownPct != null && drawdownPct >= h.trail_pct
    // Percentage points of further decline before the threshold is reached.
    const roomPct = drawdownPct != null ? h.trail_pct - drawdownPct : null

    return { ...h, price, high, hasData, drawdownPct, thresholdPrice, belowThreshold, roomPct }
  }).sort((a, b) => (b.drawdownPct ?? -999) - (a.drawdownPct ?? -999))

  if (holdings.length === 0) {
    return (
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 40,
        textAlign: 'center',
        color: 'var(--muted)',
      }}>
        No holdings to monitor.
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
      {withDrawdown.map(h => {
        const color = !h.hasData ? 'var(--muted)' : h.belowThreshold ? 'var(--red)' : 'var(--green)'

        // Bar fills as the stock falls toward the threshold. 0% = at its high,
        // 100% = at or past the threshold. This moves independently per stock.
        const fillPct = h.drawdownPct != null && h.trail_pct > 0
          ? Math.max(0, Math.min(100, (h.drawdownPct / h.trail_pct) * 100))
          : 0
        const near = h.roomPct != null && h.roomPct <= 2

        return (
          <div
            key={h.id}
            style={{
              background: h.belowThreshold ? 'var(--red-tint)' : 'var(--surface)',
              border: '1px solid var(--border)',
              borderLeft: `4px solid ${color}`,
              borderRadius: 8,
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)' }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none' }}
          >
            {/* Header: symbol + neutral threshold badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 17, color: colorMap[h.symbol] || 'var(--accent)' }}>{h.symbol}</div>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 3,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                background: !h.hasData ? 'var(--border)' : h.belowThreshold ? 'var(--red)' : 'var(--green-tint)',
                color: !h.hasData ? 'var(--muted)' : h.belowThreshold ? '#fff' : 'var(--green)',
              }}>
                {!h.hasData ? 'No Data' : h.belowThreshold ? 'Below Threshold' : 'Above Threshold'}
              </span>
            </div>

            {/* Drawdown from 52-week high */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                <span>Below 52-week high</span>
                <span style={{ color: h.belowThreshold || near ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                  {h.drawdownPct != null ? `${Math.max(0, h.drawdownPct).toFixed(1)}%` : '—'}
                </span>
              </div>
              <div style={{ background: 'var(--border)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div style={{
                  width: `${fillPct}%`,
                  height: '100%',
                  background: h.belowThreshold || near ? 'var(--red)' : 'var(--green)',
                  borderRadius: 4,
                  transition: 'width .3s',
                }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 5 }}>
                {h.roomPct == null
                  ? 'Awaiting price data'
                  : h.roomPct > 0
                    ? `${h.roomPct.toFixed(1)} points from your ${h.trail_pct}% threshold`
                    : `${Math.abs(h.roomPct).toFixed(1)} points past your ${h.trail_pct}% threshold`}
              </div>
            </div>

            {/* Detail numbers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Current Price</div>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{h.price ? `$${h.price.toFixed(2)}` : '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>52-Week High</div>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{h.high ? `$${h.high.toFixed(2)}` : '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Threshold Price</div>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{h.thresholdPrice ? `$${h.thresholdPrice.toFixed(2)}` : '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Your Threshold</div>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{h.trail_pct}%</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
