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
  //
  // Only applied for local (Windows) builds. Vercel's remote build always
  // expects output at the default `.next` inside the project directory --
  // pointing distDir at an absolute /tmp path there breaks routes-manifest.json
  // resolution (".next/routes-manifest.json couldn't be found"), since
  // /tmp/portfolio-pro-next on Vercel's build machine isn't where its Next.js
  // integration looks. Vercel sets process.env.VERCEL=1 on every build it
  // runs, so this workaround is skipped there and Next.js uses its default
  // `.next` dir instead.
  ...(process.env.VERCEL ? {} : { distDir: '/tmp/portfolio-pro-next' }),
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
