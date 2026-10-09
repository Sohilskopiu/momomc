import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Eye, Megaphone, MoreVertical, Pin, ShoppingCart, X } from 'lucide-react'
import type { Announcement, Product } from '@/lib/types'
import { useCart } from '@/lib/cart'
import { storeIsOpen } from '@/lib/modes'
import { formatPrice, timeAgo, toast, useSite, useTilt } from '@/lib/ui'

// Three-dot menu on a rank card. Tapping "View perks" opens a sheet (bottom sheet on phones, centred dialog on desktop).
function PerksMenu({ p, price, open: storeOpen, onAdd }: { p: Product; price: string | null; open: boolean; onAdd: () => void }) {
  const [menu, setMenu] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [mounted, setMounted] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => setMounted(true), [])

  // Close the small menu on outside tap / Escape
  useEffect(() => {
    if (!menu) return
    const down = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setMenu(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false) }
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key) }
  }, [menu])

  // Sheet: Escape closes it, page behind does not scroll
  useEffect(() => {
    if (!sheet) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheet(false) }
    document.addEventListener('keydown', key)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = prev }
  }, [sheet])

  return (
    <div className="dots-wrap" ref={wrap}>
      <button type="button" className="dots-btn" aria-label={`${p.name} options`} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
        <MoreVertical size={18} />
      </button>
      {menu && (
        <div className="dots-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => { setMenu(false); setSheet(true) }}>
            <Eye size={16} /> View perks
          </button>
        </div>
      )}
      {mounted && sheet && createPortal(
        <div className="perks-back" onClick={() => setSheet(false)}>
          <div className="perks-sheet glass" role="dialog" aria-modal="true" aria-label={`${p.name} perks`} style={{ ['--pc' as string]: p.color }} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="perks-x" aria-label="Close" onClick={() => setSheet(false)}><X size={18} /></button>
            <div className="perks-head">
              <div className="p-ic-sm">{p.icon}</div>
              <div>
                <h3>{p.name}</h3>
                <div className="perks-sub">{price ?? 'Price on request'}{p.durationDays ? ` · ${p.durationDays} day${p.durationDays === 1 ? '' : 's'}` : ''}</div>
              </div>
            </div>
            <div className="perks-title">Perks</div>
            <ul className="perks">{p.perks.map((x) => <li key={x}>{x}</li>)}</ul>
            <button className={'btn ' + (price ? 'btn-primary' : 'btn-ghost')} disabled={!storeOpen} onClick={() => { onAdd(); setSheet(false) }}>
              <ShoppingCart size={16} /> {storeOpen ? 'Add to cart' : 'Store closed'}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

export function ProductCard({ p, i }: { p: Product; i: number }) {
  const { settings: s } = useSite()
  const cart = useCart()
  const tilt = useTilt<HTMLElement>(8)
  const price = formatPrice(s.currency, p.price)
  const open = storeIsOpen(s, p.mode)
  const add = () => { cart.add(p); toast(`${p.name} added to cart`) }
  // Ranks hide their perks behind the three-dot menu; other items keep the list inline.
  const hidePerks = p.category === 'ranks' && p.perks.length > 0
  return (
    <article
      {...tilt}
      className={'glass tilt shine product reveal' + (p.popular ? ' popular' : '')}
      style={{ ['--pc' as string]: p.color, ['--d' as string]: `${(i % 8) * 60}ms` }}
    >
      {p.tag && <span className="tag">{p.tag}</span>}
      {p.popular && <span className={'ribbon' + (hidePerks ? ' ribbon-shift' : '')}>POPULAR</span>}
      {hidePerks && <PerksMenu p={p} price={price} open={open} onAdd={add} />}
      <div className="p-ic pop">{p.icon}</div>
      <h3 className="pop">{p.name}</h3>
      {p.durationDays ? <div className="p-days">⏳ Lasts {p.durationDays} day{p.durationDays === 1 ? '' : 's'}</div> : null}
      {price ? (
        <div className="price">{price}{p.oldPrice ? <s>{formatPrice(s.currency, p.oldPrice)}</s> : null}</div>
      ) : (
        <div className="price soon">Price on request</div>
      )}
      {!hidePerks && p.perks.length > 0 && <ul className="perks">{p.perks.map((x) => <li key={x}>{x}</li>)}</ul>}
      <button
        className={'btn ' + (price ? 'btn-primary' : 'btn-ghost')}
        onClick={add}
        disabled={!open}
      >
        <ShoppingCart size={16} /> {open ? 'Add to cart' : 'Store closed'}
      </button>
    </article>
  )
}

export function AnnouncementCard({ a, i = 0 }: { a: Announcement; i?: number }) {
  const dc = a.source === 'discord'
  return (
    <article className={'glass ann reveal' + (a.pinned ? ' pinned' : '')} style={{ ['--d' as string]: `${i * 80}ms` }}>
      <div className={'ai' + (dc ? ' dc' : '')}>{dc ? <DiscordIcon /> : <Megaphone size={22} />}</div>
      <div>
        <div className="meta">
          {a.pinned && <span className="badge soon"><Pin size={11} /> Pinned</span>}
          <span className="badge">{a.tag}</span>
          <span>by <b style={{ color: '#dbeafe' }}>{a.author}</b></span>
          <span>· {timeAgo(a.createdAt)}</span>
          {dc && <span>· via Discord</span>}
        </div>
        <h3>{a.title}</h3>
        <p>{a.body}</p>
      </div>
    </article>
  )
}

export function DiscordIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}
