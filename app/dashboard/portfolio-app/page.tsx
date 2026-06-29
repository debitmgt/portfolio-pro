import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function PortfolioAppPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', session.user.id)
    .single()

  if (profile?.plan !== 'pro') redirect('/dashboard')

  return (
    <div style={{ height: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ color: '#e6edf3', marginBottom: 12 }}>Pro Portfolio App</h2>
        <p>Embed your full portfolio HTML here via the PORTFOLIO_SCRIPT constant.</p>
        <p style={{ fontSize: 13, marginTop: 8 }}>See README section 9 for integration instructions.</p>
      </div>
    </div>
  )
}
