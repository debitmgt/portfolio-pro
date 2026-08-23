'use client'
// components/ReturnsCardGrid.tsx
import { useMemo } from 'react'
import type { Holding } from '@/lib/supabase/types'

interface PriceMap { [symbol: string]: number }

function AreaSparkline({ costBasis, currentPrice, isGain }: { costBasis: number; currentPrice: number; isGain: boolean }) {
  const points = []
  for (let i = 0; i < 14; i++) {
    const progress = i / 13
    const price = costBasis + (currentPrice - costBasis) * progress
    points.push(price)
  }

  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1

  const pathPoints = points.map((val, idx) => {
    const x = (idx / 13) * 160
    const y = 50 - ((val - min) / range) * 40
    return `${x},${y}`
  }).join(' ')

  const pathD = `M ${pathPoints} L 160,50 L 0,50 Z`
  const color = isGain ? 'var(--green)' : 'var(--red)'

  return (
    <svg width="100%" height="60" viewBox="0 0 160 60" style={{ display: 'block', marginTop: 8 }}>
      <defs>
        <linearGradient id={`rgrad-${isGain}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.25 }} />
          <stop offset="100%" style={{ stopColor: color, stopOpacity: 0.05 }} />
        </linearGradient>
      </defs>
      <path d={pathD} fill={`url(#rgrad-${isGain})`} />
      <polyline points={pathPoints} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function ReturnsCardGrid({
  holdings,
  prices,
  colorMap,
}: {
  holdings: Holding[]
  prices: PriceMap
  colorMap: Record<string, string>
}) {
  const ranked = useMemo(() => {
    return [...holdings]
      .map(h => {
        const price = prices[h.symbol]
        // A placeholder cost basis (today's price, stored because the user
        // left the field blank) can't produce a real return. Treat it the same
        // as a missing price: no figure, and sorted to the bottom.
        const noCost = h.cost_basis_auto === true
        const gain = !noCost && price ? (price - h.cost_basis) / h.cost_basis * 100 : null
        const value = price ? price * h.shares : h.cost_basis * h.shares
        return { ...h, price, gain, value, noCost }
      })
      .sort((a, b) => (b.gain ?? -Infinity) - (a.gain ?? -Infinity))
  }, [holdings, prices])

  if (ranked.length === 0) {
    return (
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 40,
        textAlign: 'center',
        color: 'var(--muted)',
      }}>
        Add holdings in the Tracker tab to see rankings.
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
      {ranked.map((h, i) => {
        const currentPrice = h.price ?? h.cost_basis
        const isGain = h.gain == null ? true : h.gain >= 0
        const gainColor = h.gain == null ? 'var(--muted)' : h.gain >= 0 ? 'var(--green)' : 'var(--red)'

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
            {/* Header: rank + symbol */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: colorMap[h.symbol] || 'var(--accent)' }}>{h.symbol}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{h.shares} shares</div>
              </div>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--muted)',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '2px 8px',
              }}>
                #{i + 1}
              </div>
            </div>

            {/* Large return %, or a prompt when there's no real cost basis */}
            {h.noCost ? (
              <>
                <div style={{
                  display: 'inline-block', alignSelf: 'flex-start',
                  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase',
                  color: 'var(--yellow)', background: 'var(--yellow-tint)',
                  border: '1px solid var(--yellow)', borderRadius: 3, padding: '3px 8px',
                }}>
                  Cost basis not set
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                  Add what you paid in the Tracker tab to see a return here.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 26, fontWeight: 700, color: gainColor, lineHeight: 1 }}>
                  {h.gain != null ? `${h.gain >= 0 ? '+' : ''}${h.gain.toFixed(2)}%` : '—'}
                </div>

                {/* Sparkline */}
                <AreaSparkline costBasis={h.cost_basis} currentPrice={currentPrice} isGain={isGain} />
              </>
            )}

            {/* Details grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Current Price</div>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{h.price ? `$${h.price.toFixed(2)}` : '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Cost Basis</div>
                <div style={{ fontWeight: 600, color: h.noCost ? 'var(--muted)' : 'var(--text)' }}>
                  {h.noCost ? 'Not set' : `$${h.cost_basis.toFixed(2)}`}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Market Value</div>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>${h.value.toFixed(2)}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
