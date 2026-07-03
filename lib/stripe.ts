// lib/stripe.ts
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-06-24.dahlia',
  typescript: true,
})

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
} as const
