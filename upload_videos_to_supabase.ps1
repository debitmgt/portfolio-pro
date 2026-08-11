import Link from 'next/link'
import { cookies } from 'next/headers'
import { PLANS, CHECKOUT_ENABLED } from '@/lib/stripe'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import MarketTicker from '@/components/MarketTicker'
import MarketNewsFeed from '@/components/MarketNewsFeed'
import NewsletterSignupForm from '@/components/NewsletterSignupForm'
import HeroBoston from '@/components/HeroBoston'
import RankingsVideoHero from '@/components/RankingsVideoHero'
import ScrollReveal from '@/components/ScrollReveal'
import TrackedCTA from '@/components/TrackedCTA'

export default async function PricingPage(props: { searchParams?: Promise<{ paused?: string }> }) {
  const searchParams = await props.searchParams;
  const cookieStore = await cookies()
  const variant = cookieStore.get('ab_variant')?.value === 'b' ? 'b' : 'a'
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--bg)' }}>
      <HeroBoston />
      <RankingsVideoHero />
      <div id="page-two" style={{ width: '100%' }}>
        <MarketTicker />
      </div>
      <p>Pricing page placeholder</p>
    </main>
  )
}