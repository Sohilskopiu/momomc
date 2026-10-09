import { useCallback, useEffect, useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import {
  BarChart3, Boxes, Eye, EyeOff, Gamepad2, Gift, Globe, LayoutGrid, Lock, LogOut, Megaphone, Palette, ReceiptText, RefreshCw, Rocket, Server, Shield,
} from 'lucide-react'
import { DiscordIcon } from '@/components/Cards'
import { img, toast } from '@/lib/ui'
import type { AdminData, SiteSettings } from '@/lib/types'
import {
  type Api, type TabId, AnnouncementsTab, BrandingTab, DeployTab, RedeemTab, ThemeTab, CategoriesTab, DashboardTab, DiscordTab, ModesTab, OrdersTab, ProductsTab, SecurityTab, ServerTab,
} from '@/components/admin/Tabs'

export const Route = createFileRoute('/admin')({
  head: () => ({ meta: [{ title: 'Admin Panel — MOMO MC' }, { name: 'robots', content: 'noindex' }] }),
  component: Admin,
})

const KEY = 'momo_admin_token'
const MANUAL = 'momo_admin_manual_logout'

// Asks the server whether this browser is logged in to the site with the owner's Discord account.
async function ownerToken(): Promise<string | null> {
  try {
    const r = await fetch('/api/admin/owner', { cache: 'no-store' })
    const d = await r.json()
    return d.owner ? (d.token as string) : null
  } catch {
    return null
  }
}

function Admin() {
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [owner, setOwner] = useState(false)
  const save = (t: string) => { sessionStorage.setItem(KEY, t); sessionStorage.removeItem(MANUAL); setToken(t) }
  useEffect(() => {
    (async () => {
      const saved = sessionStorage.getItem(KEY)
      if (saved) setToken(saved)
      else {
        // Owner Discord account: straight into the panel, unless the owner just pressed Log out.
        const t = await ownerToken()
        setOwner(!!t)
        if (t && !sessionStorage.getItem(MANUAL)) save(t)
      }
      setReady(true)
    })()
  }, [])
  // An expired session is renewed silently for the owner, everyone else goes back to the login form.
  const expire = async () => {
    sessionStorage.removeItem(KEY)
    const t = sessionStorage.getItem(MANUAL) ? null : await ownerToken()
    if (t) save(t)
    else setToken(null)
  }
  if (!ready) return null
  if (!token) return <Login owner={owner} onOwner={async () => { const t = await ownerToken(); if (t) save(t) }} onLogin={save} />
  return <Dashboard token={token} onToken={(t) => { sessionStorage.setItem(KEY, t); setToken(t) }} onExpired={expire} onLogout={() => { sessionStorage.removeItem(KEY); sessionStorage.setItem(MANUAL, '1'); setToken(null) }} />
}

function Login({ onLogin, owner, onOwner }: { onLogin: (t: string) => void; owner: boolean; onOwner: () => void }) {
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [wait, setWait] = useState<{ id: string; poll: string } | null>(null)
  // After the password is accepted, wait until one approver email approves this login.
  useEffect(() => {
    if (!wait) return
    let stop = false
    const tick = async () => {
      try {
        const r = await fetch(`/api/admin/login-status?id=${wait.id}&t=${encodeURIComponent(wait.poll)}`, { cache: 'no-store' })
        const d = await r.json()
        if (stop) return
        if (d.status === 'approved' && d.token) { onLogin(d.token); return }
        if (d.status === 'denied') { setWait(null); setErr('Login was denied by an approver.'); return }
        if (d.status === 'expired') { setWait(null); setErr('Approval request expired. Log in again.'); return }
      } catch { /* try again */ }
      if (!stop) setTimeout(tick, 2500)
    }
    const h = setTimeout(tick, 2500)
    return () => { stop = true; clearTimeout(h) }
  }, [wait])
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      if (d.pending) { setWait({ id: d.id, poll: d.poll }); return }
      onLogin(d.token)
    } catch (e) {
      setErr((e as Error).message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="login-wrap">
      <form className="glass login-card" onSubmit={submit} style={{ animation: 'modalin .6s cubic-bezier(.2,.9,.3,1.2)' }}>
        <img src={img('/img/momo-logo.png', 400)} alt="MOMO MC" style={{ width: 170, margin: '0 auto 8px', animation: 'floaty 6s ease-in-out infinite' }} />
        <span className="eyebrow" style={{ justifyContent: 'center' }}><Lock size={12} /> Restricted</span>
        <h1 className="font-display" style={{ fontSize: 30, fontWeight: 800, margin: '8px 0 22px' }}>Admin Panel</h1>
        <label className="field" style={{ textAlign: 'left' }}><span>Username</span><input value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" required autoFocus /></label>
        <label className="field" style={{ textAlign: 'left' }}>
          <span>Secret password</span>
          <div style={{ position: 'relative' }}>
            <input type={show ? 'text' : 'password'} value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" required style={{ paddingRight: 44 }} />
            <button type="button" onClick={() => setShow(!show)} aria-label="Toggle password" style={{ position: 'absolute', right: 10, top: '50%', translate: '0 -50%', background: 'none', border: 0, cursor: 'pointer', color: 'var(--mut)' }}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
        {err && <p style={{ color: 'var(--bad)', fontWeight: 700, fontSize: 14, margin: '0 0 12px' }}>{err}</p>}
        {wait && <p style={{ color: 'var(--cyan2)', fontWeight: 700, fontSize: 14, margin: '0 0 12px' }}>Password accepted. Waiting for approval in the Discord approval channel… (valid for 10 minutes)</p>}
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy || !!wait}>{wait ? 'Waiting for approval…' : busy ? 'Checking…' : 'Log in'}</button>
 
        {owner ? (
          <button type="button" className="btn btn-discord" style={{ width: '100%', marginTop: 10 }} onClick={onOwner}><DiscordIcon size={18} /> Continue as owner</button>
        ) : (
          <a className="btn btn-discord" style={{ width: '100%', marginTop: 10 }} href="/api/auth/discord?return=%2Fadmin"><DiscordIcon size={18} /> Login with Discord (owner)</a>
        )}
        <Link to="/" className="help" style={{ display: 'inline-block', marginTop: 18 }}>← Back to website</Link>
      </form>
    </div>
  )
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'modes', label: 'Game Modes', icon: Gamepad2 },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'products', label: 'Store Items & Prices', icon: Boxes },
  { id: 'categories', label: 'Store Categories', icon: LayoutGrid },
  { id: 'orders', label: 'Orders', icon: ReceiptText },
  { id: 'redeem', label: 'Redeem Codes', icon: Gift },
  { id: 'server', label: 'Server & Links', icon: Server },
  { id: 'discord', label: 'Discord Sync', icon: DiscordIcon },
  { id: 'theme', label: 'Theme & Logo', icon: Palette },
  { id: 'branding', label: 'Branding & Content', icon: Palette },
  { id: 'deploy', label: 'Deploy', icon: Rocket },
  { id: 'security', label: 'Security', icon: Shield },
] as const

