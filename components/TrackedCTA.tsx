// components/TrackedCTA.tsx
// A CTA link/button that fires a Vercel Analytics event on click, then
// navigates. Kept as its own tiny client component — deliberately not part
// of PricingCard's file being marked 'use client', since that file also
// imports '@/lib/stripe' at module scope for the server-only PLANS data.
// Making the whole file client would bundle that Stripe code into the
// browser again, which is exactly the bug that broke the pricing page once
// already (see HeroBoston/HeroBostonAnimated split for the same reason).
'use client'

import { track } from '@vercel/analytics'

export default function TrackedCTA({
  href, label, className, style, eventName, eventProps,
}: {
  href: string
  label: string
  className?: string
  style?: React.CSSProperties
  eventName: string
  eventProps?: Record<string, string>
}) {
  return (
    <a href={href} onClick={() => track(eventName, eventProps)}>
      <button className={className} style={style}>{label}</button>
    </a>
  )
}
