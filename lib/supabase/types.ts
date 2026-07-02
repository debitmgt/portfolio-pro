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
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}
