import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-react'
import { DiscordIcon } from '@/components/Cards'
import { modeCfg, modeName, storeIsOpen } from '@/lib/modes'
import { useCart } from '@/lib/cart'
import { formatPrice, toast, useSite } from '@/lib/ui'

type Problem = { error: string; code?: string; url?: string; invite?: string }

// Cart -> "Continue to payment" -> a private Discord ticket is created and the visitor is sent straight into it.
export default function CartDrawer() {
  const cart = useCart()
  const mode = cart.open
  const { settings: s, products } = useSite()
  const [mc, setMc] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)

  useEffect(() => { setMc(localStorage.getItem('momo_mc_name') || '') }, [])
  useEffect(() => {
    if (!mode) return
    setProblem(null)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cart.closeCart() }
    addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    if (!mode) return []
    return cart.lines(mode).flatMap((l) => {
      const p = products.find((x) => x.id === l.id && x.mode === mode)
      return p ? [{ p, qty: l.qty }] : []
    })
  }, [cart, mode, products])

  if (!mode) return null
  const info = { name: modeName(s, mode), accent: modeCfg(s, mode).accent }
  const open = storeIsOpen(s, mode)
  const total = rows.reduce((a, r) => a + (r.p.price ?? 0) * r.qty, 0)
  const unpriced = rows.some((r) => r.p.price == null)

  const pay = async () => {
    if (!/^[A-Za-z0-9_.]{3,20}$/.test(mc.trim())) return toast('Enter your Minecraft username (3-20 letters, numbers or _)', true)
    setBusy(true); setProblem(null)
    try {
      localStorage.setItem('momo_mc_name', mc.trim())
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, mcUsername: mc.trim(), note, items: rows.map((x) => ({ productId: x.p.id, qty: x.qty })) }),
      })
      const d = await r.json()
      if (!r.ok) return setProblem(d)
      cart.clear(mode)
      toast('Ticket created, opening Discord…')
      location.href = d.url
    } catch {
      setProblem({ error: 'Network problem, please try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="cart-bg" onClick={cart.closeCart} />
      <aside className="cart" role="dialog" aria-label={`${info.name} cart`} style={{ ['--pc' as string]: info.accent }}>
        <header>
          <h2><ShoppingCart size={20} /> {info.name} cart</h2>
          <button className="drawer-x" aria-label="Close cart" onClick={cart.closeCart}><X size={20} /></button>
        </header>

        {rows.length === 0 ? (
          <p className="cart-empty">Your {info.name} cart is empty. Add a rank, key or coin pack to get started.</p>
        ) : (
          <>
            <ul className="cart-list">
              {rows.map(({ p, qty }) => (
                <li key={p.id}>
                  <span className="ci">{p.icon}</span>
                  <div>
                    <b>{p.name}</b>
                    <small>{formatPrice(s.currency, p.price) ?? 'Price on request'}{p.price != null && qty > 1 ? ` × ${qty}` : ''}</small>
                  </div>
                  <div className="qty">
                    <button aria-label="Less" onClick={() => (qty > 1 ? cart.setQty(mode, p.id, qty - 1) : cart.remove(mode, p.id))}>{qty > 1 ? <Minus size={14} /> : <Trash2 size={14} />}</button>
                    <span>{qty}</span>
                    <button aria-label="More" onClick={() => cart.setQty(mode, p.id, qty + 1)}><Plus size={14} /></button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="cart-form">
              <label className="field"><span>Minecraft username *</span><input value={mc} onChange={(e) => setMc(e.target.value)} placeholder="e.g. Steve_123" autoComplete="off" /></label>
              <label className="field"><span>Note (optional)</span><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything staff should know" style={{ minHeight: 60 }} /></label>
            </div>

            {problem && (
              <div className="cart-problem">
                <p>{problem.error}</p>
                {problem.code === 'not_member' && problem.invite && <a className="btn btn-discord btn-sm" href={problem.invite} target="_blank" rel="noopener"><DiscordIcon size={16} /> Join the Discord</a>}
                {problem.code === 'open_ticket' && problem.url && <a className="btn btn-discord btn-sm" href={problem.url}><DiscordIcon size={16} /> Open my ticket</a>}
              </div>
            )}

            <section className="cart-bill" aria-label="Billing">
              <h3>Billing</h3>
              {rows.map(({ p, qty }) => (
                <div key={p.id} className="bill-row">
                  <span>{p.icon} {p.name}{qty > 1 ? ` × ${qty}` : ''}</span>
                  <b>{p.price != null ? formatPrice(s.currency, p.price * qty) : 'On request'}</b>
                </div>
              ))}
              <div className="bill-row bill-sum"><span>Items</span><b>{rows.reduce((a, r) => a + r.qty, 0)}</b></div>
            </section>

            <footer>
              <div className="cart-total"><span>Total to pay</span><b>{formatPrice(s.currency, total) ?? `${s.currency}0`}</b></div>
              {unpriced && <small className="help">Items with "price on request" will be quoted by staff in your ticket.</small>}
              <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy || !open} onClick={pay}>
                {busy ? 'Creating your ticket…' : open ? 'Order now · open Discord ticket' : 'Store closed'}
              </button>
              <small className="help">The bot opens a private Discord ticket for you and sends your bill and a payment QR there.</small>
            </footer>
          </>
        )}
      </aside>
    </>
  )
}
