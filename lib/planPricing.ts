// lib/planPricing.ts
// Single source of truth for what customers see as the Pro Monthly and
// Pro Annual price (and the "Save X%" badge). Client-side components (like
// the dashboard's upgrade popup) must import ONLY this file, never
// lib/stripe.ts directly - lib/stripe.ts loads the Stripe SDK and reads the
// secret API key at the top of the file, which must never end up in code
// sent to the browser. Server-side files (lib/stripe.ts, the pricing page,
// the homepage) also read from here, so the price only has to change in one
// place going forward.
export const PLAN_PRICING = {
  monthly: {
    price: 4.95,
    savingsBadge: undefined as string | undefined,
  },
  annual: {
    price: 49,
    savingsBadge: 'Save 17%',
  },
} as const