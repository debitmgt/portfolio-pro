'use client'
// app/dashboard/DashboardClient.tsx
import { useState, useEffect, useCallback } from 'react'
import type { Holding, Plan, TickerMetrics } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import DisclaimerFooter from '@/components/DisclaimerFooter'

const FREE_LIMIT = 3

const ALL_TABS = ['Tracker', 'News', 'My Returns', 'Position Status', 'Allocation View', 'Concentration', 'Charts', 'Fundamentals', 'Drawdown Alerts', 'Watchlist']

interface Props {
  userId: string
  email: string
  plan: Plan
  initialHoldings: Holding[]
}

interface PriceMap { [symbol: string]: number }

export default function DashboardClient({ userId, email, plan, initialHoldings }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()

  const [holdings, setHoldings] = useState<Holding[]>(initialHoldings)
  const [prices, setPrices] = useState<PriceMap>({})
  const [activeTab, setActiveTab] = useState('Tracker')
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [priceLoading, setPriceLoading] = useState(false)

  // Add-holding form state
  const [newSymbol, setNewSymbol] = useState('')
  const [newShares, setNewShares] = useState('')
  const [newCost, setNewCost] = useState('')
  const [newTrail, setNewTrail] = useState('8')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Edit-holding form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editShares, setEditShares] = useState('')
  const [editCost, setEditCost] = useState('')
  const [editTrail, setEditTrail] = useState('')
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Show upgrade banner if returning from Stripe
  useEffect(() => {
    if (params.get('upgraded') === '1') {
      router.replace('/dashboard')
    }
  }, [params, router])

  // ─── Fetch live prices ────────────────────────────────────────────────────
  const fetchPrices = useCallback(async (syms: string[]) => {
    if (!syms.length) return
    setPriceLoading(true)
    const symbols = [...new Set(syms)].join(',')
    try {
      const res = await fetch(`/api/finnhub?symbols=${encodeURIComponent(symbols)}`)
      if (!res.ok) return
      const data: PriceMap = await res.json()
      setPrices(prev => ({ ...prev, ...data }))
    } catch { /* silent */ } finally {
      setPriceLoading(false)
    }
  }, [])

  useEffect(() => {
    const symbols = holdings.map(h => h.symbol)
    if (symbols.length) fetchPrices(symbols)
    const interval = setInterval(() => {
      if (symbols.length) fetchPrices(symbols)
    }, 30_000)
    return () => clearInterval(interval)
  }, [holdings, fetchPrices])

  // ─── Add holding ──────────────────────────────────────────────────────────
  async function addHolding() {
    setFormError('')
    if (!newSymbol || !newShares || !newCost) { setFormError('All fields required'); return }
    if (isNaN(Number(newShares)) || Number(newShares) <= 0) { setFormError('Shares must be a positive number'); return }
    if (isNaN(Number(newCost)) || Number(newCost) <= 0) { setFormError('Cost basis must be a positive number'); return }
    setSaving(true)
    const res = await fetch('/api/holdings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: newSymbol.toUpperCase().trim(),
        shares: parseFloat(newShares),
        cost_basis: parseFloat(newCost),
        trail_pct: parseFloat(newTrail) || 8,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      if (res.status === 403) setShowUpgrade(true)
      else setFormError(data.error ?? 'Failed to save')
      setSaving(false)
      return
    }
    setHoldings(prev => [...prev, data])
    setNewSymbol(''); setNewShares(''); setNewCost(''); setNewTrail('8')
    setShowAddForm(false)
    fetchPrices([data.symbol])
    setSaving(false)
  }

  // ─── Remove holding ───────────────────────────────────────────────────────
  async function removeHolding(id: string) {
    await fetch(`/api/holdings?id=${id}`, { method: 'DELETE' })
    setHoldings(prev => prev.filter(h => h.id !== id))
  }

  // ─── Edit holding ─────────────────────────────────────────────────────────
  function startEdit(h: Holding) {
    setEditingId(h.id)
    setEditShares(String(h.shares))
    setEditCost(String(h.cost_basis))
    setEditTrail(String(h.trail_pct))
    setEditError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError('')
  }

  async function saveEdit(id: string) {
    setEditError('')
    if (!editShares || !editCost) { setEditError('Shares and cost basis are required'); return }
    if (isNaN(Number(editShares)) || Number(editShares) <= 0) { setEditError('Shares must be a positive number'); return }
    if (isNaN(Number(editCost)) || Number(editCost) <= 0) { setEditError('Cost basis must be a positive number'); return }
    setEditSaving(true)
    const res = await fetch(`/api/holdings?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shares: parseFloat(editShares),
        cost_basis: parseFloat(editCost),
        trail_pct: parseFloat(editTrail) || 8,
      }),
    })
    const data = await res.json()
    setEditSaving(false)
    if (!res.ok) { setEditError(data.error ?? 'Failed to save'); return }
    setHoldings(prev => prev.map(h => (h.id === id ? data : h)))
    setEditingId(null)
  }

  // ─── Sign out ─────────────────────────────────────────────────────────────
  async function signOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  // ─── Tab click ───────────────────────────────────────────────────────────
  function handleTabClick(tab: string) {
    if (tab !== 'Tracker' && plan === 'free') { setShowUpgrade(true); return }
    setActiveTab(tab)
  }

  // ─── Derived portfolio metrics ────────────────────────────────────────────
  const totalValue = holdings.reduce((s, h) => s + (prices[h.symbol] ?? h.cost_basis) * h.shares, 0)
  const totalCost  = holdings.reduce((s, h) => s + h.cost_basis * h.shares, 0)
  const totalGain  = totalValue - totalCost
  const totalPct   = totalCost ? (totalGain / totalCost) * 100 : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{
            width: 22, height: 22, background: 'var(--accent)', borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 13,
          }}>O</span>
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.3px' }}>Ownfolio LLC</span>
          {priceLoading && <span style={{ fontSize: 11, color: 'var(--muted-2)', marginLeft: 2 }}>↻</span>}
          <Link
            href="/disclaimer"
            title="Ownfolio LLC provides data and analytics, not personalized investment advice — see full disclaimer"
            style={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
              color: 'var(--muted)', background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 3, padding: '3px 8px', marginLeft: 6, whiteSpace: 'nowrap',
            }}
          >
            Data &amp; Analytics — Not Advice
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 3,
            background: plan === 'pro' ? 'var(--accent)' : 'var(--surface-2)',
            color: plan === 'pro' ? '#fff' : 'var(--muted)',
            letterSpacing: '0.05em',
          }}>{plan.toUpperCase()}</span>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{email}</span>
          {plan === 'free' && (
            <button className="btn-primary" onClick={() => setShowUpgrade(true)} style={{ fontSize: 13, padding: '6px 14px' }}>
              Upgrade
            </button>
          )}
          {plan === 'pro' && (
            <button className="btn-outline" onClick={() => fetch('/api/stripe/portal').then(r => r.json()).then(d => { if (d.url) window.location.href = d.url })} style={{ fontSize: 13 }}>
              Manage Plan
            </button>
          )}
          <button className="btn-outline" onClick={signOut} style={{ fontSize: 13 }}>Sign out</button>
        </div>
      </header>

      {/* ── Free plan banner ── */}
      {plan === 'free' && (
        <div style={{ background: 'var(--accent-tint)', borderBottom: '1px solid var(--border)', padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: 'var(--text)' }}>
            Free plan · {holdings.length}/{FREE_LIMIT} holdings · Pro tabs locked
          </span>
          <button className="btn-primary" onClick={() => setShowUpgrade(true)} style={{ fontSize: 12, padding: '4px 14px' }}>
            Upgrade to Pro →
          </button>
        </div>
      )}

      {/* ── Tabs ── */}
      <nav style={{ display: 'flex', gap: 22, padding: '0 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', overflowX: 'auto', flexShrink: 0 }}>
        {ALL_TABS.map(tab => {
          const locked = tab !== 'Tracker' && plan === 'free'
          const active = activeTab === tab
          return (
            <button key={tab} onClick={() => handleTabClick(tab)} style={{
              padding: '13px 2px', borderRadius: 0, fontSize: 13, background: 'transparent',
              color: active ? 'var(--text)' : 'var(--muted)',
              borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
              opacity: locked ? 0.55 : 1,
              whiteSpace: 'nowrap',
              fontWeight: active ? 700 : 600,
              letterSpacing: '0.01em',
            }}>
              {locked ? '🔒 ' : ''}{tab}
            </button>
          )
        })}
      </nav>

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>

        {activeTab === 'Tracker' && (
          <TrackerTab
            holdings={holdings} prices={prices} plan={plan}
            totalValue={totalValue} totalCost={totalCost} totalGain={totalGain} totalPct={totalPct}
            onAdd={() => {
              if (plan === 'free' && holdings.length >= FREE_LIMIT) { setShowUpgrade(true); return }
              setShowAddForm(true)
            }}
            onRemove={removeHolding}
            showAddForm={showAddForm} onCancelAdd={() => { setShowAddForm(false); setFormError('') }}
            newSymbol={newSymbol} setNewSymbol={setNewSymbol}
            newShares={newShares} setNewShares={setNewShares}
            newCost={newCost} setNewCost={setNewCost}
            newTrail={newTrail} setNewTrail={setNewTrail}
            formError={formError} saving={saving} onSave={addHolding} freeLimit={FREE_LIMIT}
            editingId={editingId} onStartEdit={startEdit} onCancelEdit={cancelEdit} onSaveEdit={saveEdit}
            editShares={editShares} setEditShares={setEditShares}
            editCost={editCost} setEditCost={setEditCost}
            editTrail={editTrail} setEditTrail={setEditTrail}
            editError={editError} editSaving={editSaving}
          />
        )}

        {activeTab === 'My Returns' && plan === 'pro' && (
          <MyReturnsTab holdings={holdings} prices={prices} />
        )}

        {activeTab === 'Position Status' && plan === 'pro' && (
          <PositionStatusTab holdings={holdings} prices={prices} />
        )}

        {activeTab === 'Allocation View' && plan === 'pro' && (
          <OptimizerTab holdings={holdings} prices={prices} totalValue={totalValue} />
        )}

        {activeTab === 'Concentration' && plan === 'pro' && (
          <ConcentrationTab holdings={holdings} prices={prices} totalValue={totalValue} />
        )}

        {activeTab === 'Charts' && plan === 'pro' && (
          <ChartsTab holdings={holdings} prices={prices} />
        )}

        {activeTab === 'Fundamentals' && plan === 'pro' && (
          <FundamentalsTab holdings={holdings} />
        )}

        {activeTab === 'News' && plan === 'pro' && (
          <NewsTab holdings={holdings} />
        )}

        {activeTab === 'Drawdown Alerts' && plan === 'pro' && (
          <StopLossTab holdings={holdings} prices={prices} />
        )}

        {activeTab === 'Watchlist' && plan === 'pro' && (
          <WatchlistTab />
        )}

      </main>

      <DisclaimerFooter dense />

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  )
}

// ─── Tracker Tab ──────────────────────────────────────────────────────────────
function TrackerTab({ holdings, prices, plan, totalValue, totalCost, totalGain, totalPct, onAdd, onRemove, showAddForm, onCancelAdd, newSymbol, setNewSymbol, newShares, setNewShares, newCost, setNewCost, newTrail, setNewTrail, formError, saving, onSave, freeLimit, editingId, onStartEdit, onCancelEdit, onSaveEdit, editShares, setEditShares, editCost, setEditCost, editTrail, setEditTrail, editError, editSaving }: {
  holdings: Holding[]; prices: PriceMap; plan: Plan
  totalValue: number; totalCost: number; totalGain: number; totalPct: number
  onAdd: () => void; onRemove: (id: string) => void
  showAddForm: boolean; onCancelAdd: () => void
  newSymbol: string; setNewSymbol: (v: string) => void
  newShares: string; setNewShares: (v: string) => void
  newCost: string; setNewCost: (v: string) => void
  newTrail: string; setNewTrail: (v: string) => void
  formError: string; saving: boolean; onSave: () => void; freeLimit: number
  editingId: string | null; onStartEdit: (h: Holding) => void; onCancelEdit: () => void; onSaveEdit: (id: string) => void
  editShares: string; setEditShares: (v: string) => void
  editCost: string; setEditCost: (v: string) => void
  editTrail: string; setEditTrail: (v: string) => void
  editError: string; editSaving: boolean
}) {
  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Portfolio Value', value: `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: 'var(--text)' },
          { label: 'Total Cost Basis', value: `$${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: 'var(--text)' },
          { label: 'Total Gain / Loss', value: `${totalGain >= 0 ? '+' : ''}$${totalGain.toFixed(2)} (${totalPct.toFixed(2)}%)`, color: totalGain >= 0 ? 'var(--green)' : 'var(--red)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 20px' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Holdings table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
              {['Symbol', 'Shares', 'Cost / Share', 'Current Price', 'Value', 'Gain / Loss', 'Trail Stop', ''].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {holdings.length === 0 && (
              <tr><td colSpan={8} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--muted)' }}>
                No holdings yet. Add your first position below.
              </td></tr>
            )}
            {holdings.map(h => {
              const price = prices[h.symbol] ?? null
              const value = price != null ? price * h.shares : null
              const gain  = value != null ? value - h.cost_basis * h.shares : null
              const pct   = gain != null && h.cost_basis ? (gain / (h.cost_basis * h.shares)) * 100 : null
              const stopPrice = price != null ? price * (1 - h.trail_pct / 100) : null
              const atRisk = stopPrice != null && h.cost_basis > stopPrice
              const isEditing = editingId === h.id

              if (isEditing) {
                return (
                  <tr key={h.id} style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 15 }}>{h.symbol}</td>
                    <td style={{ padding: '8px 16px' }}>
                      <input value={editShares} onChange={e => setEditShares(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSaveEdit(h.id)} style={{ width: 90 }} />
                    </td>
                    <td style={{ padding: '8px 16px' }}>
                      <input value={editCost} onChange={e => setEditCost(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSaveEdit(h.id)} style={{ width: 90 }} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>{price != null ? `$${price.toFixed(2)}` : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{value != null ? `$${value.toFixed(2)}` : '—'}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>—</td>
                    <td style={{ padding: '8px 16px' }}>
                      <input value={editTrail} onChange={e => setEditTrail(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSaveEdit(h.id)} style={{ width: 60 }} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-primary" onClick={() => onSaveEdit(h.id)} disabled={editSaving} style={{ padding: '3px 10px', fontSize: 12 }}>
                          {editSaving ? 'Saving…' : 'Save'}
                        </button>
                        <button className="btn-outline" onClick={onCancelEdit} style={{ padding: '3px 10px', fontSize: 12 }}>
                          Cancel
                        </button>
                      </div>
                      {editError && <p style={{ color: 'var(--red)', fontSize: 11, marginTop: 4 }}>{editError}</p>}
                    </td>
                  </tr>
                )
              }

              return (
                <tr key={h.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 15 }}>{h.symbol}</td>
                  <td style={{ padding: '12px 16px' }}>{h.shares.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px' }}>${h.cost_basis.toFixed(2)}</td>
                  <td style={{ padding: '12px 16px' }}>{price != null ? `$${price.toFixed(2)}` : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{value != null ? `$${value.toFixed(2)}` : '—'}</td>
                  <td style={{ padding: '12px 16px', color: gain == null ? 'var(--muted)' : gain >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                    {gain != null && pct != null ? `${gain >= 0 ? '+' : ''}$${gain.toFixed(2)} (${pct.toFixed(1)}%)` : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ color: atRisk ? 'var(--red)' : 'var(--muted)', fontWeight: atRisk ? 700 : 400 }}>
                      {h.trail_pct}%{stopPrice != null ? ` → $${stopPrice.toFixed(2)}` : ''}
                      {atRisk && ' ⚠️'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => onStartEdit(h)} style={{ background: 'transparent', color: 'var(--accent)', padding: '3px 9px', border: '1px solid var(--accent)', borderRadius: 4, fontSize: 12 }}>
                        Edit
                      </button>
                      <button onClick={() => onRemove(h.id)} style={{ background: 'transparent', color: 'var(--red)', padding: '3px 9px', border: '1px solid var(--red)', borderRadius: 4, fontSize: 12 }}>
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Add holding form */}
      {showAddForm ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 24, maxWidth: 560 }}>
          <h3 style={{ marginBottom: 18, fontSize: 15, fontWeight: 600 }}>Add Holding</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { label: 'Ticker Symbol', value: newSymbol, set: setNewSymbol, placeholder: 'AAPL', upper: true },
              { label: 'Shares', value: newShares, set: setNewShares, placeholder: '10' },
              { label: 'Cost Basis (per share)', value: newCost, set: setNewCost, placeholder: '150.00' },
              { label: 'Trailing Stop %', value: newTrail, set: setNewTrail, placeholder: '8' },
            ].map(({ label, value, set, placeholder, upper }) => (
              <div key={label}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 5, fontWeight: 500 }}>{label}</label>
                <input
                  value={value}
                  onChange={e => set(upper ? e.target.value.toUpperCase() : e.target.value)}
                  placeholder={placeholder}
                  onKeyDown={e => e.key === 'Enter' && onSave()}
                />
              </div>
            ))}
          </div>
          {formError && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{formError}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn-primary" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Add Holding'}</button>
            <button className="btn-outline" onClick={onCancelAdd}>Cancel</button>
          </div>
        </div>
      ) : (
        <button
          className="btn-primary"
          onClick={onAdd}
          disabled={plan === 'free' && holdings.length >= freeLimit}
          style={{ padding: '9px 20px' }}
        >
          + Add Holding{plan === 'free' ? ` (${holdings.length}/${freeLimit})` : ''}
        </button>
      )}
    </div>
  )
}

// ─── My Returns Tab ───────────────────────────────────────────────────────────
// Sorts the user's own holdings by their own return since purchase. This is a
// personal calculation off each holding's individual cost basis — not a rating
// of the security itself. Two people holding the same stock will see different
// numbers here depending on what they each paid, which is why this is framed as
// a personal-return view rather than a "ranking" of the companies.
function MyReturnsTab({ holdings, prices }: { holdings: Holding[]; prices: PriceMap }) {
  const ranked = [...holdings]
    .map(h => {
      const price = prices[h.symbol]
      const gain = price ? (price - h.cost_basis) / h.cost_basis * 100 : null
      const value = price ? price * h.shares : h.cost_basis * h.shares
      return { ...h, price, gain, value }
    })
    .sort((a, b) => (b.gain ?? -Infinity) - (a.gain ?? -Infinity))

  return (
    <ProTabShell title="My Returns" description="Your own holdings sorted by return since your purchase price — a personal calculation, not a rating of the companies themselves.">
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
              {['#', 'Symbol', 'Current Price', 'Cost Basis', 'Your Return %', 'Market Value'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranked.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>Add holdings in the Tracker tab to see rankings.</td></tr>
            )}
            {ranked.map((h, i) => (
              <tr key={h.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 16px', color: 'var(--muted)', fontWeight: 700 }}>#{i + 1}</td>
                <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 15 }}>{h.symbol}</td>
                <td style={{ padding: '12px 16px' }}>{h.price ? `$${h.price.toFixed(2)}` : '—'}</td>
                <td style={{ padding: '12px 16px' }}>${h.cost_basis.toFixed(2)}</td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: h.gain == null ? 'var(--muted)' : h.gain >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {h.gain != null ? `${h.gain >= 0 ? '+' : ''}${h.gain.toFixed(2)}%` : '—'}
                </td>
                <td style={{ padding: '12px 16px' }}>${h.value.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ProTabShell>
  )
}

// ─── Position Status Tab ──────────────────────────────────────────────────────
// Describes what changed in a position (price vs. your own cost basis, proximity
// to your own trailing-stop threshold). Renamed from "Signals" — like My Returns,
// this is computed off each user's private cost basis and trail %, so it is a
// status description of your position, not a market signal or research call about
// the security. Deliberately does NOT output buy/sell/hold verdicts.
function PositionStatusTab({ holdings, prices }: { holdings: Holding[]; prices: PriceMap }) {
  type SignalState = 'NEAR_STOP' | 'DOWN' | 'UP_STRONG' | 'UP' | 'NO_DATA'

  function getSignal(h: Holding, price: number | undefined): { state: SignalState; label: string; reason: string } {
    if (!price) return { state: 'NO_DATA', label: 'NO DATA', reason: 'Awaiting price data' }
    const ret = (price - h.cost_basis) / h.cost_basis * 100
    const stopPrice = price * (1 - h.trail_pct / 100)
    if (h.cost_basis > stopPrice) return { state: 'NEAR_STOP', label: 'NEAR TRAILING-STOP', reason: `Price is near your trailing-stop threshold ($${stopPrice.toFixed(2)})` }
    if (ret < -15) return { state: 'DOWN', label: 'DOWN', reason: `Down ${ret.toFixed(1)}% from cost basis` }
    if (ret > 30) return { state: 'UP_STRONG', label: 'UP STRONG', reason: `Up ${ret.toFixed(1)}% from cost basis` }
    if (ret >= 0) return { state: 'UP', label: 'UP', reason: `Up ${ret.toFixed(1)}% — within normal range` }
    return { state: 'DOWN', label: 'DOWN', reason: `Down ${ret.toFixed(1)}% from cost basis` }
  }

  const stateColor = { NEAR_STOP: 'var(--yellow)', DOWN: 'var(--red)', UP_STRONG: 'var(--green)', UP: 'var(--accent)', NO_DATA: 'var(--muted)' }

  return (
    <ProTabShell title="Position Status" description="How each position has moved relative to your own cost basis and stop threshold — a personal status view, not a market call.">
      <div style={{ display: 'grid', gap: 12 }}>
        {holdings.length === 0 && <EmptyState />}
        {holdings.map(h => {
          const { state, label, reason } = getSignal(h, prices[h.symbol])
          return (
            <div key={h.id} style={{ background: 'var(--surface)', border: `1px solid var(--border)`, borderLeft: `4px solid ${stateColor[state]}`, borderRadius: 8, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{h.symbol}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{reason}</div>
              </div>
              <div style={{ background: stateColor[state], color: '#fff', fontWeight: 800, fontSize: 12, padding: '5px 14px', borderRadius: 3, letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>
                {label}
              </div>
            </div>
          )
        })}
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 20 }}>
        ⚠️ These describe what's changed in a position — they are not buy, sell, or hold instructions. Always do your own research.
      </p>
    </ProTabShell>
  )
}

// ─── Optimizer Tab ────────────────────────────────────────────────────────────
function OptimizerTab({ holdings, prices, totalValue }: { holdings: Holding[]; prices: PriceMap; totalValue: number }) {
  const withWeights = holdings.map(h => {
    const value = (prices[h.symbol] ?? h.cost_basis) * h.shares
    const weight = totalValue > 0 ? (value / totalValue) * 100 : 0
    const ret = prices[h.symbol] ? (prices[h.symbol] - h.cost_basis) / h.cost_basis * 100 : 0
    return { ...h, value, weight, ret }
  })

  const topHeavy = withWeights.filter(h => h.weight > 25)
  const underweight = withWeights.filter(h => h.weight < 5 && holdings.length > 4)

  return (
    <ProTabShell title="Allocation View" description="How your holdings compare to the targets you set. You choose the targets — this just shows the math.">
      {/* Weight chart */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 24px', marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Portfolio Allocation</h3>
        {holdings.length === 0 ? <EmptyState /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {withWeights.sort((a, b) => b.weight - a.weight).map(h => (
              <div key={h.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{h.symbol}</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{h.weight.toFixed(1)}% · ${h.value.toFixed(0)}</span>
                </div>
                <div style={{ background: 'var(--border)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${h.weight}%`, height: '100%', background: h.weight > 25 ? 'var(--red)' : 'var(--accent)', borderRadius: 4, transition: 'width .3s' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes — descriptive only, not instructions */}
      {(topHeavy.length > 0 || underweight.length > 0) && (
        <div style={{ display: 'grid', gap: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>Allocation Notes</h3>
          {topHeavy.map(h => (
            <Callout key={h.id} type="warning" title={`${h.symbol} is ${h.weight.toFixed(1)}% of your portfolio`}>
              This is above the common 25% concentration marker some long-term investors watch.
            </Callout>
          ))}
          {underweight.map(h => (
            <Callout key={h.id} type="info" title={`${h.symbol} is ${h.weight.toFixed(1)}% of your portfolio`}>
              A small position relative to the rest of your holdings.
            </Callout>
          ))}
        </div>
      )}
    </ProTabShell>
  )
}

// ─── Concentration Tab ────────────────────────────────────────────────────────
// Replaces the former Kelly-criterion position-sizing tool. That tool computed a
// "recommended" position size from an assumed win probability — which functions
// like personalized position-sizing advice and doesn't fit long-term, conviction-
// based ownership. This tab only shows a fact: how much of the portfolio each
// holding currently represents. No formula, no recommended size.
function ConcentrationTab({ holdings, prices, totalValue }: { holdings: Holding[]; prices: PriceMap; totalValue: number }) {
  const withWeight = holdings.map(h => {
    const price = prices[h.symbol]
    const value = (price ?? h.cost_basis) * h.shares
    const weight = totalValue > 0 ? (value / totalValue) * 100 : 0
    const ret = price ? (price - h.cost_basis) / h.cost_basis * 100 : null
    return { ...h, price, value, weight, ret }
  }).sort((a, b) => b.weight - a.weight)

  return (
    <ProTabShell title="Concentration" description="How much of your portfolio each holding represents — a fact, not a formula telling you what to buy.">
      <div style={{ display: 'grid', gap: 12 }}>
        {holdings.length === 0 && <EmptyState />}
        {withWeight.map(h => (
          <div key={h.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{h.symbol}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>${h.value.toFixed(0)} market value</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Return since purchase</div>
                <div style={{ fontWeight: 700, color: h.ret == null ? 'var(--muted)' : h.ret >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {h.ret != null ? `${h.ret >= 0 ? '+' : ''}${h.ret.toFixed(1)}%` : '—'}
                </div>
              </div>
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Share of portfolio</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{h.weight.toFixed(1)}%</div>
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 20 }}>
        This is a description of your current holdings, not a recommendation for how to size any position.
      </p>
    </ProTabShell>
  )
}

// ─── Charts Tab ───────────────────────────────────────────────────────────────
function ChartsTab({ holdings, prices }: { holdings: Holding[]; prices: PriceMap }) {
  const totalValue = holdings.reduce((s, h) => s + (prices[h.symbol] ?? h.cost_basis) * h.shares, 0)

  return (
    <ProTabShell title="Charts" description="Visual breakdown of your portfolio composition and performance.">
      {holdings.length === 0 ? <EmptyState /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {/* Allocation donut-style bar */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Allocation by Symbol</h3>
            <AllocationBar holdings={holdings} prices={prices} totalValue={totalValue} />
          </div>

          {/* Gain/Loss bar chart */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Gain / Loss by Position</h3>
            <GainLossChart holdings={holdings} prices={prices} />
          </div>
        </div>
      )}
    </ProTabShell>
  )
}

function AllocationBar({ holdings, prices, totalValue }: { holdings: Holding[]; prices: PriceMap; totalValue: number }) {
  const colors = ['var(--accent)', 'var(--green)', '#f59e0b', '#ec4899', '#14b8a6', '#8b5cf6', '#f97316']
  const sorted = [...holdings].map(h => ({
    symbol: h.symbol,
    value: (prices[h.symbol] ?? h.cost_basis) * h.shares,
    pct: totalValue > 0 ? ((prices[h.symbol] ?? h.cost_basis) * h.shares / totalValue) * 100 : 0,
  })).sort((a, b) => b.value - a.value)

  return (
    <div>
      <div style={{ display: 'flex', height: 28, borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
        {sorted.map((h, i) => (
          <div key={h.symbol} style={{ width: `${h.pct}%`, background: colors[i % colors.length], transition: 'width .3s' }} title={`${h.symbol}: ${h.pct.toFixed(1)}%`} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {sorted.map((h, i) => (
          <div key={h.symbol} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: colors[i % colors.length], flexShrink: 0 }} />
            <span style={{ color: 'var(--muted)' }}>{h.symbol} {h.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function GainLossChart({ holdings, prices }: { holdings: Holding[]; prices: PriceMap }) {
  const data = holdings.map(h => {
    const price = prices[h.symbol]
    const ret = price ? (price - h.cost_basis) / h.cost_basis * 100 : 0
    return { symbol: h.symbol, ret }
  }).sort((a, b) => b.ret - a.ret)

  const maxAbs = Math.max(...data.map(d => Math.abs(d.ret)), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map(d => (
        <div key={d.symbol}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{d.symbol}</span>
            <span style={{ fontSize: 12, color: d.ret >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
              {d.ret >= 0 ? '+' : ''}{d.ret.toFixed(2)}%
            </span>
          </div>
          <div style={{ background: 'var(--border)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
            <div style={{
              width: `${(Math.abs(d.ret) / maxAbs) * 100}%`,
              height: '100%',
              background: d.ret >= 0 ? 'var(--green)' : 'var(--red)',
              borderRadius: 4,
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Fundamentals Tab ─────────────────────────────────────────────────────────
// Includes generic per-ticker percentile scores, shown individually rather
// than blended into one number (My Returns / Position Status are personal
// calculators computed off each user's own cost basis — this is the
// opposite: one shared table, computed identically for every symbol on a
// daily schedule from public data, then filtered to what you hold). See
// app/api/cron/refresh-ticker-metrics and Ownfolio_Publishers_Exclusion_Attorney_Memo.docx.
function FundamentalsTab({ holdings }: { holdings: Holding[] }) {
  const [metricsMap, setMetricsMap] = useState<Record<string, TickerMetrics>>({})
  const [metricsLoading, setMetricsLoading] = useState(true)

  useEffect(() => {
    const symbols = [...new Set(holdings.map(h => h.symbol))]
    if (!symbols.length) { setMetricsLoading(false); return }
    setMetricsLoading(true)
    fetch(`/api/ticker-metrics?symbols=${encodeURIComponent(symbols.join(','))}`)
      .then(res => (res.ok ? res.json() : { items: [] }))
      .then((d: { items: TickerMetrics[] }) => {
        const map: Record<string, TickerMetrics> = {}
        for (const item of d.items ?? []) map[item.symbol] = item
        setMetricsMap(map)
      })
      .catch(() => { /* silent — card falls back to "not yet scored" */ })
      .finally(() => setMetricsLoading(false))
  }, [holdings])

  return (
    <ProTabShell title="Fundamentals" description="Summary, Dividends, Growth, Valuation, Profitability, and Price Performance for each holding — as-reported figures from public data, plus four individual percentile scores computed the same way for every ticker on a daily schedule.">
      {holdings.length === 0 ? <EmptyState /> : (
        <div style={{ display: 'grid', gap: 12 }}>
          {holdings.map(h => (
            <FundamentalsCard key={h.id} symbol={h.symbol} metrics={metricsMap[h.symbol]} metricsLoading={metricsLoading} />
          ))}
        </div>
      )}
      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 16, lineHeight: 1.6 }}>
        Scoring methodology (v1): four equally-weighted factors, each scored 0–100 — Valuation (P/E percentile among tracked tickers, lower P/E scores higher), Growth (revenue growth percentile), Margin Trend (expanding/flat/contracting vs. the 5-year average), and Stability (beta percentile, lower beta scores higher). Each is computed identically for every ticker from public data and refreshed daily — shown individually, not blended into a single number — and none of it is tailored to your portfolio, your cost basis, or your position size, or a recommendation to buy, hold, or sell.
      </p>
    </ProTabShell>
  )
}

interface Fundamentals {
  symbol: string
  name: string | null
  industry: string | null
  marketCap: number | null   // millions USD
  peRatio: number | null
  week52High: number | null
  week52Low: number | null
  beta: number | null
  dividends: {
    perShareAnnual: number | null
    indicatedAnnual: number | null
    yieldIndicatedAnnual: number | null
    yieldTTM: number | null
    payoutRatioTTM: number | null
    growthRate5Y: number | null
  }
  growth: {
    epsGrowthTTMYoy: number | null
    epsGrowth3Y: number | null
    epsGrowth5Y: number | null
    revenueGrowthTTMYoy: number | null
    revenueGrowth3Y: number | null
    revenueGrowth5Y: number | null
  }
  valuation: {
    peTTM: number | null
    forwardPE: number | null
    pegTTM: number | null
    pbAnnual: number | null
    psTTM: number | null
    evEbitdaTTM: number | null
  }
  profitability: {
    grossMarginTTM: number | null
    grossMargin5Y: number | null
    operatingMarginTTM: number | null
    operatingMargin5Y: number | null
    netProfitMarginTTM: number | null
    netProfitMargin5Y: number | null
    roeTTM: number | null
    roe5Y: number | null
    roaTTM: number | null
    roa5Y: number | null
    roiTTM: number | null
    roi5Y: number | null
  }
  pricePerformance: {
    fiveDay: number | null
    thirteenWeek: number | null
    twentySixWeek: number | null
    fiftyTwoWeek: number | null
    yearToDate: number | null
    monthToDate: number | null
    week52HighDate: string | null
    week52LowDate: string | null
  }
}

const DETAIL_TABS = ['Summary', 'Dividends', 'Growth', 'Valuation', 'Profitability', 'Price Performance'] as const
type DetailTab = typeof DETAIL_TABS[number]

function fmtPct(v: number | null): string {
  if (v == null) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}%`
}

function fmtNum(v: number | null, suffix = ''): string {
  return v != null ? `${v.toFixed(2)}${suffix}` : '—'
}

function fmtDate(v: string | null): string {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d.getTime()) ? v : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtMarketCap(m: number | null) {
  if (m == null) return '—'
  if (m >= 1_000_000) return `$${(m / 1_000_000).toFixed(2)}T`
  if (m >= 1_000) return `$${(m / 1_000).toFixed(2)}B`
  return `$${m.toFixed(0)}M`
}

// Every category below is a flat list of published, as-reported figures —
// no percentile ranking, letter grade, or color-coded verdict. That scoring
// treatment stays confined to the existing "Percentile Scores" section
// (computed identically for every ticker, shown separately) per the
// publisher's-exclusion framing in Ownfolio_Publishers_Exclusion_Attorney_Memo.docx.
function detailRows(data: Fundamentals, tab: DetailTab): [string, string][] {
  switch (tab) {
    case 'Summary':
      return [
        ['Market Cap', fmtMarketCap(data.marketCap)],
        ['P/E Ratio (TTM)', fmtNum(data.peRatio)],
        ['52W High', data.week52High != null ? `$${data.week52High.toFixed(2)}` : '—'],
        ['52W Low', data.week52Low != null ? `$${data.week52Low.toFixed(2)}` : '—'],
        ['Beta', fmtNum(data.beta)],
      ]
    case 'Dividends':
      return [
        ['Annual Dividend/Share', data.dividends.perShareAnnual != null ? `$${data.dividends.perShareAnnual.toFixed(2)}` : '—'],
        ['Indicated Annual Div.', data.dividends.indicatedAnnual != null ? `$${data.dividends.indicatedAnnual.toFixed(2)}` : '—'],
        ['Indicated Yield', fmtPct(data.dividends.yieldIndicatedAnnual)],
        ['TTM Yield', fmtPct(data.dividends.yieldTTM)],
        ['Payout Ratio (TTM)', fmtPct(data.dividends.payoutRatioTTM)],
        ['5Y Div. Growth Rate', fmtPct(data.dividends.growthRate5Y)],
      ]
    case 'Growth':
      return [
        ['EPS Growth (TTM YoY)', fmtPct(data.growth.epsGrowthTTMYoy)],
        ['EPS Growth (3Y)', fmtPct(data.growth.epsGrowth3Y)],
        ['EPS Growth (5Y)', fmtPct(data.growth.epsGrowth5Y)],
        ['Revenue Growth (TTM YoY)', fmtPct(data.growth.revenueGrowthTTMYoy)],
        ['Revenue Growth (3Y)', fmtPct(data.growth.revenueGrowth3Y)],
        ['Revenue Growth (5Y)', fmtPct(data.growth.revenueGrowth5Y)],
      ]
    case 'Valuation':
      return [
        ['P/E (TTM)', fmtNum(data.valuation.peTTM)],
        ['Forward P/E', fmtNum(data.valuation.forwardPE)],
        ['PEG (TTM)', fmtNum(data.valuation.pegTTM)],
        ['P/B (Annual)', fmtNum(data.valuation.pbAnnual)],
        ['P/S (TTM)', fmtNum(data.valuation.psTTM)],
        ['EV/EBITDA (TTM)', fmtNum(data.valuation.evEbitdaTTM)],
      ]
    case 'Profitability':
      return [
        ['Gross Margin (TTM / 5Y)', `${fmtPct(data.profitability.grossMarginTTM)} / ${fmtPct(data.profitability.grossMargin5Y)}`],
        ['Operating Margin (TTM / 5Y)', `${fmtPct(data.profitability.operatingMarginTTM)} / ${fmtPct(data.profitability.operatingMargin5Y)}`],
        ['Net Margin (TTM / 5Y)', `${fmtPct(data.profitability.netProfitMarginTTM)} / ${fmtPct(data.profitability.netProfitMargin5Y)}`],
        ['ROE (TTM / 5Y)', `${fmtPct(data.profitability.roeTTM)} / ${fmtPct(data.profitability.roe5Y)}`],
        ['ROA (TTM / 5Y)', `${fmtPct(data.profitability.roaTTM)} / ${fmtPct(data.profitability.roa5Y)}`],
        ['ROI (TTM / 5Y)', `${fmtPct(data.profitability.roiTTM)} / ${fmtPct(data.profitability.roi5Y)}`],
      ]
    case 'Price Performance':
      return [
        ['5 Day', fmtPct(data.pricePerformance.fiveDay)],
        ['Month to Date', fmtPct(data.pricePerformance.monthToDate)],
        ['13 Week', fmtPct(data.pricePerformance.thirteenWeek)],
        ['26 Week', fmtPct(data.pricePerformance.twentySixWeek)],
        ['52 Week', fmtPct(data.pricePerformance.fiftyTwoWeek)],
        ['Year to Date', fmtPct(data.pricePerformance.yearToDate)],
        ['52W High Date', fmtDate(data.pricePerformance.week52HighDate)],
        ['52W Low Date', fmtDate(data.pricePerformance.week52LowDate)],
      ]
  }
}

function FundamentalsCard({ symbol, metrics, metricsLoading }: { symbol: string; metrics?: TickerMetrics; metricsLoading?: boolean }) {
  const [data, setData] = useState<Fundamentals | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [detailTab, setDetailTab] = useState<DetailTab>('Summary')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    fetch(`/api/finnhub?type=fundamentals&symbol=${encodeURIComponent(symbol)}`)
      .then(res => {
        if (!res.ok) throw new Error('failed')
        return res.json()
      })
      .then((d: Fundamentals) => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [symbol])

  const rows = data ? detailRows(data, detailTab) : []

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{symbol}</div>
        {data?.name && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{data.name}{data.industry ? ` · ${data.industry}` : ''}</div>}
      </div>
      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</p>
      ) : error ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Couldn't load fundamentals for {symbol}.</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {DETAIL_TABS.map(t => (
              <button
                key={t}
                onClick={() => setDetailTab(t)}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: detailTab === t ? 'var(--accent)' : 'transparent',
                  color: detailTab === t ? '#fff' : 'var(--muted)',
                  cursor: 'pointer',
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            {rows.map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>{k}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Percentile Scores</div>
        {metricsLoading ? (
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>Loading…</p>
        ) : !metrics || metrics.valuation_score == null ? (
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>Not yet scored for {symbol} — refreshes daily.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10 }}>
            <ScoreChip label="Valuation" value={metrics.valuation_score} />
            <ScoreChip label="Growth" value={metrics.growth_score} />
            <ScoreChip label="Margin Trend" value={metrics.margin_score} note={metrics.margin_trend ?? undefined} />
            <ScoreChip label="Stability" value={metrics.stability_score} />
          </div>
        )}
      </div>

      <EarningsHistory symbol={symbol} />

      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12 }}>
        Data from Finnhub · Full detail at <a href={`https://finance.yahoo.com/quote/${symbol}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Yahoo Finance ↗</a>
      </p>
    </div>
  )
}

// ─── Earnings history (last ~4 quarters, ≈1 year) ────────────────────────────
// Actual vs. estimated EPS per quarter, straight from Finnhub — no commentary
// or scoring layered on top, same informational framing as the News tab.
interface EarningsQuarter {
  period: string
  quarter: number
  year: number
  actual: number | null
  estimate: number | null
  surprisePercent: number | null
}

function EarningsHistory({ symbol }: { symbol: string }) {
  const [items, setItems] = useState<EarningsQuarter[] | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    fetch(`/api/finnhub?type=earnings&symbol=${encodeURIComponent(symbol)}`)
      .then(res => {
        if (!res.ok) throw new Error('failed')
        return res.json()
      })
      .then((d: { items: EarningsQuarter[] }) => { if (!cancelled) setItems(d.items) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [symbol])

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
        Earnings — Last 4 Quarters
      </div>
      {loading ? (
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>Loading…</p>
      ) : error ? (
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>Couldn't load earnings history for {symbol}.</p>
      ) : !items || items.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>No earnings history available for {symbol}.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr>
              {['Quarter', 'Est. EPS', 'Actual EPS', 'Surprise'].map(h => (
                <th key={h} style={{ padding: '4px 8px 4px 0', textAlign: 'left', color: 'var(--muted)', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(q => (
              <tr key={q.period}>
                <td style={{ padding: '4px 8px 4px 0', fontWeight: 600 }}>Q{q.quarter} {q.year}</td>
                <td style={{ padding: '4px 8px 4px 0' }}>{q.estimate != null ? `$${q.estimate.toFixed(2)}` : '—'}</td>
                <td style={{ padding: '4px 8px 4px 0' }}>{q.actual != null ? `$${q.actual.toFixed(2)}` : '—'}</td>
                <td style={{ padding: '4px 8px 4px 0', color: q.surprisePercent == null ? 'var(--muted)' : q.surprisePercent >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                  {q.surprisePercent != null ? `${q.surprisePercent >= 0 ? '+' : ''}${q.surprisePercent.toFixed(1)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function ScoreChip({ label, value, note }: { label: string; value: number | null; note?: string }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>
        {value != null ? value : '—'}{note ? ` · ${note}` : ''}
      </div>
    </div>
  )
}

// ─── News Tab ─────────────────────────────────────────────────────────────────
// Live headlines for whatever you currently hold — straight from Finnhub, no
// commentary or rating layered on top. Purely informational, like the rest of
// the Pro tabs post-repositioning.
function NewsTab({ holdings }: { holdings: Holding[] }) {
  return (
    <ProTabShell title="News" description="Recent headlines for the companies you hold, refreshed live. Just the news — no commentary added.">
      {holdings.length === 0 ? <EmptyState /> : (
        <div style={{ display: 'grid', gap: 16 }}>
          {holdings.map(h => (
            <NewsCard key={h.id} symbol={h.symbol} />
          ))}
        </div>
      )}
    </ProTabShell>
  )
}

interface NewsItem {
  headline: string
  source: string
  url: string
  datetime: number   // ms
  summary: string
}

function NewsCard({ symbol }: { symbol: string }) {
  const [items, setItems] = useState<NewsItem[] | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    function load() {
      setError(false)
      fetch(`/api/finnhub?type=news&symbol=${encodeURIComponent(symbol)}`)
        .then(res => {
          if (!res.ok) throw new Error('failed')
          return res.json()
        })
        .then((d: { items: NewsItem[] }) => { if (!cancelled) setItems(d.items) })
        .catch(() => { if (!cancelled) setError(true) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }

    setLoading(true)
    load()
    // Live refresh — headlines can change during market hours; matches the
    // cache window on the API route (15 min) so this doesn't hammer Finnhub.
    const interval = setInterval(load, 15 * 60 * 1000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [symbol])

  function timeAgo(ms: number) {
    const mins = Math.floor((Date.now() - ms) / 60000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 20px' }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>{symbol}</div>
      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</p>
      ) : error ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Couldn't load news for {symbol}.</p>
      ) : !items || items.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>No recent headlines for {symbol}.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((item, i) => (
            <a
              key={`${item.url}-${i}`}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'block', padding: '10px 12px', borderRadius: 6, background: 'var(--bg)', color: 'inherit' }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 3, lineHeight: 1.35 }}>{item.headline}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{item.source} · {timeAgo(item.datetime)}</div>
            </a>
          ))}
        </div>
      )}
      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12 }}>
        Headlines from Finnhub · Informational only, not commentary on whether to hold or sell.
      </p>
    </div>
  )
}

// ─── Stop-loss Tab ────────────────────────────────────────────────────────────
function StopLossTab({ holdings, prices }: { holdings: Holding[]; prices: PriceMap }) {
  const withStop = holdings.map(h => {
    const price = prices[h.symbol]
    const stopPrice = price ? price * (1 - h.trail_pct / 100) : null
    const triggered = stopPrice != null && h.cost_basis > stopPrice
    const distancePct = price ? ((price - (stopPrice ?? 0)) / price) * 100 : null
    return { ...h, price, stopPrice, triggered, distancePct }
  }).sort((a, b) => (a.distancePct ?? 999) - (b.distancePct ?? 999))

  const triggered = withStop.filter(h => h.triggered)

  return (
    <ProTabShell title="Drawdown Alerts" description="See when a holding is down from its trailing-stop level. Informational only — no action is implied or recommended.">
      {triggered.length > 0 && (
        <Callout type="danger" title={`${triggered.length} position${triggered.length > 1 ? 's' : ''} at or below your trailing-stop threshold`}>
          {triggered.map(h => h.symbol).join(', ')} — shown for your awareness, not as an instruction to act.
        </Callout>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginTop: triggered.length ? 16 : 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
              {['Symbol', 'Current Price', 'Trail %', 'Stop Price', 'Distance to Stop', 'Status'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {holdings.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>No holdings to monitor.</td></tr>
            )}
            {withStop.map(h => (
              <tr key={h.id} style={{ borderBottom: '1px solid var(--border)', background: h.triggered ? 'var(--red-tint)' : 'transparent' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700 }}>{h.symbol}</td>
                <td style={{ padding: '12px 16px' }}>{h.price ? `$${h.price.toFixed(2)}` : '—'}</td>
                <td style={{ padding: '12px 16px' }}>{h.trail_pct}%</td>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{h.stopPrice ? `$${h.stopPrice.toFixed(2)}` : '—'}</td>
                <td style={{ padding: '12px 16px', color: h.distancePct != null && h.distancePct < 5 ? 'var(--red)' : 'var(--green)' }}>
                  {h.distancePct != null ? `${h.distancePct.toFixed(1)}%` : '—'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 3, letterSpacing: '0.03em', textTransform: 'uppercase',
                    background: h.triggered ? 'var(--red)' : 'var(--green-tint)',
                    color: h.triggered ? '#fff' : 'var(--green)',
                  }}>
                    {h.triggered ? 'Triggered' : 'Safe'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ProTabShell>
  )
}

// ─── Watchlist Tab ────────────────────────────────────────────────────────────
// Pro-only. Tickers you pick (never shares or cost basis) — this is what the
// monthly digest email filters down to, separate from what you actually hold
// in Tracker. See app/api/watchlist and app/api/cron/send-newsletter.
interface WatchlistItemRow { id: string; symbol: string; created_at: string }

function WatchlistTab() {
  const [items, setItems] = useState<WatchlistItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [newSymbol, setNewSymbol] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/watchlist')
      .then(res => (res.ok ? res.json() : []))
      .then((d: WatchlistItemRow[]) => setItems(d))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function addSymbol() {
    const symbol = newSymbol.trim().toUpperCase()
    if (!symbol) return
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Could not add symbol.'); return }
      setNewSymbol('')
      load()
    } finally {
      setSaving(false)
    }
  }

  async function removeSymbol(id: string) {
    await fetch(`/api/watchlist?id=${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <ProTabShell title="Watchlist" description="Tickers you want tracked in your monthly digest email — not your holdings, just symbols you're following. Filters the same large/mid/small-cap Top 25 rankings every subscriber sees down to your list.">
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={newSymbol}
          onChange={e => setNewSymbol(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addSymbol() }}
          placeholder="Add a symbol (e.g. AAPL)"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', fontSize: 13, flex: 1, maxWidth: 220 }}
        />
        <button onClick={addSymbol} disabled={saving || !newSymbol.trim()} className="btn-primary" style={{ padding: '8px 16px', fontSize: 13, borderRadius: 6, border: 'none', cursor: 'pointer' }}>
          Add
        </button>
      </div>
      {error && <p style={{ color: 'var(--red)', fontSize: 12, marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>No symbols yet — add tickers you want in your monthly digest.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {items.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{item.symbol}</span>
              <button onClick={() => removeSymbol(item.id)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, padding: 0 }} aria-label={`Remove ${item.symbol}`}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 16, lineHeight: 1.6 }}>
        Up to 25 symbols. This list only controls which rows appear in your monthly email — it doesn't affect your Tracker holdings or any other tab. Manage your email delivery preference from account settings.
      </p>
    </ProTabShell>
  )
}

// ─── Upgrade Modal ────────────────────────────────────────────────────────────
function UpgradeModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState<string | null>(null)

  async function startCheckout(plan: 'monthly' | 'annual') {
    setLoading(plan)
    const res = await fetch(`/api/stripe/checkout?plan=${plan}`)
    // When checkout is paused, the route redirects to /pricing?paused=1
    // (an HTML page) instead of returning JSON — follow that redirect
    // directly rather than trying to parse it as checkout session JSON.
    if (!res.headers.get('content-type')?.includes('application/json')) {
      window.location.href = res.url
      return
    }
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setLoading(null)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '36px 32px', width: '100%', maxWidth: 500, position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 16, background: 'transparent', color: 'var(--muted)', fontSize: 22, padding: '0 6px', lineHeight: 1 }}>×</button>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✦</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Upgrade to Pro</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
            Unlock unlimited holdings, all Pro tabs, valuation signals,<br />allocation views, and advanced analytics.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <PlanButton label="Monthly" price="$9 / month" onClick={() => startCheckout('monthly')} loading={loading === 'monthly'} />
          <PlanButton label="Annual" price="$79 / year" badge="Save 27%" onClick={() => startCheckout('annual')} loading={loading === 'annual'} />
        </div>
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginTop: 20 }}>
          Secure payment via Stripe · Cancel anytime
        </p>
      </div>
    </div>
  )
}

function PlanButton({ label, price, badge, onClick, loading }: { label: string; price: string; badge?: string; onClick: () => void; loading: boolean }) {
  return (
    <button className="btn-primary" onClick={onClick} disabled={loading} style={{ flex: 1, padding: '16px 0', fontSize: 15, position: 'relative', minWidth: 180 }}>
      {badge && <span style={{ position: 'absolute', top: -10, right: 10, background: 'var(--yellow)', color: '#000', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 800 }}>{badge}</span>}
      <div style={{ fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 400, marginTop: 2, opacity: 0.85 }}>{loading ? 'Redirecting…' : price}</div>
    </button>
  )
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────
function ProTabShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{title}</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>{description}</p>
      </div>
      {children}
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
      Add holdings in the Tracker tab to see data here.
    </div>
  )
}

function Callout({ type, title, children }: { type: 'warning' | 'info' | 'danger'; title: string; children: React.ReactNode }) {
  const colors = { warning: 'var(--yellow)', info: 'var(--accent)', danger: 'var(--red)' }
  const tints  = { warning: 'var(--yellow-tint)', info: 'var(--accent-tint)', danger: 'var(--red-tint)' }
  const c = colors[type]
  return (
    <div style={{ background: tints[type], border: `1px solid ${c}`, borderLeft: `4px solid ${c}`, borderRadius: 4, padding: '14px 18px' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: c, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text)' }}>{children}</div>
    </div>
  )
}
