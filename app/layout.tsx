// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ownfolio LLC — Real-Time Data for Long-Term Owners',
  description: 'Track and understand the companies you own, in near real time. Data and analytics built for long-term investors — not investment advice.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
