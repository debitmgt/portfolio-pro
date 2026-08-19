/**
 * listing-status.ts
 *
 * Guards the monthly rankings against symbols that no longer trade.
 *
 * Why this exists: Finnhub keeps returning data for delisted tickers — a
 * frozen last-traded price and a stale 52-week return. Nothing in the cron
 * fails. `fetchRawReturn` succeeds, the retry loop never fires, and
 * MIN_ROWS_SANITY_FLOOR counts the dead symbol as a good row. In August 2026
 * that put four acquired companies into the published Top 25:
 *
 *   HIBB  delisted 2024-07-25  (JD Sports)
 *   SMAR  delisted 2025-01-22  (Blackstone / Vista)
 *   VERV  delisted 2025-07-25  (Eli Lilly)
 *   VRNT  delisted 2025-11-26  (Thoma Bravo / Calabrio)
 *
 * The authoritative answer is Finnhub's own list of currently listed US
 * symbols. One API call, checked against the curated universe.
 */

const FINNHUB_BASE = 'https://finnhub.io/api/v1'

/**
 * Finnhub returns roughly 10,000+ US symbols. If it returns far fewer, the
 * response is truncated or degraded and must not be trusted — treating a
 * short list as authoritative would delete most of the universe.
 *
 * Same philosophy as MIN_ROWS_SANITY_FLOOR: refuse to act on data that
 * looks wrong rather than acting on it quietly.
 */
const LISTING_SANITY_FLOOR = 3000

export type ListingCheck = {
  /** True only if the response passed the sanity floor and can be relied on. */
  usable: boolean
  /** Uppercased symbols currently listed on a US exchange. */
  listed: Set<string>
  /** Populated when usable is false. */
  reason?: string
}

/**
 * Fetch the set of symbols currently listed on US exchanges.
 *
 * Never throws. On any failure it returns usable:false, which callers must
 * treat as "skip the filter and alert" rather than "everything is delisted".
 */
export async function fetchListedUsSymbols(token: string): Promise<ListingCheck> {
  const empty = new Set<string>()

  if (!token) {
    return { usable: false, listed: empty, reason: 'no Finnhub token provided' }
  }

  try {
    const res = await fetch(
      `${FINNHUB_BASE}/stock/symbol?exchange=US&token=${token}`,
      { cache: 'no-store' }
    )

    if (!res.ok) {
      return { usable: false, listed: empty, reason: `HTTP ${res.status}` }
    }

    const data = await res.json()

    if (!Array.isArray(data)) {
      return { usable: false, listed: empty, reason: 'response was not an array' }
    }

    const listed = new Set<string>()
    for (const row of data) {
      const sym = row?.symbol
      if (typeof sym === 'string' && sym.length > 0) {
        listed.add(sym.toUpperCase())
      }
    }

    if (listed.size < LISTING_SANITY_FLOOR) {
      return {
        usable: false,
        listed,
        reason: `only ${listed.size} symbols returned (floor is ${LISTING_SANITY_FLOOR})`,
      }
    }

    return { usable: true, listed }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return { usable: false, listed: empty, reason: detail }
  }
}

/**
 * Symbols in the universe that are no longer listed.
 *
 * Returns [] when the check is unusable — an unreliable listing response
 * must never be read as evidence that a symbol is dead.
 */
export function findDelisted(universe: string[], check: ListingCheck): string[] {
  if (!check.usable) return []
  return universe.filter((s) => !check.listed.has(s.toUpperCase()))
}

/**
 * Drop rows whose symbol is no longer listed.
 *
 * Pass-through when the check is unusable, so a bad Finnhub response
 * degrades to current behaviour rather than emptying the month.
 */
export function filterToListed<T extends { symbol: string }>(
  rows: T[],
  check: ListingCheck
): T[] {
  if (!check.usable) return rows
  return rows.filter((r) => check.listed.has(r.symbol.toUpperCase()))
}
