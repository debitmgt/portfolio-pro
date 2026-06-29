import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')

  const [profileRes, holdingsRes] = await Promise.all([
    supabase.from('profiles').select('plan, email').eq('id', session.user.id).single(),
    supabase.from('holdings').select('*').eq('user_id', session.user.id).order('created_at'),
  ])

  const plan = profileRes.data?.plan ?? 'free'
  const holdings = holdingsRes.data ?? []

  return <DashboardClient plan={plan} initialHoldings={holdings} userEmail={session.user.email ?? ''} />
}
