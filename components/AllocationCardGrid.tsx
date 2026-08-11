'use client'
// components/AllocationCardGrid.tsx
import type { Holding } from '@/lib/supabase/types'

interface PriceMap { [symbol: string]: number }

export function AllocationCardGrid({
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
  if (holdings.length === 0) return null

  const withWeights = holdings.map(h => {
    const value = (prices[h.symbol] ?? h.cost_basis) * h.shares
    const weight = totalValue > 0 ? (value / totalValue) * 100 : 0
    const ret = prices[h.symbol] ? (prices[h.symbol] - h.cost_basis) / h.cost_basis * 100 : 0
    return { ...h, value, weight, ret }
  }).sort((a, b) => b.weight - a.weight)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
      {withWeights.map(h => {
        const color = colorMap[h.symbol] || 'var(--accent)'
        const retColor = h.ret >= 0 ? 'var(--green)' : 'var(--red)'

        return (
          <div
            key={h.id}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
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
            {/* Symbol */}
            <div style={{ fontSize: 15, fontWeight: 700, color }}>{h.symbol}</div>

            {/* Big weight % */}
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
              {h.weight.toFixed(1)}%
            </div>

            {/* Weight bar */}
            <div style={{ background: 'var(--border)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
              <div style={{ width: `${h.weight}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .3s' }} />
            </div>

            {/* Value + return */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Value</div>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>${h.value.toFixed(0)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Return</div>
                <div style={{ fontWeight: 600, color: retColor }}>{h.ret >= 0 ? '+' : ''}{h.ret.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
