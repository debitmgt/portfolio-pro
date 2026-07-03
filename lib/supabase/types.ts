// lib/supabase/types.ts
export type Plan = 'free' | 'pro'

export interface Profile {
  id: string
  email: string | null
  plan: Plan
  stripe_customer_id: string | null
  created_at: string
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
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}
