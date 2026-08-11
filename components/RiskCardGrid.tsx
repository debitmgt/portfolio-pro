'use client'
// components/RiskCardGrid.tsx
import type { Holding } from '@/lib/supabase/types'

interface PriceMap { [symbol: string]: number }

export function RiskCardGrid({
  holdings,
  prices,
  betaMap,
  colorMap,
}: {
  holdings: Holding[]
  prices: PriceMap
  betaMap: Record<string, number | null>
  colorMap: Record<string, string>
}) {
  const sorted = [...holdings].sort((a, b) => {
    const ba = betaMap[a.symbol] ?? -Infinity
    const bb = betaMap[b.symbol] ?? -Infinity
    return bb - ba
  })

  if (holdings.length === 0) return null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
      {sorted.map(h => {
        const beta = betaMap[h.symbol]
        // Above 1 = more volatile than market (amber), below 1 = calmer (green), unknown = muted
        const betaColor = beta == null ? 'var(--muted)' : beta > 1 ? 'var(--accent)' : 'var(--green)'

        return (
          <div
            key={h.symbol}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
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
            <div style={{ fontSize: 15, fontWeight: 700, color: colorMap[h.symbol] || 'var(--accent)' }}>{h.symbol}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Beta</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: betaColor, lineHeight: 1 }}>
              {beta != null ? beta.toFixed(2) : '—'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              {beta == null ? 'No data' : beta > 1 ? 'More volatile than market' : 'Less volatile than market'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
