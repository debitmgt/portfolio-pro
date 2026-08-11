'use client'
// components/PositionStatusCardGrid.tsx
import type { Holding } from '@/lib/supabase/types'

interface PriceMap { [symbol: string]: number }

type SignalState = 'DOWN' | 'UP_STRONG' | 'UP' | 'NO_DATA'

// Position Status compares each holding to the user's own cost basis only.
// Drawdown from a stock's 52-week high lives in the Drawdown Alerts tab so the
// two views measure genuinely different things.
function getSignal(h: Holding, price: number | undefined): { state: SignalState; label: string; reason: string } {
  if (!price) return { state: 'NO_DATA', label: 'NO DATA', reason: 'Awaiting price data' }
  const ret = (price - h.cost_basis) / h.cost_basis * 100
  if (ret < -15) return { state: 'DOWN', label: 'DOWN', reason: `Down ${ret.toFixed(1)}% from cost basis` }
  if (ret > 30) return { state: 'UP_STRONG', label: 'UP STRONG', reason: `Up ${ret.toFixed(1)}% from cost basis` }
  if (ret >= 0) return { state: 'UP', label: 'UP', reason: `Up ${ret.toFixed(1)}%  -  within normal range` }
  return { state: 'DOWN', label: 'DOWN', reason: `Down ${ret.toFixed(1)}% from cost basis` }
}

const stateColor: Record<SignalState, string> = {
  DOWN: 'var(--red)',
  UP_STRONG: 'var(--green)',
  UP: 'var(--accent)',
  NO_DATA: 'var(--muted)',
}

export function PositionStatusCardGrid({
  holdings,
  prices,
  colorMap,
}: {
  holdings: Holding[]
  prices: PriceMap
  colorMap: Record<string, string>
}) {
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
        Add holdings in the Tracker tab to see position status.
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
      {holdings.map(h => {
        const { state, label, reason } = getSignal(h, prices[h.symbol])
        const price = prices[h.symbol]
        const color = stateColor[state]

        return (
          <div
            key={h.id}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderLeft: `4px solid ${color}`,
              borderRadius: 8,
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)' }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none' }}
          >
            {/* Header: symbol + status badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: colorMap[h.symbol] || 'var(--accent)' }}>{h.symbol}</div>
              <div style={{
                background: color,
                color: '#fff',
                fontWeight: 800,
                fontSize: 12,
                padding: '5px 14px',
                borderRadius: 3,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                flexShrink: 0,
              }}>
                {label}
              </div>
            </div>

            {/* Reason */}
            <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.4 }}>{reason}</div>

            {/* Supporting numbers */}
            <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div>
                <span style={{ color: 'var(--muted)' }}>Current: </span>
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{price ? `$${price.toFixed(2)}` : '—'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--muted)' }}>Cost: </span>
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>${h.cost_basis.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
