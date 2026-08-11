// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ownfolio LLC - Real-Time Data for Long-Term Owners',
  description: 'Track and understand the companies you own, in near real time. Data and analytics built for long-term investors - not investment advice.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#E07A1F',
}
// Google Ads site-wide tag. Set via Vercel env var, not hardcoded.
// The tag ID itself isn't secret, but keeping it as an env var
// means switching ad accounts is a config change, not a code change.
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* First focusable element on every page, so a keyboard user can jump
            past the nav instead of tabbing through it on each visit
            (WCAG 2.4.1). Styling lives in globals.css — it is off-screen until
            focused rather than display:none, which would drop it from the tab
            order and defeat the point. The target #main-content is provided by
            the wrapper below. */}
        <a href="#main-content" className="skip-link">Skip to main content</a>

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
        {/* Microsoft Clarity - heatmaps & session recordings */}
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "xspglh9wwc");
          `}
        </Script>

        {/* tabIndex={-1} makes this focusable as a skip target without putting
            it in the normal tab order. A plain div is used rather than <main>
            because several pages render their own <main>, and nesting them
            would produce two main landmarks on the same page. */}
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>

        <Analytics />
      </body>
    </html>
  )
}
