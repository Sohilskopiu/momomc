import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronRight, Copy, FileText, Gift, Heart, Home, LogOut, ShieldCheck, ThumbsUp, TreePine, X } from 'lucide-react'
import { DiscordIcon } from '@/components/Cards'
import { modeName } from '@/lib/modes'
import { copy, fullAddress, img, useDiscordUser, useSite } from '@/lib/ui'

// Each game mode opens its own page with its own sections and store. The names come from Admin Panel > Game Modes.
const LINKS = [
  { to: '/survival', mode: 'survival', icon: TreePine, hint: 'Claims, jobs & economy' },
  { to: '/lifesteal', mode: 'lifesteal', icon: Heart, hint: 'Steal hearts, survive' },
] as const

export default function Header() {
  const { settings: s } = useSite()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const addr = fullAddress(s.ip, s.port)
  const { user, logout } = useDiscordUser()

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 10)
    on()
    addEventListener('scroll', on, { passive: true })
    return () => removeEventListener('scroll', on)
  }, [])

  // Drawer: close on Escape and lock page scroll while open
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open])
  const close = () => setOpen(false)

  return (
    <>
      {s.tickerText && (
        <div className="ticker">
          <div className="ticker-track">
            {[0, 1, 2].map((i) => <span key={i}>✦ {s.tickerText}</span>)}
          </div>
        </div>
      )}
      <header className={'nav' + (scrolled ? ' scrolled' : '')}>
        <div className="wrap nav-inner">
          <button className={'burger' + (open ? ' is-open' : '')} aria-label="Open menu" aria-expanded={open} aria-controls="side-drawer" onClick={() => setOpen(true)}>
            <span /><span /><span />
          </button>
          <Link to="/" className="nav-logo" aria-label={s.serverName}>
            <img src={img('/img/momo-logo.png', 200)} alt={s.serverName} width={76} height={50} />
          </Link>
          <nav className="nav-links">
            <Link to="/" activeOptions={{ exact: true }} activeProps={{ className: 'active' }}>Home</Link>
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} activeProps={{ className: 'active' }}>{modeName(s, l.mode)}</Link>
            ))}
            <Link to="/vote" activeProps={{ className: 'active' }}>Vote</Link>
            <Link to="/redeem" activeProps={{ className: 'active' }}>Redeem</Link>
          </nav>
          <button className="ip-chip" onClick={() => copy(addr, 'Server IP copied')}>
            {s.ip.toUpperCase()} <span className="c"><Copy size={12} style={{ display: 'inline', marginRight: 4 }} />COPY</span>
          </button>
          {user && (
            <div className="user-chip" title={`Logged in as ${user.username}`}>
              <img src={user.avatar} alt="" width={28} height={28} />
              <span>{user.name}</span>
              <button aria-label="Log out" onClick={logout}><LogOut size={15} /></button>
            </div>
          )}
        </div>
      </header>
      <div className={'drawer-bg' + (open ? ' open' : '')} onClick={close} aria-hidden />
      <aside id="side-drawer" className={'drawer' + (open ? ' open' : '')} aria-label="Site menu" aria-hidden={!open} inert={!open}>
        <div className="drawer-head">
          <img src={img('/img/momo-logo.png', 200)} alt={s.serverName} height={46} />
          <button className="drawer-x" aria-label="Close menu" onClick={close}><X size={20} /></button>
        </div>

        <p className="drawer-label">Menu</p>
        <nav className="drawer-nav">
          <Link to="/" onClick={close} style={{ '--i': 0 } as React.CSSProperties} activeOptions={{ exact: true }} activeProps={{ className: 'active' }}>
            <span className="d-ic"><Home size={18} /></span>
            <span className="d-tx"><b>Home</b><small>Back to the main page</small></span>
            <ChevronRight size={16} className="d-go" />
          </Link>
          {LINKS.map((l, i) => (
            <Link key={l.to} to={l.to} onClick={close} style={{ '--i': i + 1 } as React.CSSProperties}
              activeProps={{ className: 'active' }}>
              <span className="d-ic"><l.icon size={18} /></span>
              <span className="d-tx"><b>{modeName(s, l.mode)}</b><small>{l.hint}</small></span>
              <ChevronRight size={16} className="d-go" />
            </Link>
          ))}
          <Link to="/vote" onClick={close} style={{ '--i': LINKS.length + 1 } as React.CSSProperties} activeProps={{ className: 'active' }}>
            <span className="d-ic"><ThumbsUp size={18} /></span>
            <span className="d-tx"><b>Vote</b><small>Vote and get rewards</small></span>
            <ChevronRight size={16} className="d-go" />
          </Link>
          <Link to="/redeem" onClick={close} style={{ '--i': LINKS.length + 2 } as React.CSSProperties} activeProps={{ className: 'active' }}>
            <span className="d-ic"><Gift size={18} /></span>
            <span className="d-tx"><b>Redeem</b><small>Use a code, get a reward</small></span>
            <ChevronRight size={16} className="d-go" />
          </Link>
          <Link to="/terms" onClick={close} style={{ '--i': LINKS.length + 3 } as React.CSSProperties} activeProps={{ className: 'active' }}>
            <span className="d-ic"><FileText size={18} /></span>
            <span className="d-tx"><b>Terms &amp; Refund</b><small>Read before you buy</small></span>
            <ChevronRight size={16} className="d-go" />
          </Link>
          <a href={s.discordInvite} target="_blank" rel="noopener" onClick={close} style={{ '--i': LINKS.length + 3 } as React.CSSProperties}>
            <span className="d-ic"><DiscordIcon size={18} /></span>
            <span className="d-tx"><b>Discord</b><small>Join the community</small></span>
            <ChevronRight size={16} className="d-go" />
          </a>
          {/* Opens the admin login. Logged in with the owner's Discord account, it signs in automatically. */}
          <a href="/admin" onClick={close} style={{ '--i': LINKS.length + 4 } as React.CSSProperties}>
            <span className="d-ic"><ShieldCheck size={18} /></span>
            <span className="d-tx"><b>Admin Panel</b><small>Owner &amp; admin login</small></span>
            <ChevronRight size={16} className="d-go" />
          </a>
        </nav>

        <div className="drawer-foot">
          <button className="btn btn-primary" onClick={() => copy(addr, 'Server IP copied')}><Copy size={15} /> {addr}</button>
          {user && (
            <button className="btn btn-ghost" onClick={logout}>
              <img src={user.avatar} alt="" width={22} height={22} style={{ borderRadius: 99 }} /> {user.name} · Log out
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
