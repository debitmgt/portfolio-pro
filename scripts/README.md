# Stripe webhook smoke test

Verifies end-to-end that Stripe events actually sync into Supabase correctly,
without clicking through the checkout UI every time.

## One-time setup

1. In `scripts/stripe-fixtures/subscription-created.json`, replace:
   - `REPLACE_WITH_YOUR_SUPABASE_USER_ID` (both occurrences) with a real user
     ID from your `profiles` table (use a test account, not a real customer)
   - `REPLACE_WITH_YOUR_STRIPE_MONTHLY_PRICE_ID` with your test-mode price ID
     (same value as `STRIPE_MONTHLY_PRICE_ID` in `.env.local`)
2. Make sure `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` set (the verify script needs both).

## Running the test

**Terminal 1** — dev server:
```bash
npm run dev
```

**Terminal 2** — forward Stripe events to your local server:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
Copy the `whsec_...` value it prints into `.env.local` as `STRIPE_WEBHOOK_SECRET`
(restart `npm run dev` after changing this).

**Terminal 3** — run the test:
```bash
npm run test:webhook:create
```
This creates a real test customer + subscription in Stripe (with your Supabase
user ID attached as metadata), which fires `customer.subscription.created` at
your webhook. Watch Terminal 2 for a `200` response.

Then verify it actually landed in Supabase:
```bash
npm run test:webhook:verify -- <your_supabase_user_id> pro
```
Should print `✅ Webhook sync verification PASSED` and show `plan = "pro"`.

## Testing cancellation

The `subscription-created` command prints the new subscription's ID in its
output. Copy it into `scripts/stripe-fixtures/subscription-canceled.json`
(replacing `REPLACE_WITH_SUBSCRIPTION_ID_PRINTED_BY_PREVIOUS_STEP` in the
`path` field), then run:
```bash
npm run test:webhook:cancel
npm run test:webhook:verify -- <your_supabase_user_id> free
```
Should show `plan = "free"` and the subscription row's `status` as `canceled`.

## Cleanup

The test customer/subscription only exist in Stripe **test mode** — safe to
leave, or delete manually from the Stripe Dashboard (Customers → search
`webhook-smoke-test@example.com`).
