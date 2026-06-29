import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
  typescript: true,
})

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    maxHoldings: 3,
    priceId: null,
  },
  monthly: {
    name: 'Pro Monthly',
    price: 9,
    maxHoldings: Infinity,
    priceId: process.env.STRIPE_MONTHLY_PRICE_ID!,
  },
  annual: {
    name: 'Pro Annual',
    price: 79,
    maxHoldings: Infinity,
    priceId: process.env.STRIPE_ANNUAL_PRICE_ID!,
  },
} as const

export type PlanKey = keyof typeof PLANS
