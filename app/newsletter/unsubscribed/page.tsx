import { NewsletterStatusPage } from '@/components/NewsletterStatusPage'

export const metadata = { title: 'Unsubscribed — Ownfolio' }

export default function UnsubscribedPage() {
  return (
    <NewsletterStatusPage
      eyebrow="Newsletter"
      title="You're unsubscribed"
      body="You won't get any more newsletter emails from Ownfolio. If this was a mistake, you can re-subscribe anytime from the homepage, or from your dashboard if you're on Pro."
    />
  )
}
