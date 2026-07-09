import { NewsletterStatusPage } from '@/components/NewsletterStatusPage'

export const metadata = { title: 'Confirmation link invalid — Ownfolio LLC' }

export default function ConfirmErrorPage() {
  return (
    <NewsletterStatusPage
      eyebrow="Newsletter"
      title="That link didn't work"
      body="This confirmation link is invalid or has already been used. If you still want the Ownfolio LLC Top 25, sign up again from the homepage."
    />
  )
}
