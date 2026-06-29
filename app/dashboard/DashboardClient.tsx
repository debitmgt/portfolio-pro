'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Holding = {
  id: string
  symbol: string
  shares: number
  cost_basis: number
  trail_pct: number
}

type Price = { symbol: string; price: number; change: number; changePct: number }

type Props = {
  plan: string
  initialHoldings: Holding[]
  userEmail: string
}

const FREE_LIMIT = 3

export default function DashboardClient({ plan, initialHoldings, userEmail }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const isPro = plan === 'pro'

  const [holdings, setHoldings] = useState<Holding[]>(initialHoldings)
  const [prices, setPrices] = useState<Record<string, Price>>({})
  const [loading, setLoading] = useState(false)
  const [priceLoading, setPriceLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newSym, setNewSym] = useState('')
  const [newShares, setNewShares] = useState('')
  const [newCost, setNewCost] = useState('')
  const [newTrail, setNewTrail] = useState('8')
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const fetchPrices = useCallback(async () => {
    if (holdings.length === 0) return
    setPriceLoading(true)
    const symbols = holdings.map(h => h.symbol).join(',')
    try {
      const res = await fetch(`/api/finnhub?symbols=${symbols}`)
      const data = await res.json()
      if (data.prices) setPrices(data.prices)
    } catch {
      // silent fail
    } finally {
      setPriceLoading(false)
    }
  }, [holdings])

  useEffect(() => {
    fetchPrices()
    const interval = setInterval(fetchPrices, 60_000)
    return () => clearInterval(interval)
  }, [fetchPrices])

  async function addHolding() {
    if (!newSym || !newShares || !newCost) return
    setLoading(true)
    const res = await fetch('/api/holdings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: newSym.toUpperCase().trim(),
        shares: parseFloat(newShares),
        cost_basis: parseFloat(newCost),
        trail_pct: parseFloat(newTrail) || 8,
      }),
    })
    const data = await res.json()
    if (data.error) {
      alert(data.error)
    } else {
      setHoldings(prev => [...prev, data.holding ?? data])
      setShowAdd(false)
      setNewSym(''); setNewShares(''); setNewCost(''); setNewTrail('8')
    }
    setLoading(false)
  }

  async function removeHolding(id: string) {
    await fetch(`/api/holdings?id=${id}`, { method: 'DELETE' })
    setHoldings(prev => prev.filter(h => h.id !== id))
  }

  async function signOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  async function startUpgrade(plan: string) {
    try {
      const res = await fetch(`/api/stripe/checkout?plan=${plan}`)
      const text = await res.text()
      console.log('checkout status:', res.status, 'body:', text)
      if (!text) { alert('Empty response from server - check console'); return }
      const data = JSON.parse(text)
      if (data.url) window.location.href = data.url
      else alert('Error: ' + (data.error ?? 'No URL returned'))
    } catch (e) {
      alert('Checkout failed: ' + e)
      console.error(e)
    }
  }

  async function openPortal() {
    const res = await fetch('/api/stripe/portal')
    const { url } = await res.json()
    if (url) window.location.href = url
  }

  const totalValue = holdings.reduce((sum, h) => {
    const p = prices[h.symbol]?.price ?? Number(h.cost_basis)
    return sum + p * Number(h.shares)
  }, 0)

  const totalCost = holdings.reduce((sum, h) => sum + Number(h.cost_basis) * Number(h.shares), 0)
  const totalGain = totalValue - totalCost
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0
  const atLimit = !isPro && holdings.length >= FREE_LIMIT

  return (
    <div style={s.page}>
      <header style={s.header}>
        <span style={s.logo}>Portfolio Pro</span>
        <div style={s.headerRight}>
          {isPro ? (
            <span style={s.proBadge}>PRO</span>
          ) : (
            <button onClick={() => setUpgradeOpen(true)} style={s.upgradeBtnSmall}>Upgrade</button>
          )}
          <span style={s.email}>{userEmail}</span>
          {isPro && (
            <button onClick={openPortal} style={s.ghostBtn}>Manage plan</button>
          )}
          <button onClick={signOut} disabled={signingOut} style={s.ghostBtn}>
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </header>

      <main style={s.main}>
        <div style={s.cards}>
          <div style={s.card}>
            <div style={s.cardLabel}>Portfolio Value</div>
            <div style={s.cardValue}>${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div style={s.card}>
            <div style={s.cardLabel}>Total Cost</div>
            <div style={s.cardValue}>${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div style={s.card}>
            <div style={s.cardLabel}>Total Gain/Loss</div>
            <div style={{ ...s.cardValue, color: totalGain >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {totalGain >= 0 ? '+' : ''}${totalGain.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {' '}({totalGainPct >= 0 ? '+' : ''}{totalGainPct.toFixed(2)}%)
            </div>
          </div>
          <div style={s.card}>
            <div style={s.cardLabel}>Positions</div>
            <div style={s.cardValue}>{holdings.length}{!isPro ? ` / ${FREE_LIMIT}` : ''}</div>
          </div>
        </div>

        {!isPro && (
          <div style={s.freeBanner}>
            <span>Free plan - up to {FREE_LIMIT} holdings, basic tracker only.</span>
            <button onClick={() => setUpgradeOpen(true)} style={s.upgradeLink}>Upgrade to Pro</button>
          </div>
        )}

        <div style={s.section}>
          <div style={s.sectionHeader}>
            <h2 style={s.sectionTitle}>Holdings</h2>
            <div style={s.headerActions}>
              {priceLoading && <span style={s.muted}>Refreshing prices...</span>}
              <button onClick={fetchPrices} style={s.ghostBtn}>Refresh</button>
              {!atLimit
                ? <button onClick={() => setShowAdd(v => !v)} style={s.primaryBtn}>+ Add</button>
                : <button onClick={() => setUpgradeOpen(true)} style={s.primaryBtn}>Add (upgrade)</button>
              }
            </div>
          </div>

          {showAdd && (
            <div style={s.addForm}>
              <input placeholder="AAPL" value={newSym} onChange={e => setNewSym(e.target.value)} style={s.addInput} />
              <input placeholder="Shares" type="number" value={newShares} onChange={e => setNewShares(e.target.value)} style={s.addInput} />
              <input placeholder="Cost basis / share" type="number" value={newCost} onChange={e => setNewCost(e.target.value)} style={s.addInput} />
              <input placeholder="Trail %" type="number" value={newTrail} onChange={e => setNewTrail(e.target.value)} style={{ ...s.addInput, width: 80 }} />
              <button onClick={addHolding} disabled={loading} style={s.primaryBtn}>
                {loading ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setShowAdd(false)} style={s.ghostBtn}>Cancel</button>
            </div>
          )}

          {holdings.length === 0 ? (
            <div style={s.empty}>No holdings yet. Add your first position above.</div>
          ) : (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['Symbol', 'Shares', 'Cost Basis', 'Curr. Price', 'Mkt Value', 'Gain/Loss', 'G/L %', 'Trail %', 'Stop Price', ''].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {holdings.map(h => {
                    const shares = Number(h.shares)
                    const costBasis = Number(h.cost_basis)
                    const trailPct = Number(h.trail_pct)
                    const p = prices[h.symbol]
                    const currPrice = p?.price ?? null
                    const mktValue = currPrice != null ? currPrice * shares : null
                    const cost = costBasis * shares
                    const gain = mktValue != null ? mktValue - cost : null
                    const gainPct = gain != null && cost > 0 ? (gain / cost) * 100 : null
                    const stopPrice = currPrice != null ? currPrice * (1 - trailPct / 100) : null
                    const isPos = gain != null && gain >= 0
                    return (
                      <tr key={h.id} style={s.tr}>
                        <td style={{ ...s.td, fontWeight: 600 }}>{h.symbol}</td>
                        <td style={s.td}>{shares}</td>
                        <td style={s.td}>${costBasis.toFixed(2)}</td>
                        <td style={s.td}>{currPrice != null ? `$${currPrice.toFixed(2)}` : '-'}</td>
                        <td style={s.td}>{mktValue != null ? `$${mktValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                        <td style={{ ...s.td, color: gain != null ? (isPos ? 'var(--green)' : 'var(--red)') : undefined }}>
                          {gain != null ? `${isPos ? '+' : ''}$${gain.toFixed(2)}` : '-'}
                        </td>
                        <td style={{ ...s.td, color: gainPct != null ? (gainPct >= 0 ? 'var(--green)' : 'var(--red)') : undefined }}>
                          {gainPct != null ? `${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(2)}%` : '-'}
                        </td>
                        <td style={s.td}>{trailPct}%</td>
                        <td style={{ ...s.td, color: 'var(--accent)' }}>
                          {stopPrice != null ? `$${stopPrice.toFixed(2)}` : '-'}
                        </td>
                        <td style={s.td}>
                          <button onClick={() => removeHolding(h.id)} style={s.removeBtn}>x</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!isPro && (
          <div style={s.proSection}>
            <h2 style={s.sectionTitle}>Pro Features</h2>
            <div style={s.proGrid}>
              {['Daily Ranking', 'Signals', 'Optimizer', 'Strategy / Kelly', 'Charts', 'Fundamentals', 'Stop-loss Manager'].map(f => (
                <div key={f} style={s.proCard} onClick={() => setUpgradeOpen(true)}>
                  <span>🔒</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {upgradeOpen && (
        <div style={s.modalOverlay} onClick={() => setUpgradeOpen(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h2 style={s.modalTitle}>Upgrade to Pro</h2>
            <p style={s.modalSub}>Unlock unlimited holdings and all advanced features.</p>
            <div style={s.pricingCards}>
              <div style={s.pricingCard}>
                <div style={s.pricingLabel}>Monthly</div>
                <div style={s.pricingPrice}>$9<span style={s.pricingPer}>/mo</span></div>
                <button onClick={() => startUpgrade('monthly')} style={s.primaryBtn}>
                  Subscribe monthly
                </button>
              </div>
              <div style={{ ...s.pricingCard, border: '1px solid var(--accent)' }}>
                <div style={{ ...s.pricingLabel, color: 'var(--accent)' }}>Annual - Save 27%</div>
                <div style={s.pricingPrice}>$79<span style={s.pricingPer}>/yr</span></div>
                <button onClick={() => startUpgrade('annual')} style={{ ...s.primaryBtn, background: 'var(--accent)' }}>
                  Subscribe annually
                </button>
              </div>
            </div>
            <button onClick={() => setUpgradeOpen(false)} style={s.ghostBtn}>Maybe later</button>
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 },
  logo: { fontWeight: 700, fontSize: 18, color: 'var(--accent)' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  email: { color: 'var(--muted)', fontSize: 13 },
  proBadge: { background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 11, borderRadius: 4, padding: '2px 7px', letterSpacing: '0.05em' },
  main: { flex: 1, padding: '32px 24px', maxWidth: 1200, margin: '0 auto', width: '100%' },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px' },
  cardLabel: { color: 'var(--muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  cardValue: { fontSize: 22, fontWeight: 700 },
  freeBanner: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', background: '#1c1a10', border: '1px solid #4a4000', borderRadius: 8, padding: '12px 16px', marginBottom: 24, fontSize: 14, color: '#d4b400' },
  section: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, marginBottom: 24 },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: 600 },
  headerActions: { display: 'flex', alignItems: 'center', gap: 8 },
  muted: { color: 'var(--muted)', fontSize: 13 },
  addForm: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, padding: 16, background: 'var(--bg)', borderRadius: 8 },
  addInput: { flex: 1, minWidth: 100 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 12, padding: '8px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' },
  tr: { transition: 'background 0.1s' },
  removeBtn: { color: 'var(--muted)', fontSize: 14, padding: '2px 6px', borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer' },
  empty: { color: 'var(--muted)', textAlign: 'center', padding: '40px 0', fontSize: 14 },
  proSection: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 24 },
  proGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginTop: 16 },
  proCard: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: 'var(--muted)' },
  primaryBtn: { padding: '8px 16px', background: 'var(--accent)', color: '#fff', borderRadius: 6, fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer' },
  ghostBtn: { padding: '7px 14px', background: 'transparent', color: 'var(--muted)', borderRadius: 6, fontSize: 14, border: '1px solid var(--border)', cursor: 'pointer' },
  upgradeBtnSmall: { padding: '5px 12px', background: 'var(--accent)', color: '#fff', borderRadius: 6, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' },
  upgradeLink: { background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, fontSize: 14, padding: 0 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 },
  modal: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 32, maxWidth: 500, width: '100%' },
  modalTitle: { fontSize: 22, fontWeight: 700, marginBottom: 8 },
  modalSub: { color: 'var(--muted)', marginBottom: 24, fontSize: 14 },
  pricingCards: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  pricingCard: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 },
  pricingLabel: { fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' },
  pricingPrice: { fontSize: 28, fontWeight: 800 },
  pricingPer: { fontSize: 14, fontWeight: 400, color: 'var(--muted)' },
}
