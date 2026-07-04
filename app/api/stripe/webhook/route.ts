// app/api/stripe/webhook/route.ts
// IMPORTANT: Next.js must NOT parse the body — Stripe needs the raw bytes to verify the signature.
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'
import type Stripe from 'stripe'

export const maxDuration = 10
export const dynamic = 'force-dynamic'

// Disable body parsing — required for Stripe webhook signature verification
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // ── Helpers ──────────────────────────────────────────────────────────────

  async function getUserIdFromCustomer(customerId: string): Promise<string | null> {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single()
    return data?.id ?? null
  }

  async function setPlan(userId: string, plan: 'free' | 'pro') {
    const { error } = await supabase
      .from('profiles')
      .update({ plan })
      .eq('id', userId)
    if (error) console.error('[webhook] setPlan error:', error)
  }

  // current_period_end moved from the top-level Subscription object to each
  // subscription item as of newer Stripe API versions (this account pins
  // 2026-06-24.dahlia). Reading it off `sub` directly silently evaluated to
  // NaN and crashed Date.toISOString() — which happened *before* setPlan()
  // ran in every handler below, so payments succeeded but users never got
  // upgraded (or downgraded on cancellation). Read it from the item instead,
  // and never let a bookkeeping failure here block the plan change.
  async function upsertSubscription(sub: Stripe.Subscription, userId: string) {
    try {
      const item = sub.items.data[0]
      const periodEndUnix = (item as any)?.current_period_end ?? null
      const { error } = await supabase.from('subscriptions').upsert({
        id: sub.id,
        user_id: userId,
        status: sub.status,
        price_id: item?.price.id ?? null,
        current_period_end: periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null,
        cancel_at_period_end: sub.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      })
      if (error) console.error('[webhook] upsertSubscription error:', error)
    } catch (err) {
      console.error('[webhook] upsertSubscription threw:', err)
    }
  }

  // ── Event handlers ───────────────────────────────────────────────────────

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const customerId = session.customer as string

        // Prefer metadata userId set at checkout creation time; fall back to DB lookup
        const userId =
          session.metadata?.supabase_user_id ??
          (await getUserIdFromCustomer(customerId))

        if (!userId) {
          console.error('[webhook] checkout.session.completed: no userId found for customer', customerId)
          break
        }

        // Make sure the customer ID is stored (handles first-time checkouts)
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', userId)

        // Grant access first — it's the part that actually matters to the
        // user. Subscription bookkeeping runs after and can't block it.
        await setPlan(userId, 'pro')
        console.log('[webhook] checkout.session.completed: upgraded user', userId)

        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string)
          await upsertSubscription(sub, userId)
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const userId = await getUserIdFromCustomer(sub.customer as string)
        if (!userId) break

        const isActive = ['active', 'trialing'].includes(sub.status)
        await setPlan(userId, isActive ? 'pro' : 'free')
        console.log(`[webhook] ${event.type}: user ${userId} → ${isActive ? 'pro' : 'free'}`)

        await upsertSubscription(sub, userId)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const userId = await getUserIdFromCustomer(sub.customer as string)
        if (!userId) break

        await setPlan(userId, 'free')
        console.log('[webhook] subscription.deleted: downgraded user', userId)

        await upsertSubscription(sub, userId)
        break
      }

      case 'invoice.payment_failed': {
        // Optional: notify user or flag account — not blocking for now
        const invoice = event.data.object as Stripe.Invoice
        console.warn('[webhook] Payment failed for customer:', invoice.customer)
        break
      }

      default:
        // Ignore unhandled event types
        break
    }
  } catch (err) {
    console.error('[webhook] Handler error:', err)
    // Return 200 anyway — Stripe will not retry on 5xx but will on network errors
  }

  return NextResponse.json({ received: true })
}
