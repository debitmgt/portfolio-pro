// app/auth/callback/route.ts
// Handles the OAuth/magic-link redirect after Supabase email confirmation.
import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = createServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Use the app URL from env in production to avoid redirect issues behind Vercel's proxy
      const forwardedHost = req.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      const base = isLocalEnv
        ? origin
        : forwardedHost
        ? `https://${forwardedHost}`
        : (process.env.NEXT_PUBLIC_APP_URL ?? origin)

      return NextResponse.redirect(`${base}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=Could+not+authenticate`)
}
