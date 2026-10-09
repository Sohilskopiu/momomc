import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Mode, Product } from './types'

// Each game mode has its own cart, because each mode has its own store and its own Discord ticket.
type Line = { id: number; qty: number }
type CartState = Record<Mode, Line[]>
const KEY = 'momo_cart_v1'
const EMPTY: CartState = { survival: [], lifesteal: [] }

type Ctx = {
  lines: (m: Mode) => Line[]
  count: (m: Mode) => number
  add: (p: Product) => void
  setQty: (m: Mode, id: number, qty: number) => void
  remove: (m: Mode, id: number) => void
  clear: (m: Mode) => void
  open: Mode | null
  openCart: (m: Mode) => void
  closeCart: () => void
}

const CartContext = createContext<Ctx | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartState>(EMPTY)
  const [open, setOpen] = useState<Mode | null>(null)
  const [ready, setReady] = useState(false)

  // Read after mount so server and browser render the same first HTML.
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
      if (raw && Array.isArray(raw.survival) && Array.isArray(raw.lifesteal)) setCart({ survival: raw.survival, lifesteal: raw.lifesteal })
    } catch { /* ignore corrupted cart */ }
    setReady(true)
  }, [])
  useEffect(() => {
    if (ready) try { localStorage.setItem(KEY, JSON.stringify(cart)) } catch { /* private mode */ }
  }, [cart, ready])

  const add = useCallback((p: Product) => {
    setCart((c) => {
      const list = c[p.mode]
      const has = list.find((l) => l.id === p.id)
      return { ...c, [p.mode]: has ? list.map((l) => (l.id === p.id ? { ...l, qty: Math.min(20, l.qty + 1) } : l)) : [...list, { id: p.id, qty: 1 }] }
    })
  }, [])
  const setQty = useCallback((m: Mode, id: number, qty: number) => {
    setCart((c) => ({ ...c, [m]: c[m].map((l) => (l.id === id ? { ...l, qty: Math.max(1, Math.min(20, qty)) } : l)) }))
  }, [])
  const remove = useCallback((m: Mode, id: number) => setCart((c) => ({ ...c, [m]: c[m].filter((l) => l.id !== id) })), [])
  const clear = useCallback((m: Mode) => setCart((c) => ({ ...c, [m]: [] })), [])

  const value = useMemo<Ctx>(() => ({
    lines: (m) => cart[m],
    count: (m) => cart[m].reduce((a, l) => a + l.qty, 0),
    add, setQty, remove, clear, open,
    openCart: setOpen,
    closeCart: () => setOpen(null),
  }), [cart, add, setQty, remove, clear, open])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const c = useContext(CartContext)
  if (!c) throw new Error('useCart must be used inside CartProvider')
  return c
}
