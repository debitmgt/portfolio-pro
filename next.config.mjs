// next.config.mjs
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Locks the project root to this folder, so Next.js/Turbopack doesn't
  // get confused by the stray C:\package-lock.json and build assets
  // (like CSS) to the wrong place.
  turbopack: {
    root: __dirname,
  },
  // Ensures the Stripe webhook route receives the raw body (not parsed JSON)
  async headers() {
    return [
      {
        source: '/api/stripe/webhook',
        headers: [{ key: 'x-webhook-route', value: 'true' }],
      },
    ]
  },
}

export default nextConfig
