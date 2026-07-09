import { NewsletterStatusPage } from '@/components/NewsletterStatusPage'

export const metadata = { title: 'Unsubscribe link invalid — Ownfolio LLC' }

export default function UnsubscribeErrorPage() {
  return (
    <NewsletterStatusPage
      eyebrow="Newsletter"
      title="That link didn't work"
      body="This unsubscribe link is invalid or expired. Contact us and we'll remove you manually, or check the link in a more recent email."
    />
  )
}
