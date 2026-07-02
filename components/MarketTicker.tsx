'use client'
// components/MarketTicker.tsx
// Free, public homepage ticker — broad market indices only (S&P 500, Nasdaq 100,
// Dow Jones, Russell 2000). Purely descriptive "what the market is doing" data,
// not stock picks or recommendations — consistent with the information-vendor
// framing (see /disclaimer).
import { useEffect, useState } from 'react'

type TickerItem = {
  symbol: string
  label: string
  price: number | null
  changePct: number | null
}

export default function MarketTicker() {
  const [items, setItems] = useState<TickerItem[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/ticker')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setItems(data.items ?? [])
      } catch {
        // silent — ticker just stays empty/last-known
      }
    }

    load()
    const interval = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  if (items.length === 0) return null

  // Duplicate the list so the CSS marquee can loop seamlessly at -50%.
  const track = [...items, ...items]

  return (
    <div className="ticker-wrap">
      <div className="ticker-track">
        {track.map((item, i) => (
          <span className="ticker-item" key={`${item.symbol}-${i}`}>
            <span className="ticker-label">{item.label}</span>
            {item.price !== null ? (
              <>
                <span className="ticker-price">{item.price.toFixed(2)}</span>
                {item.changePct !== null && (
                  <span className={item.changePct >= 0 ? 'ticker-change up' : 'ticker-change down'}>
                    {item.changePct >= 0 ? '+' : ''}{item.changePct.toFixed(2)}%
                  </span>
                )}
              </>
            ) : (
              <span className="ticker-price ticker-muted">—</span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}
