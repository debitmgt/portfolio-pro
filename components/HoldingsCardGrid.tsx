'use client'
// app/components/HoldingsCardGrid.tsx
import { useState, useMemo } from 'react'
import type { Holding } from '@/lib/supabase/types'

interface PriceMap { [symbol: string]: number }

type SortBy = 'symbol' | 'gain' | 'value'

function AreaSparkline({ costBasis, currentPrice, isGain }: { costBasis: number; currentPrice: number; isGain: boolean }) {
  // Simple sparkline: generate 14 points from cost basis to current price
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
  const lineColor = isGain ? 'var(--green)' : 'var(--red)'

  return (
    <svg width="100%" height="60" viewBox="0 0 160 60" style={{ display: 'block', marginTop: 8 }}>
      <defs>
        <linearGradient id={`grad-${isGain}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.25 }} />
          <stop offset="100%" style={{ stopColor: color, stopOpacity: 0.05 }} />
        </linearGradient>
      </defs>
      <path d={pathD} fill={`url(#grad-${isGain})`} />
      <polyline points={pathPoints} fill="none" stroke={lineColor} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function HoldingsCardGrid({
  holdings,
  prices,
  onStartEdit,
  onRemove,
}: {
  holdings: Holding[]
  prices: PriceMap
  onStartEdit: (h: Holding) => void
  onRemove: (id: string) => void
}) {
  const [sortBy, setSortBy] = useState<SortBy>('symbol')

  const sorted = useMemo(() => {
    const copy = [...holdings]
    if (sortBy === 'gain') {
      return copy.sort((a, b) => {
        // Holdings with no real cost basis have no meaningful return, so they
        // sink to the bottom rather than sorting on a placeholder figure.
        if (a.cost_basis_auto !== b.cost_basis_auto) return a.cost_basis_auto ? 1 : -1
        const aGain = ((prices[a.symbol] || a.cost_basis) - a.cost_basis) / a.cost_basis
        const bGain = ((prices[b.symbol] || b.cost_basis) - b.cost_basis) / b.cost_basis
        return bGain - aGain
      })
    }
    if (sortBy === 'value') {
      return copy.sort((a, b) => {
        const aValue = (prices[a.symbol] || a.cost_basis) * a.shares
        const bValue = (prices[b.symbol] || b.cost_basis) * b.shares
        return bValue - aValue
      })
    }
    return copy.sort((a, b) => a.symbol.localeCompare(b.symbol))
  }, [holdings, prices, sortBy])

  return (
    <div>
      {/* Sort buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['symbol', 'gain', 'value'] as const).map(btn => (
          <button
            key={btn}
            onClick={() => setSortBy(btn)}
            style={{
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: sortBy === btn ? 700 : 500,
              background: sortBy === btn ? 'var(--accent)' : 'transparent',
              color: sortBy === btn ? '#fff' : 'var(--text)',
              border: sortBy === btn ? 'none' : '1px solid var(--border)',
              borderRadius: 4,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {btn === 'symbol' && 'Symbol'}
            {btn === 'gain' && 'Gain %'}
            {btn === 'value' && 'Value'}
          </button>
        ))}
      </div>

      {/* Holdings grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        {sorted.map(h => {
          const currentPrice = prices[h.symbol] || h.cost_basis
          const positionValue = currentPrice * h.shares
          const positionGain = positionValue - h.cost_basis * h.shares
          const positionPct = (positionGain / (h.cost_basis * h.shares)) * 100
          const isGain = positionGain >= 0

          // cost_basis_auto means the figure stored is today's market price
          // standing in for a number the user never gave us. Showing a return
          // off it would be inventing performance, so this card shows the
          // position size and a prompt instead of a gain/loss.
          const noCost = h.cost_basis_auto === true

          const trailTarget = currentPrice * (1 - h.trail_pct / 100)

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
                cursor: 'pointer',
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
              {/* Header: symbol + status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{h.symbol}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{h.shares} shares</div>
                </div>
              </div>

              {/* Large gain/loss %, or the prompt when there's no real cost basis */}
              {noCost ? (
                <>
                  <div style={{
                    display: 'inline-block', alignSelf: 'flex-start',
                    fontSize: 10.5, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase',
                    color: 'var(--yellow)', background: 'var(--yellow-tint)',
                    border: '1px solid var(--yellow)', borderRadius: 3, padding: '3px 8px',
                  }}>
                    Cost basis not set
                  </div>
                  <button
                    onClick={() => onStartEdit(h)}
                    style={{
                      background: 'transparent', border: 'none', padding: 0, textAlign: 'left',
                      fontSize: 12, color: 'var(--accent)', textDecoration: 'underline',
                    }}
                  >
                    Add what you paid
                  </button>
                </>
              ) : (
                <>
                  <div style={{
                    fontSize: 26,
                    fontWeight: 700,
                    color: isGain ? 'var(--green)' : 'var(--red)',
                    lineHeight: 1,
                  }}>
                    {isGain ? '+' : ''}{positionPct.toFixed(1)}%
                  </div>

                  {/* Sparkline */}
                  <AreaSparkline costBasis={h.cost_basis} currentPrice={currentPrice} isGain={isGain} />
                </>
              )}

              {/* Details grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: 'var(--muted)' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Cost / Share</div>
                  <div style={{ fontWeight: 600, color: noCost ? 'var(--muted)' : 'var(--text)' }}>
                    {noCost ? 'Not set' : `$${h.cost_basis.toFixed(2)}`}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Current Price</div>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>${currentPrice.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Position Value</div>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>${positionValue.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Gain / Loss</div>
                  <div style={{ fontWeight: 600, color: noCost ? 'var(--muted)' : isGain ? 'var(--green)' : 'var(--red)' }}>
                    {noCost ? '—' : `${isGain ? '+' : ''}$${positionGain.toFixed(2)}`}
                  </div>
                </div>
              </div>

              {/* Trail stop */}
              <div style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '8px 10px',
                fontSize: 11,
                color: 'var(--muted)',
              }}>
                <div style={{ fontWeight: 600, marginBottom: 2, color: 'var(--text)' }}>Trail Stop</div>
                <div>{h.trail_pct}% → ${trailTarget.toFixed(2)} ⚠️</div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={() => onStartEdit(h)}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    fontSize: 12,
                    fontWeight: 600,
                    background: 'transparent',
                    color: 'var(--accent)',
                    border: '1px solid var(--accent)',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => onRemove(h.id)}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    fontSize: 12,
                    fontWeight: 600,
                    background: 'transparent',
                    color: 'var(--red)',
                    border: '1px solid var(--red)',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
