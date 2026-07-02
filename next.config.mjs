// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
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
