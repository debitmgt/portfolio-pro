'use client'
// components/ConcentrationCardGrid.tsx
import type { Holding } from '@/lib/supabase/types'

interface PriceMap { [symbol: string]: number }

export function ConcentrationCardGrid({
  holdings,
  prices,
  totalValue,
  colorMap,
}: {
  holdings: Holding[]
  prices: PriceMap
  totalValue: number
  colorMap: Record<string, string>
}) {
  const withWeight = holdings.map(h => {
    const price = prices[h.symbol]
    const value = (price ?? h.cost_basis) * h.shares
    const weight = totalValue > 0 ? (value / totalValue) * 100 : 0
    const ret = price ? (price - h.cost_basis) / h.cost_basis * 100 : null
    return { ...h, price, value, weight, ret }
  }).sort((a, b) => b.weight - a.weight)

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
        Add holdings in the Tracker tab to see concentration.
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
      {withWeight.map(h => (
        <div
          key={h.id}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)'
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          {/* Header: symbol + value / return */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: colorMap[h.symbol] || 'var(--accent)' }}>{h.symbol}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>${h.value.toFixed(0)} market value</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Return since purchase</div>
              <div style={{ fontWeight: 700, color: h.ret == null ? 'var(--muted)' : h.ret >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {h.ret != null ? `${h.ret >= 0 ? '+' : ''}${h.ret.toFixed(1)}%` : '—'}
              </div>
            </div>
          </div>

          {/* Share of portfolio */}
          <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Share of portfolio</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{h.weight.toFixed(1)}%</div>
          </div>
        </div>
      ))}
    </div>
  )
}
