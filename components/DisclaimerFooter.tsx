// components/DisclaimerFooter.tsx
import Link from 'next/link'

/** Compact, always-visible disclaimer strip. Use on any page where people
 *  view data or signals — pricing, login, and the dashboard. */
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
      For informational and educational purposes only — not financial advice. Ownfolio LLC is not a
      registered investment adviser and is not responsible for any losses resulting from use of this
      site. <Link href="/disclaimer" className="link" style={{ fontSize: 11.5 }}>Full disclaimer</Link>
    </div>
  )
}
