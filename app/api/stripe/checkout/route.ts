// app/api/stripe/checkout/route.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { stripe, PLANS, CHECKOUT_ENABLED } from '@/lib/stripe'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!CHECKOUT_ENABLED) {
    return NextResponse.redirect(new URL('/pricing?paused=1', req.url))
  }

  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  const { searchParams } = new URL(req.url)
  const plan = searchParams.get('plan') as 'monthly' | 'annual' | null

  if (!plan || !['monthly', 'annual'].includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const priceId = plan === 'monthly' ? PLANS.monthly.priceId : PLANS.annual.priceId

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, email')
    .eq('id', user.id)
    .single()

  let customerId = profile?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id

    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${baseUrl}/dashboard?upgraded=1`,
    cancel_url: `${baseUrl}/pricing`,
    // Pass user ID so the webhook can find them even before customer lookup is set up
    metadata: { supabase_user_id: user.id },
  })

  return NextResponse.json({ url: checkoutSession.url })
}
