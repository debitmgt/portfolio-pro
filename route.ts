// app/api/stripe/webhook/route.ts
// Stripe sends events here. We sync subscription status → Supabase profiles.
// Set your webhook endpoint in Stripe Dashboard → Developers → Webhooks
// Endpoint URL: https://your-app.vercel.app/api/stripe/webhook
// Events to listen for:
//   customer.subscription.created
//   customer.subscription.updated
//   customer.subscription.deleted
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

export async function POST(req: Request) {
  const body = await req.text()
  const sig  = headers().get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('Webhook signature error:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()

  async function syncSubscription(sub: Stripe.Subscription) {
    const userId = sub.metadata?.supabase_user_id
    if (!userId) {
      console.warn('No supabase_user_id in subscription metadata:', sub.id)
      return
    }
    const isActive = ['active', 'trialing'].includes(sub.status)
    const plan = isActive ? 'pro' : 'free'

    // Update profile plan
    await admin.from('profiles').update({ plan }).eq('id', userId)

    // Upsert subscription record
    await admin.from('subscriptions').upsert({
      id:                   sub.id,
      user_id:              userId,
      status:               sub.status,
      plan_interval:        sub.items.data[0]?.plan?.interval ?? null,
      stripe_price_id:      sub.items.data[0]?.price?.id ?? null,
      current_period_end:   new Date(sub.current_period_end * 1000).toISOString(),
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at:           new Date().toISOString(),
    })
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncSubscription(event.data.object as Stripe.Subscription)
      break

    case 'checkout.session.completed': {
      // Fallback: also fetch and sync the subscription from the session
      const session = event.data.object as Stripe.Checkout.Session
      if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        // Attach user id to sub metadata if missing (first-time checkout)
        if (!sub.metadata?.supabase_user_id && session.metadata?.supabase_user_id) {
          await stripe.subscriptions.update(sub.id, {
            metadata: { supabase_user_id: session.metadata.supabase_user_id }
          })
        }
        await syncSubscription(sub)
      }
      break
    }

    default:
      // Ignore other events
      break
  }

  return NextResponse.json({ received: true })
}

// Stripe requires the raw body — disable Next.js body parsing
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
