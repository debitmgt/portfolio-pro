'use client'
// components/PortfolioCharts.tsx
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell as BarCell, ReferenceLine } from 'recharts'
import type { Holding } from '@/lib/supabase/types'

interface PriceMap { [symbol: string]: number }

// Deterministic palette generator so slices/bars get stable, distinct colors
// even without the parent's colorMap. Falls back to the accent hue family.
const PALETTE = [
  '#e8833a', '#3a8ee8', '#43b581', '#e85d75', '#9b6dff',
  '#f0b429', '#2dd4bf', '#f472b6', '#60a5fa', '#a3e635',
  '#fb923c', '#818cf8', '#34d399', '#fbbf24', '#f87171',
  '#22d3ee', '#c084fc', '#4ade80',
]

function colorFor(symbol: string, colorMap: Record<string, string>, i: number): string {
  return colorMap[symbol] || PALETTE[i % PALETTE.length]
}

export function AllocationPie({
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
  const data = holdings
    .map(h => {
      const value = (prices[h.symbol] ?? h.cost_basis) * h.shares
      return {
        symbol: h.symbol,
        value,
        pct: totalValue > 0 ? (value / totalValue) * 100 : 0,
      }
    })
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)

  if (data.length === 0) {
    return <p style={{ color: 'var(--muted)', fontSize: 13 }}>No positions to chart.</p>
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="symbol"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={95}
            paddingAngle={2}
            stroke="var(--surface)"
            strokeWidth={2}
          >
            {data.map((d, i) => (
              <Cell key={d.symbol} fill={colorFor(d.symbol, colorMap, i)} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, _name, entry) => {
              const pct = entry?.payload?.pct
              return [`$${Number(value).toFixed(0)}${pct != null ? ` (${pct.toFixed(1)}%)` : ''}`, '']
            }}
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 12,
              color: 'var(--text)',
            }}
            labelStyle={{ color: 'var(--text)', fontWeight: 600 }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {data.map((d, i) => (
          <div key={d.symbol} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: colorFor(d.symbol, colorMap, i), flexShrink: 0 }} />
            <span style={{ color: colorFor(d.symbol, colorMap, i), fontWeight: 600 }}>{d.symbol}</span>{' '}
            <span style={{ color: 'var(--muted)' }}>{d.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function GainLossBar({
  holdings,
  prices,
}: {
  holdings: Holding[]
  prices: PriceMap
}) {
  // Holdings whose cost basis is an auto-filled placeholder have no real
  // return to plot - charting them would draw a bar off a number the user
  // never gave us. They're left out here; the Tracker tab is where the prompt
  // to fill them in lives.
  const data = holdings
    .filter(h => h.cost_basis_auto !== true)
    .map(h => {
      const price = prices[h.symbol]
      const ret = price ? (price - h.cost_basis) / h.cost_basis * 100 : 0
      return { symbol: h.symbol, ret: Number(ret.toFixed(2)) }
    })
    .sort((a, b) => b.ret - a.ret)

  const omitted = holdings.filter(h => h.cost_basis_auto === true).length

  if (data.length === 0) {
    return (
      <p style={{ color: 'var(--muted)', fontSize: 13 }}>
        {omitted > 0
          ? 'No returns to chart yet - add a cost basis to your holdings in the Tracker tab.'
          : 'No positions to chart.'}
      </p>
    )
  }

  // Dynamic height so bars stay readable with many holdings
  const chartHeight = Math.max(200, data.length * 30)

  return (
    <>
      <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: 'var(--muted)' }}
          tickFormatter={(v: number) => `${v}%`}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="symbol"
          tick={{ fontSize: 12, fill: 'var(--text)', fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <ReferenceLine x={0} stroke="var(--border)" />
        <Tooltip
          formatter={(value) => { const n = Number(value); return [`${n >= 0 ? '+' : ''}${n}%`, 'Return'] }}
          contentStyle={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            fontSize: 12,
            color: 'var(--text)',
          }}
          labelStyle={{ color: 'var(--text)', fontWeight: 600 }}
          cursor={{ fill: 'var(--bg)' }}
        />
        <Bar dataKey="ret" radius={[0, 3, 3, 0]}>
          {data.map(d => (
            <BarCell key={d.symbol} fill={d.ret >= 0 ? 'var(--green)' : 'var(--red)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    {omitted > 0 && (
      <p style={{ color: 'var(--muted)', fontSize: 11.5, marginTop: 8 }}>
        {omitted} holding{omitted > 1 ? 's' : ''} not shown &ndash; no cost basis entered yet.
      </p>
    )}
    </>
  )
}
