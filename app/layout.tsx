// app/layout.tsx
import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ownfolio LLC — Real-Time Data for Long-Term Owners',
  description: 'Track and understand the companies you own, in near real time. Data and analytics built for long-term investors — not investment advice.',
}

// Google Ads site-wide tag (AW-XXXXXXXXX). Set via Vercel env var, not hardcoded —
// the tag ID itself isn't secret (it's visible in page source once live), but keeping
// it as an env var means switching ad accounts is a config change, not a code change.
// The signup conversion event itself fires from app/auth/login/page.tsx at the moment
// of successful signup, using NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_CONVERSION_LABEL.
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {GOOGLE_ADS_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-ads-gtag-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GOOGLE_ADS_ID}');
              `}
            </Script>
          </>
        )}
        {children}
      </body>
    </html>
  )
}
