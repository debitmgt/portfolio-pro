-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- profiles: one row per auth user
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  plan        text not null default 'free',   -- 'free' | 'pro'
  stripe_customer_id text,
  created_at  timestamptz default now()
);

-- subscriptions: Stripe subscription mirror
create table if not exists subscriptions (
  id                   text primary key,   -- Stripe subscription ID
  user_id              uuid references profiles(id) on delete cascade,
  status               text,              -- 'active' | 'canceled' | 'past_due' etc.
  price_id             text,
  current_period_end   timestamptz,
  cancel_at_period_end boolean default false,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- holdings: user's portfolio positions
create table if not exists holdings (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references profiles(id) on delete cascade,
  symbol     text not null,
  shares     numeric not null,
  cost_basis numeric not null,
  trail_pct  numeric default 8,
  created_at timestamptz default now()
);

-- RLS policies
alter table profiles    enable row level security;
alter table subscriptions enable row level security;
alter table holdings    enable row level security;

-- profiles: users can read/update own row
create policy "profiles: own row" on profiles
  for all using (auth.uid() = id);

-- subscriptions: users can read own
create policy "subscriptions: own" on subscriptions
  for select using (auth.uid() = user_id);

-- holdings: users can CRUD own
create policy "holdings: own" on holdings
  for all using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
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
  for each row execute function public.handle_new_user();
