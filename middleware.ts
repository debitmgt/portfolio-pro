// middleware.ts
// Uses @supabase/ssr — this is the correct pattern for Next.js 14 + Vercel.
// The key job here is to refresh the session cookie so it never expires mid-visit.
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // Write cookies onto the request so downstream Server Components see them
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          // Re-build response so we can also set them on the outgoing response
          res = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: always call getUser() (not getSession()) in middleware.
  // getSession() reads from the cookie without network verification and can
  // be spoofed. getUser() validates the JWT with Supabase's auth server.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = req.nextUrl

  // Protect /dashboard — redirect to login if not signed in
  if (pathname.startsWith('/dashboard') && !user) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/auth/login'
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect signed-in users away from auth pages — except reset-password,
  // which relies on the temporary session created by clicking a password-
  // recovery email link. A signed-in user landing there is exactly the
  // expected case, not someone who should be bounced to /dashboard.
  if (pathname.startsWith('/auth') && user && pathname !== '/auth/reset-password') {
    const dashUrl = req.nextUrl.clone()
    dashUrl.pathname = '/dashboard'
    return NextResponse.redirect(dashUrl)
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT static files and _next internals.
     * This ensures the session cookie is refreshed on every page load.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