function Dashboard({ token, onToken, onLogout, onExpired }: { token: string; onToken: (t: string) => void; onLogout: () => void; onExpired: () => void }) {
  const [data, setData] = useState<AdminData | null>(null)
  const router = useRouter()
  const [tab, setTab] = useState<TabId>('dashboard')
  const [draft, setDraft] = useState<SiteSettings | null>(null)

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/data', { headers: { Authorization: `Bearer ${token}` } })
    if (r.status === 401) return onExpired()
    const d: AdminData = await r.json()
    setData(d)
    setDraft(d.settings)
  }, [token, onExpired])

  useEffect(() => { load() }, [load])

  const api: Api = useCallback(async (action, payload = {}) => {
    const r = await fetch('/api/admin/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, payload }),
    })
    if (r.status === 401) { onExpired(); return false }
    const d = await r.json()
    if (!r.ok) { toast(d.error || 'Failed', true); return false }
    if (d.token) onToken(d.token)
    setData(d.data)
    if (action === 'saveSettings') setDraft(d.data.settings)
    if (action === 'saveSettings' || action === 'setLogo' || action === 'resetLogo') router.invalidate() // the live site picks up the new theme / logo
    if (d.message) toast(d.message)
    return true
  }, [token, onExpired, onToken, router])

  if (!data || !draft) {
    return <div className="login-wrap"><div className="skeleton" style={{ width: 240, height: 18 }} /></div>
  }

  const pending = data.orders.filter((o) => o.status === 'pending').length
  const props = { data, api, draft, setDraft, setTab }

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div className="side-extra" style={{ padding: '4px 8px 18px' }}>
          <img src={img('/img/momo-logo.png', 300)} alt="" style={{ width: 120 }} />
          <small style={{ color: 'var(--mut)', fontWeight: 700, letterSpacing: '.14em', fontSize: 10.5 }}>ADMIN PANEL</small>
        </div>
        {TABS.map((t) => (
          <button key={t.id} className={'tab' + (tab === t.id ? ' active' : '')} onClick={() => { setTab(t.id); scrollTo({ top: 0 }) }}>
            <t.icon size={17} /> {t.label}
            {t.id === 'orders' && pending > 0 && <span className="count">{pending}</span>}
          </button>
        ))}
        <div className="side-extra" style={{ marginTop: 'auto', display: 'grid', gap: 8, paddingTop: 20 }}>
          <a className="btn btn-ghost btn-sm" href="/" target="_blank" rel="noopener"><Globe size={15} /> View website</a>
          <button className="btn btn-danger btn-sm" onClick={onLogout}><LogOut size={15} /> Log out</button>
        </div>
      </aside>
      <section className="admin-main">
        <div className="admin-top">
          <div>
            <small className="eyebrow">MOMO MC · Control center</small>
            <h1>{TABS.find((t) => t.id === tab)?.label}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => load().then(() => toast('Refreshed'))}><RefreshCw size={15} /> Refresh</button>
            <button className="btn btn-danger btn-sm" onClick={onLogout}><LogOut size={15} /> Log out</button>
          </div>
        </div>
        <div key={tab} className="tab-panel">
        {tab === 'dashboard' && <DashboardTab {...props} />}
        {tab === 'modes' && <ModesTab {...props} />}
        {tab === 'announcements' && <AnnouncementsTab {...props} />}
        {tab === 'products' && <ProductsTab {...props} />}
        {tab === 'categories' && <CategoriesTab {...props} />}
        {tab === 'orders' && <OrdersTab {...props} />}
        {tab === 'server' && <ServerTab {...props} />}
        {tab === 'discord' && <DiscordTab {...props} />}
        {tab === 'redeem' && <RedeemTab {...props} />}
        {tab === 'deploy' && <DeployTab {...props} />}
        {tab === 'theme' && <ThemeTab {...props} />}
        {tab === 'branding' && <BrandingTab {...props} />}
        {tab === 'security' && <SecurityTab {...props} />}
        </div>
      </section>
    </div>
  )
}
