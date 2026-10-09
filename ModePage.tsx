import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Copy, ShoppingCart, Smartphone } from 'lucide-react'
import ModeStatus from '@/components/ModeStatus'
import { ProductCard } from '@/components/Cards'
import { modeCfg, modeName, modeServer, storeIsOpen, visibleCategories } from '@/lib/modes'
import { useCart } from '@/lib/cart'
import type { Mode } from '@/lib/types'
import { copy, formatPrice, fullAddress, useReveal, useSite } from '@/lib/ui'

// One page per game mode. The section bar jumps between Overview, each store category and How to buy.
export default function ModePage({ mode }: { mode: Mode }) {
  const { settings: s, products } = useSite()
  const cart = useCart()
  const cfg = modeCfg(s, mode)
  const info = { ...cfg, name: modeName(s, mode) }
  const srv = modeServer(s, mode)
  const open = storeIsOpen(s, mode)
  const addr = fullAddress(srv.ip, srv.port)
  const cats = visibleCategories(cfg, mode)
  const [active, setActive] = useState('overview')
  const live = cfg.status === 'live'
  const count = cart.count(mode)
  const total = cart.lines(mode).reduce((a, l) => a + (products.find((p) => p.id === l.id && p.mode === mode)?.price ?? 0) * l.qty, 0)
  useReveal(mode)

  const jump = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    setActive(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const sections = [
    { id: 'overview', label: 'Overview' },
    ...cats.map((c) => ({ id: c, label: cfg.categories[c].label })),
    { id: 'how', label: 'How to buy' },
  ]

  return (
    <div className="wrap mode-page" style={{ ['--ma' as string]: info.accent }}>
      <section className="mode-hero">
        <div className="mode-emoji pop" aria-hidden>{info.emoji}</div>
        <h1 className="font-display">{info.name}</h1>
        <p className="lead">{info.tagline}</p>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={() => copy(addr, 'Server IP copied')}><Copy size={17} /> {addr}</button>
          {srv.bedrockIp && (
            <button className="btn btn-ghost" onClick={() => copy(srv.bedrockIp + ':' + srv.bedrockPort, 'Bedrock IP copied')}><Smartphone size={17} /> Bedrock</button>
          )}
          <span className={'badge ' + (live ? 'live' : 'soon')}>{live ? '● Live now' : 'Coming soon'}</span>
        </div>
        <div className="hero-actions" style={{ marginTop: 14 }}>
          <ModeStatus mode={mode} />
          <span className="mstat">Version {srv.version}</span>
        </div>
      </section>

      <nav className="mode-nav" aria-label={`${info.name} sections`}>
        {sections.map((x) => (
          <a key={x.id} href={'#' + x.id} className={active === x.id ? 'active' : ''} onClick={jump(x.id)}>{x.label}</a>
        ))}
        <Link to="/vote" search={{ mode }}>Vote</Link>
        <Link to="/redeem" search={{ mode }}>Redeem</Link>
        <Link to="/terms" search={{ mode }}>Terms & Refund</Link>
      </nav>

      <section id="overview" className="mode-sec">
        <div className="sec-head reveal"><div><h2 className="h2">About {info.name}</h2><p className="lead">{info.about}</p></div></div>
        <div className="feat-grid">
          {info.highlights.map((h, i) => (
            <div key={h.title} className="glass feat reveal" style={{ ['--d' as string]: `${i * 70}ms` }}>
              <div className="fi">{h.icon}</div>
              <h3>{h.title}</h3>
              <p>{h.text}</p>
            </div>
          ))}
        </div>
      </section>

      {cats.map((c) => {
        const items = products.filter((p) => p.mode === mode && p.category === c)
        return (
          <section key={c} id={c} className="mode-sec">
            <div className="sec-head reveal">
              <div>
                <h2 className="h2">{cfg.categories[c].icon} {cfg.categories[c].label}</h2>
                {cfg.categories[c].description && <p className="lead">{cfg.categories[c].description}</p>}
              </div>
            </div>
            {!open && <p className="badge soon" style={{ marginBottom: 18 }}>The store is temporarily closed</p>}
            {items.length ? (
              <div className="product-grid">{items.map((p, i) => <ProductCard key={p.id} p={p} i={i} />)}</div>
            ) : (
              <div className="glass" style={{ padding: 32, textAlign: 'center', color: 'var(--mut)' }}>Nothing here yet for {info.name}. Check back soon.</div>
            )}
          </section>
        )
      })}

      <section id="how" className="mode-sec">
        <div className="sec-head reveal"><div><h2 className="h2">How to buy in {info.name}</h2><p className="lead">Everything happens in a private Discord ticket that only you and the {info.name} staff can see.{cfg.storeNote ? ` ${cfg.storeNote}` : ''}</p></div></div>
        <ol className="steps" style={{ padding: 0 }}>
          {[
            ['Add to cart', 'Pick ranks, keys, coins' + (mode === 'survival' ? ' or claim blocks.' : '.')],
            ['Continue to payment', 'You are taken to Discord.'],
            ['Ticket opens', 'The bot adds you and sends your bill and a payment QR.'],
            ['Pay & send a screenshot', 'Post the proof in the ticket.'],
            ['Settled', 'The owner confirms, you get pinged, then staff deliver.'],
          ].map(([b, t], i) => (
            <li key={b} className="glass reveal" style={{ ['--d' as string]: `${i * 60}ms` }}><b>{b}</b><span>{t}</span></li>
          ))}
        </ol>
      </section>

      {/* Appears at the bottom as soon as something is in the cart */}
      {count > 0 && (
        <button className="cart-bar" onClick={() => cart.openCart(mode)} aria-label={`See ${info.name} cart`}>
          <span className="cb-ic"><ShoppingCart size={20} /><b>{count}</b></span>
          <span className="cb-tx"><strong>See cart</strong><small>{count} item{count > 1 ? 's' : ''}{total > 0 ? ` · ${formatPrice(s.currency, total)}` : ''}</small></span>
          <span className="cb-go">View &amp; pay →</span>
        </button>
      )}
    </div>
  )
}
