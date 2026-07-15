// lib/stripe.ts
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-06-24.dahlia',
  typescript: true,
})

// Single on/off switch for accepting new Pro checkouts. Flipped off 2026-07-04
// pending the July 6-7 securities attorney consultations on the publisher's-
// exclusion question, entity formation, EIN, and banking. All of that is now
// resolved (LLC formed, attorney letter items implemented, MA sales tax
// live, Bluevine payout account set up with the correct EIN) — flipped back
// on 2026-07-15 to reopen Pro checkout. Checked both server-side here
// (app/api/stripe/checkout blocks the request outright when false) and in
// the pricing page UI (buttons show "Coming soon" instead of linking to
// signup when false).
export const CHECKOUT_ENABLED = true

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    holdingsLimit: 3,
    features: [
      'Up to 3 holdings',
      'Live prices (30s refresh)',
      'Portfolio tracker',
      'Gain/loss calculations',
      'Trail stop display',
      'Monthly Top 25 newsletter (no account needed)',
    ],
  },
  monthly: {
    name: 'Pro — Monthly',
    price: 9,
    priceId: process.env.STRIPE_MONTHLY_PRICE_ID!,
    holdingsLimit: Infinity,
    features: [
      'Unlimited holdings',
      'Live prices (30s refresh)',
      'All Pro tabs',
      'My Returns',
      'Position Status',
      'Allocation View',
      'Concentration',
      'Charts',
      'Fundamentals',
      'Drawdown Alerts',
      'Watchlist',
      'Personalized monthly digest email',
    ],
  },
  annual: {
    name: 'Pro — Annual',
    price: 79,
    priceId: process.env.STRIPE_ANNUAL_PRICE_ID!,
    holdingsLimit: Infinity,
    features: [
      'Everything in Monthly',
      '2 months free (save 27%)',
      'Priority support',
    ],
  },
