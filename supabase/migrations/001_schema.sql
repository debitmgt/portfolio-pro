-- supabase/migrations/001_schema.sql
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query → Run)

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── profiles ────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text,
  plan               text not null default 'free',   -- 'free' | 'pro'
  stripe_customer_id text,
  created_at         timestamptz default now()
);

-- Auto-create a profile row when a new user signs up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── subscriptions ────────────────────────────────────────────────────────────
create table if not exists subscriptions (
  id                   text primary key,          -- Stripe subscription ID (sub_xxx)
  user_id              uuid references profiles(id) on delete cascade,
  status               text,                       -- active | canceled | past_due | trialing
  price_id             text,
  current_period_end   timestamptz,
  cancel_at_period_end boolean default false,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- ─── holdings ─────────────────────────────────────────────────────────────────
create table if not exists holdings (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references profiles(id) on delete cascade,
  symbol     text not null,
  shares     numeric not null check (shares > 0),
  cost_basis numeric not null check (cost_basis > 0),   -- per-share average cost
  trail_pct  numeric not null default 8 check (trail_pct > 0 and trail_pct <= 100),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast per-user queries
create index if not exists holdings_user_id_idx on holdings(user_id);

-- ─── Row Level Security ────────────────────────────────────────────────────────
alter table profiles      enable row level security;
alter table subscriptions enable row level security;
alter table holdings      enable row level security;

-- Profiles: users can only read/write their own row
create policy "profiles: own row" on profiles
  for all using (auth.uid() = id);

-- Subscriptions: users can only see their own
create policy "subscriptions: own rows" on subscriptions
  for all using (auth.uid() = user_id);

-- Holdings: users can only see and modify their own
create policy "holdings: own rows" on holdings
  for all using (auth.uid() = user_id);

-- Note: the service_role key (used by the Stripe webhook) bypasses RLS automatically.
-- No extra policy is needed for the admin client.
