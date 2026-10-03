'use client'

import { useEffect, useState } from 'react'

type Props = {
  /** ISO timestamp string of the first computation ever run. */
  firstComputedAt: string
  /** ISO timestamp string of the most recent computation. */
  lastComputedAt: string
}

function formatStamp(iso: string): string {
  const d = new Date(iso)
  const datePart = d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York',
  })
  const timePart = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
    timeZone: 'America/New_York',
  })
  return `${datePart} at ${timePart}`
}

/**
 * Displays the first and most recent ranking-computation timestamps, plus a
 * continuously running "time since last computation" counter so visitors can
 * see how the numbers are produced without any copy claiming real-time data.
 * Ticks client-side only (SSR renders the static stamps; the live counter
 * mounts after hydration) so there is no server/client time mismatch.
 */
export default function ComputationClock({ firstComputedAt, lastComputedAt }: Props) {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const elapsed = now !== null ? formatElapsed(now - new Date(lastComputedAt).getTime()) : null

  return (
    <div className="ofc">
      <p className="ofc-title">How these numbers are computed</p>
      <div className="ofc-rows">
        <div className="ofc-row">
          <span className="ofc-label">First computation</span>
          <span className="ofc-value">{formatStamp(firstComputedAt)}</span>
        </div>
        <div className="ofc-row">
          <span className="ofc-label">Most recent computation</span>
          <span className="ofc-value">{formatStamp(lastComputedAt)}</span>
        </div>
        <div className="ofc-row">
          <span className="ofc-label">Time since last computation</span>
          <span className="ofc-value ofc-live" suppressHydrationWarning>
            {elapsed ?? '—'}
          </span>
        </div>
      </div>
      <p className="ofc-note">
        Every ranking on this site is produced on a fixed monthly schedule, using the
        same calculation for every stock. This clock shows exactly when that
        calculation last ran — it does not mean prices update in real time.
      </p>
    </div>
  )
}

function formatElapsed(ms: number): string {
  if (ms < 0) ms = 0
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const parts: string[] = []
  if (days) parts.push(`${days}d`)
  parts.push(`${String(hours).padStart(2, '0')}h`)
  parts.push(`${String(minutes).padStart(2, '0')}m`)
  parts.push(`${String(seconds).padStart(2, '0')}s`)
  return parts.join(' ')
}
