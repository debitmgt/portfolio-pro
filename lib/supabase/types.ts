// lib/supabase/types.ts
export type Plan = 'free' | 'pro'

export interface Profile {
  id: string
  email: string | null
  plan: Plan
  stripe_customer_id: string | null
  created_at: string
  // Pro users get the monthly watchlist digest by default (opt-out). Free
  // Top 25 subscribers are separate — see NewsletterSubscriber (opt-in).
  newsletter_opt_out: boolean
  newsletter_unsubscribe_token: string
}

export interface Subscription {
  id: string
  user_id: string
  status: string
  price_id: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

export interface Holding {
  id: string
  user_id: string
  symbol: string
  shares: number
  cost_basis: number
  trail_pct: number
  created_at: string
  updated_at: string
}

// Generic, per-ticker content computed identically for every user on a fixed
// schedule from public market data only (see scripts/cron/refresh-ticker-metrics).
// Never derived from any individual user's cost basis, shares, or portfolio —
// this is the "compute once, filter per user" layer described in the publisher's-
// exclusion architecture review.
export interface TickerMetrics {
  symbol: string
  market_cap: number | null
  pe_ratio: number | null
  pe_percentile: number | null
  revenue_growth_yoy: number | null
  growth_percentile: number | null
  beta: number | null
  stability_percentile: number | null
  margin_trend: 'expanding' | 'flat' | 'contracting' | null
  valuation_score: number | null
  growth_score: number | null
  margin_score: number | null
  stability_score: number | null
  methodology_version: string
  computed_at: string
  updated_at: string
}

export type CapTier = 'large' | 'mid' | 'small'

// Broad-market Top 25 ranking (trailing 1y total return), computed identically
// for every subscriber on a monthly schedule, ranked separately within each
// cap_tier (large/mid/small — classified live from market cap, not a static
// per-symbol label, see app/api/cron/refresh-monthly-rankings). Feeds the
// free newsletter (unfiltered, one Top 25 per tier) and the Pro digest
// (filtered by WatchlistItem symbols). Never derived from any user's holdings.
export interface MonthlyRanking {
  id: string
  period_label: string
  symbol: string
  company_name: string | null
  cap_tier: CapTier | null
  rank: number
  trailing_return_1y: number | null
  price_current: number | null
  price_1y_ago: number | null
  methodology_version: string
  computed_at: string
  created_at: string
}

// Optional, hand-written monthly commentary spotlight (e.g. a "story of the
// month" highlight on one public company). One row per period_label. This is
// genuine editorial content, not computed/personalized data — no link to any
// user's holdings, cost basis, or watchlist. Service-role only; there's no
// admin UI to write these yet, so a row is inserted directly (Supabase table
// editor or a one-off SQL statement) each month it's wanted. If no row exists
// for a period, the newsletter simply omits the spotlight section.
export interface NewsletterEditorial {
  period_label: string
  symbol: string | null
  headline: string
  body: string
  created_at: string
  updated_at: string
}

// Public, account-free signups for the free monthly Top 25 email. Written
// only via server routes using the service-role client.
export interface NewsletterSubscriber {
  id: string
  email: string
  confirmed: boolean
  confirm_token: string
  unsubscribe_token: string
  confirmed_at: string | null
  unsubscribed_at: string | null
  created_at: string
}

// Pro-only, user-entered tickers (never shares/cost basis) that filter
// MonthlyRanking into a personalized digest — selection-based personalization,
// not computation-based. Deliberately separate from Holding.
export interface WatchlistItem {
  id: string
  user_id: string
  symbol: string
  created_at: string
}

// Supabase's typed query builder only infers correctly when Row/Insert/Update
// are plain object types, not references to a named interface. Flatten<T>
// forces TS to compute a fresh literal type while still deriving from the
// interfaces above (so we don't duplicate field lists).
type Flatten<T> = { [K in keyof T]: T[K] }

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Flatten<Profile>
        Insert: Flatten<Partial<Profile> & { id: string }>
        Update: Flatten<Partial<Profile>>
        Relationships: []
      }
      subscriptions: {
        Row: Flatten<Subscription>
        Insert: Flatten<Partial<Subscription> & { id: string }>
        Update: Flatten<Partial<Subscription>>
        Relationships: []
      }
      holdings: {
        Row: Flatten<Holding>
        Insert: Flatten<Omit<Holding, 'id' | 'created_at' | 'updated_at'>>
        Update: Flatten<Partial<Omit<Holding, 'id' | 'user_id'>>>
        Relationships: []
      }
      ticker_metrics: {
        Row: Flatten<TickerMetrics>
        Insert: Flatten<Partial<TickerMetrics> & { symbol: string }>
        Update: Flatten<Partial<TickerMetrics>>
        Relationships: []
      }
      monthly_rankings: {
        Row: Flatten<MonthlyRanking>
        Insert: Flatten<Partial<MonthlyRanking> & { period_label: string; symbol: string; rank: number }>
        Update: Flatten<Partial<MonthlyRanking>>
        Relationships: []
      }
      newsletter_subscribers: {
        Row: Flatten<NewsletterSubscriber>
        Insert: Flatten<Partial<NewsletterSubscriber> & { email: string }>
        Update: Flatten<Partial<NewsletterSubscriber>>
        Relationships: []
      }
      watchlist_items: {
        Row: Flatten<WatchlistItem>
        Insert: Flatten<Partial<WatchlistItem> & { user_id: string; symbol: string }>
        Update: Flatten<Partial<WatchlistItem>>
        Relationships: []
      }
      newsletter_editorial: {
        Row: Flatten<NewsletterEditorial>
        Insert: Flatten<Partial<NewsletterEditorial> & { period_label: string; headline: string; body: string }>
        Update: Flatten<Partial<NewsletterEditorial>>
        Relationships: []
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}
