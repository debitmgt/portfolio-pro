// lib/stripe.ts
import Stripe from 'stripe'
import { PLAN_PRICING } from './planPricing'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-06-24.dahlia',
  typescript: true,
})

// Single on/off switch for accepting new Pro checkouts. Flipped off 2026-07-04
// pending the July 6-7 securities attorney consultations on the publisher's-
// exclusion question, entity formation, EIN, and banking. All of that is now
// resolved (LLC formed, attorney letter items implemented, MA sales tax
// live, Bluevine payout account set up with the correct EIN)  -  flipped back
// on 2026-07-15 to reopen Pro checkout. Checked both server-side here
// (app/api/stripe/checkout blocks the request outright when false) and in
// the pricing page UI (buttons show "Coming soon" instead of linking to
// signup when false).
export const CHECKOUT_ENABLED = true

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    holdingsLimit: 10,
    features: [
      'Portfolio tracker — up to 10 holdings',
      'Live prices (30s refresh)',
      'Gain/loss calculations',
      'Trailing stop display',
      'Bonus: monthly Top 25 rankings, all three cap tiers',
    ],
  },
  monthly: {
    name: 'Pro  -  Monthly',
    price: PLAN_PRICING.monthly.price,
    savingsBadge: PLAN_PRICING.monthly.savingsBadge,
    priceId: process.env.STRIPE_MONTHLY_PRICE_ID!,
    holdingsLimit: Infinity,
    features: [
      'Everything on the free plan',
      'Unlimited holdings',
      'Fundamentals (daily percentile scoring)',
      'Risk (per-holding and portfolio beta)',
      'Watchlist',
      'Personalized monthly digest email',
    ],
  },
  annual: {
    name: 'Pro  -  Annual',
    price: PLAN_PRICING.annual.price,
    savingsBadge: PLAN_PRICING.annual.savingsBadge,
    priceId: process.env.STRIPE_ANNUAL_PRICE_ID!,
    holdingsLimit: Infinity,
    features: [
      'Everything in Monthly',
      `2 months free (${PLAN_PRICING.annual.savingsBadge?.toLowerCase() ?? 'save'})`,
      'Priority support',
    ],
  },
} as const

