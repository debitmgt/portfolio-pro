import { NewsletterStatusPage } from '@/components/NewsletterStatusPage'

export const metadata = { title: 'Subscribed — Ownfolio' }

export default function ConfirmedPage() {
  return (
    <NewsletterStatusPage
      eyebrow="Newsletter"
      title="You're subscribed"
      body="You'll get the Ownfolio Top 25 once a month — the 25 highest trailing 1-year returns from our tracked universe, same list for every subscriber. You can unsubscribe anytime from the link in any email."
    />
  )
}
