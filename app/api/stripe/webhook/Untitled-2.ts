// app/api/stripe/webhook/route.ts
// IMPORTANT: Next.js must NOT parse the body — Stripe needs the raw bytes to verify the signature.
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'
import { sendFailureAlert } from '@/lib/email/alerts'
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
    if (error) {
      console.error('[webhook] setPlan error:', error)
      // This is the case that actually matters: Stripe already has the
      // customer's money and we failed to grant/revoke access. Never let
      // this fail silently again (see current_period_end bug, 2026-07-03).
      await sendFailureAlert(
        'stripe-webhook',
        `setPlan(${userId}, ${plan}) failed: ${error.message}\n\nUser paid/changed plan but profiles.plan was not updated — check manually.`
      )
    }
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

  async function getUserIdFromCharge(chargeId: string): Promise<string | null> {
    try {
      const charge = await stripe.charges.retrieve(chargeId)
      const customerId = charge.customer as string | null
      if (!customerId) return null
      return await getUserIdFromCustomer(customerId)
    } catch (err) {
      console.error('[webhook] getUserIdFromCharge failed:', err)
      return null
    }
  }

  async function updateDisputeRecord(dispute: Stripe.Dispute) {
    const { error } = await supabase
      .from('disputes')
      .update({ status: dispute.status, updated_at: new Date().toISOString() })
      .eq('id', dispute.id)
    if (error) console.error('[webhook] dispute update error:', error)
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

      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute
        const chargeId = dispute.charge as string
        const userId = await getUserIdFromCharge(chargeId)

        console.warn('[webhook] Dispute created:', dispute.id, 'amount:', dispute.amount, 'reason:', dispute.reason)

        const { error } = await supabase.from('disputes').upsert({
          id: dispute.id,
          user_id: userId,
          charge_id: chargeId,
          amount: dispute.amount,
          currency: dispute.currency,
          reason: dispute.reason,
          status: dispute.status,
          updated_at: new Date().toISOString(),
        })
        if (error) console.error('[webhook] dispute insert error:', error)

        await sendFailureAlert(
          'stripe-dispute',
          `A customer disputed a charge.\n\nDispute ID: ${dispute.id}\nCharge: ${chargeId}\nAmount: $${(dispute.amount / 100).toFixed(2)} ${dispute.currency.toUpperCase()}\nReason: ${dispute.reason}\n\nYou likely need to respond in the Stripe dashboard before the deadline shown there.`
        )
        break
      }

      case 'charge.dispute.closed': {
        const dispute = event.data.object as Stripe.Dispute
        console.log('[webhook] Dispute closed:', dispute.id, 'outcome:', dispute.status)
        await updateDisputeRecord(dispute)
        break
      }

      case 'charge.dispute.updated': {
        // Usually fires when evidence is submitted or Stripe's status
        // tracking changes ahead of the final closed outcome. Just keep
        // our record in sync — no alert needed here, `created` already
        // notified Dwight and `closed` will tell him the outcome.
        const dispute = event.data.object as Stripe.Dispute
        console.log('[webhook] Dispute updated:', dispute.id, 'status:', dispute.status)
        await updateDisputeRecord(dispute)
        break
      }

      case 'charge.dispute.funds_withdrawn': {
        // The moment Stripe actually pulls the disputed amount out of the
        // account. Distinct from `created` (which just means someone
        // disputed it) — this is the real money-left-the-account event.
        const dispute = event.data.object as Stripe.Dispute
        console.warn('[webhook] Dispute funds withdrawn:', dispute.id, 'amount:', dispute.amount)

        await updateDisputeRecord(dispute)

        await sendFailureAlert(
          'stripe-dispute',
          `Funds were withdrawn due to a dispute.\n\nDispute ID: ${dispute.id}\nAmount withdrawn: $${(dispute.amount / 100).toFixed(2)} ${dispute.currency.toUpperCase()}\n\nThis money has left your account.`
        )
        break
      }

      case 'charge.dispute.funds_reinstated': {
        // Good news case — you won the dispute (or it was partially
        // refunded and the remainder reinstated) and the funds came back.
        const dispute = event.data.object as Stripe.Dispute
        console.log('[webhook] Dispute funds reinstated:', dispute.id, 'amount:', dispute.amount)

        await updateDisputeRecord(dispute)

        await sendFailureAlert(
          'stripe-dispute',
          `Good news: funds were reinstated after a dispute.\n\nDispute ID: ${dispute.id}\nAmount reinstated: $${(dispute.amount / 100).toFixed(2)} ${dispute.currency.toUpperCase()}`
        )
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
    const detail = err instanceof Error ? (err.stack ?? err.message) : String(err)
    await sendFailureAlert('stripe-webhook', `event ${event.type} threw:\n\n${detail}`)
    // Return 200 anyway — Stripe will not retry on 5xx but will on network errors
  }

  return NextResponse.json({ received: true })
}