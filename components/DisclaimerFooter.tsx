import Link from 'next/link'
import { DISCLAIMER_SHORT, SUPPORT_LINE } from '@/lib/disclaimer'

/** Compact, always-visible disclaimer strip. Use on any page where people
 *  view data or signals — pricing, login, and the dashboard (all ten tabs
 *  share this one instance in DashboardClient, so it covers Tracker, News,
 *  My Returns, Position Status, Allocation View, Concentration, Charts,
 *  Fundamentals, Drawdown Alerts, and Watchlist without repeating it per tab). */
export default function DisclaimerFooter({ dense = false }: { dense?: boolean }) {
  return (
    <div style={{
      fontSize: 11.5,
      color: 'var(--muted)',
      lineHeight: 1.5,
      padding: dense ? '8px 24px' : '16px 24px',
      textAlign: dense ? 'left' : 'center',
      borderTop: dense ? '1px solid var(--border)' : 'none',
      background: dense ? 'var(--surface)' : 'transparent',
      flexShrink: 0,
    }}>
      {DISCLAIMER_SHORT}{' '}
      <Link href="/disclaimer" className="link" style={{ fontSize: 11.5 }}>Full disclaimer</Link>.
      <br />
      {SUPPORT_LINE}{' '}
      <Link href="/support" className="link" style={{ fontSize: 11.5 }}>Help &amp; FAQ</Link>.
    </div>
  )
}
