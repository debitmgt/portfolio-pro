// app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'
import type { Holding, Plan } from '@/lib/supabase/types'
import { Suspense } from 'react'

export default async function DashboardPage() {
  const supabase = createServerClient()

  // Use getUser() — verifies JWT with Supabase auth server (more secure than getSession())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const userId = user.id

  const [profileResult, holdingsResult] = await Promise.all([
    supabase.from('profiles').select('plan').eq('id', userId).single(),
    supabase.from('holdings').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
  ])

  const plan: Plan = (profileResult.data?.plan as Plan) ?? 'free'
  const holdings: Holding[] = (holdingsResult.data ?? []) as Holding[]

  return (
    <Suspense>
      <DashboardClient
        userId={userId}
        email={user.email ?? ''}
        plan={plan}
        initialHoldings={holdings}
      />
    </Suspense>
  )
}
