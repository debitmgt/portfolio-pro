# Ownfolio LLC

Real-time data and analytics for long-term, buy-and-hold investors, with Stripe billing.

**Stack:** Next.js 14 · Supabase · Stripe · Vercel · Finnhub

---

## What's fixed in this version

| Issue | Fix |
|---|---|
| `@supabase/auth-helpers-nextjs` (deprecated) | Migrated to `@supabase/ssr` |
| `getSession()` in middleware (spoofable) | Replaced with `getUser()` everywhere |
| Session expiry on Vercel | Middleware now refreshes cookies on every request |
| Stripe API version outdated | Updated to `2025-05-28.basil` |
| Pro tabs not built | All 7 tabs fully implemented |
| `.env.local` at risk of being committed | `.gitignore` hardened |

---

## Production Deployment Checklist

### 1. GitHub
- [ ] Push this repo to a new private GitHub repository
- [ ] Confirm `.env.local` does NOT appear in the repo

### 2. Supabase
- [ ] Create a new project at https://supabase.com
- [ ] Go to **SQL Editor → New Query**, paste `supabase/migrations/001_schema.sql`, click **Run**
- [ ] Go to **Authentication → URL Configuration**:
  - Site URL: `https://ownfolio.net`
  - Redirect URLs: add `https://ownfolio.net/auth/callback`
- [ ] Go to **Project Settings → API** and copy:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (secret — never expose to client)

### 3. Stripe
- [ ] Create an account at https://stripe.com
- [ ] Go to **Products → Add Product** and create two recurring prices:
  - **Pro Monthly**: $9/month (recurring)
  - **Pro Annual**: $79/year (recurring)
  - Copy both `price_xxx` IDs → `STRIPE_MONTHLY_PRICE_ID` and `STRIPE_ANNUAL_PRICE_ID`
- [ ] Go to **Developers → API Keys** and copy:
  - `STRIPE_SECRET_KEY` (secret key)
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (publishable key)
- [ ] Go to **Developers → Webhooks → Add endpoint**:
  - URL: `https://ownfolio.net/api/stripe/webhook`
  - Events to listen for:
    - `checkout.session.completed`
    - `customer.subscription.created`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`
    - `invoice.payment_failed`
  - Copy the **Signing Secret** → `STRIPE_WEBHOOK_SECRET`
- [ ] Enable the **Customer Portal** at https://dashboard.stripe.com/settings/billing/portal

### 4. Finnhub
- [ ] Create a free account at https://finnhub.io
- [ ] Copy your API key → `FINNHUB_API_KEY`
- [ ] Free tier allows 60 requests/minute — plenty for initial users

### 5. Vercel
- [ ] Go to https://vercel.com → New Project → Import your GitHub repo
- [ ] Framework preset: **Next.js** (auto-detected)
- [ ] Go to **Project → Settings → Environment Variables** and add ALL of these:
  ```
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  STRIPE_SECRET_KEY
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  STRIPE_WEBHOOK_SECRET
  STRIPE_MONTHLY_PRICE_ID
  STRIPE_ANNUAL_PRICE_ID
  FINNHUB_API_KEY
  NEXT_PUBLIC_APP_URL=https://ownfolio.net
  ```
- [ ] Add your custom domain: **Domains → Add → ownfolio.net**
- [ ] Update DNS at your registrar to point to Vercel

### 6. Post-deployment verification
- [ ] Visit `https://ownfolio.net` → pricing page loads
- [ ] Sign up for a new account → confirmation email received
- [ ] Click confirmation link → redirected to `/dashboard`
- [ ] Add a holding (e.g. AAPL) → live price appears within 30s
- [ ] Click **Upgrade to Pro** → Stripe checkout opens
- [ ] Complete test payment (use Stripe test card `4242 4242 4242 4242`) → plan shows PRO
- [ ] Check Supabase `profiles` table → `plan` column shows `pro`
- [ ] All 7 Pro tabs accessible

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy env file
cp .env.local.example .env.local
# Fill in your values

# 3. Run dev server
npm run dev

# 4. For Stripe webhooks locally, install Stripe CLI:
#    stripe listen --forward-to localhost:3000/api/stripe/webhook
```

---

## Architecture

```
/
├── app/
│   ├── page.tsx                    → redirects to /pricing or /dashboard
│   ├── pricing/page.tsx            → public pricing page
│   ├── auth/
│   │   ├── login/page.tsx          → sign in / sign up
│   │   └── callback/route.ts       → Supabase auth redirect handler
│   ├── dashboard/
│   │   ├── page.tsx                → server component: loads user + holdings
│   │   └── DashboardClient.tsx     → all UI: tracker + 7 pro tabs
│   └── api/
│       ├── holdings/route.ts       → CRUD for user holdings
│       ├── finnhub/route.ts        → live price proxy (hides API key)
│       └── stripe/
│           ├── checkout/route.ts   → creates Stripe checkout session
│           ├── portal/route.ts     → opens Stripe billing portal
│           └── webhook/route.ts    → handles subscription lifecycle events
├── lib/
│   ├── supabase/
│   │   ├── server.ts               → server client + admin client (@supabase/ssr)
│   │   ├── client.ts               → browser client (@supabase/ssr)
│   │   └── types.ts                → TypeScript types for DB tables
│   └── stripe.ts                   → Stripe client + plan definitions
├── middleware.ts                   → session refresh + route protection
└── supabase/migrations/
    └── 001_schema.sql              → profiles, subscriptions, holdings tables + RLS
```
