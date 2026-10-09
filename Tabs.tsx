import { useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw, Rocket, Save, Send, Trash2, Pencil, Pin, ExternalLink } from 'lucide-react'
import { DiscordIcon } from '@/components/Cards'
import { CATEGORIES, MODES } from '@/lib/types'
import { MODE_NAME, categoryList, modeCfg, modeName, modeServer } from '@/lib/modes'
import type { AdminData, Announcement, Category, Mode, ModeConfig, Order, Product, SiteSettings, TicketSettings } from '@/lib/types'
import { DEFAULT_LOGO, copy, formatPrice, timeAgo, toast, useServerStatus } from '@/lib/ui'
import { DEFAULT_THEME, THEME_PRESETS, themeCssPreview } from '@/lib/theme'

export type Api = (action: string, payload?: unknown) => Promise<boolean>
export type TabId =
  | 'dashboard' | 'modes' | 'announcements' | 'products' | 'categories' | 'orders'
  | 'redeem' | 'deploy' | 'server' | 'discord' | 'theme' | 'branding' | 'security'

type Props = {
  data: AdminData
  api: Api
  draft: SiteSettings
  setDraft: React.Dispatch<React.SetStateAction<SiteSettings | null>>
  setTab: (t: TabId) => void
}

// ---------- small building blocks ----------
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small className="help">{hint}</small>}
    </label>
  )
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className={'glass modal' + (wide ? ' wide' : '')} onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display" style={{ fontSize: 22, fontWeight: 800, margin: '0 0 18px' }}>{title}</h2>
        {children}
      </div>
    </div>
  )
}

function SaveBar({ draft, api, label = 'Save changes' }: { draft: SiteSettings; api: Api; label?: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <div style={{ position: 'sticky', bottom: 16, display: 'flex', justifyContent: 'flex-end', zIndex: 5 }}>
      <button className="btn btn-primary" disabled={busy} onClick={async () => { setBusy(true); await api('saveSettings', draft); setBusy(false) }}>
        <Save size={17} /> {busy ? 'Saving…' : label}
      </button>
    </div>
  )
}

const confirmDo = (msg: string, fn: () => unknown) => { if (confirm(msg)) fn() }

// ================= Dashboard =================
// Live status of one game mode, checked against that mode's own address.
function ModeKpi({ s, mode }: { s: SiteSettings; mode: Mode }) {
  const a = modeServer(s, mode)
  const status = useServerStatus(a.ip, a.port)
  return (
    <div className="glass kpi"><small>{modeName(s, mode)} server</small><b style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className={'dot ' + (status.loading ? '' : status.online ? 'on' : 'off')} />{status.loading ? '…' : status.online ? `${status.players} online` : 'Offline'}</b></div>
  )
}

export function DashboardTab({ data, setTab }: Props) {
  const s = data.settings
  const count = (st: Order['status']) => data.orders.filter((o) => o.status === st).length
  const revenue = data.orders.filter((o) => o.status === 'paid' || o.status === 'delivered').reduce((a, o) => a + (o.price ?? 0), 0)
  return (
    <>
      <div className="kpis">
        {MODES.map((m) => <ModeKpi key={m} s={s} mode={m} />)}
        <div className="glass kpi"><small>Pending orders</small><b style={{ color: '#fde68a' }}>{count('pending')}</b></div>
        <div className="glass kpi"><small>Revenue (paid + delivered)</small><b>{formatPrice(s.currency, revenue)}</b></div>
        <div className="glass kpi"><small>Store items</small><b>{data.products.filter((p) => p.active).length}<span style={{ fontSize: 16, color: 'var(--mut)' }}> / {data.products.length}</span></b></div>
      </div>
      <div className="grid2">
        <div className="glass panel">
          <h2>Recent orders</h2>
          {data.orders.slice(0, 6).map((o) => (
            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <div><b>#{o.id} · {o.productName}</b><div className="help">{modeName(s, o.mode)} · {o.mcUsername} · {timeAgo(o.createdAt)}</div></div>
              <span className={'status ' + o.status}>{o.status}</span>
            </div>
          ))}
          {!data.orders.length && <p className="help">No orders yet.</p>}
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={() => setTab('orders')}>Manage orders</button>
        </div>
        <div className="glass panel">
          <h2>Quick actions</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            <button className="btn btn-primary" onClick={() => setTab('announcements')}><Send size={16} /> Post an announcement</button>
            <button className="btn btn-ghost" onClick={() => setTab('products')}>Add sell item / edit prices</button>
            <button className="btn btn-ghost" onClick={() => setTab('server')}>Change server IP / port / Discord link</button>
          </div>
          <p className="help" style={{ marginTop: 16 }}>
            Discord sync: {data.private.hasWebhook ? '✅ webhook' : '⚪ no webhook'} · {data.private.hasBotToken || data.private.envBotToken ? '✅ bot' : '⚪ no bot'}
            {data.private.lastDiscordSync && <> · last sync {timeAgo(data.private.lastDiscordSync)}</>}
          </p>
        </div>
      </div>
    </>
  )
}

// ================= Announcements =================
export function AnnouncementsTab({ data, api }: Props) {
  const empty = { id: 0, title: '', body: '', tag: 'News', pinned: false, sendToDiscord: data.private.autoPostToDiscord && data.private.hasWebhook }
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const edit = (a: Announcement) => { setForm({ id: a.id, title: a.title, body: a.body, tag: a.tag, pinned: a.pinned, sendToDiscord: false }); scrollTo({ top: 0, behavior: 'smooth' }) }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    if (await api('saveAnnouncement', form)) setForm(empty)
    setBusy(false)
  }
  return (
    <>
      <form className="glass panel" onSubmit={submit}>
        <h2>{form.id ? 'Edit announcement' : 'New announcement'}</h2>
        <div className="grid2">
          <Field label="Title"><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Big update is live!" /></Field>
          <Field label="Tag"><input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="News / Update / Event / Store" list="ann-tags" /></Field>
        </div>
        <datalist id="ann-tags"><option value="News" /><option value="Update" /><option value="Event" /><option value="Store" /><option value="Maintenance" /><option value="Giveaway" /></datalist>
        <Field label="Message"><textarea required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={5} placeholder="Write your announcement…" /></Field>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="check"><input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} /> Pin to top</label>
          {!form.id && (
            <label className="check" title={data.private.hasWebhook ? '' : 'Add a webhook in Discord Sync first'}>
              <input type="checkbox" disabled={!data.private.hasWebhook} checked={form.sendToDiscord} onChange={(e) => setForm({ ...form, sendToDiscord: e.target.checked })} />
              <DiscordIcon size={16} /> Also post to Discord {!data.private.hasWebhook && <small className="help">(set up webhook first)</small>}
            </label>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {form.id > 0 && <button type="button" className="btn btn-ghost" onClick={() => setForm(empty)}>Cancel</button>}
            <button className="btn btn-primary" disabled={busy}><Send size={16} /> {busy ? 'Publishing…' : form.id ? 'Update' : 'Publish'}</button>
          </div>
        </div>
      </form>

      <div className="glass panel">
        <h2 style={{ justifyContent: 'space-between' }}>
          <span>All announcements ({data.announcements.length})</span>
          <button className="btn btn-ghost btn-sm" onClick={() => api('syncDiscord')}><RefreshCw size={14} /> Sync from Discord</button>
        </h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Title</th><th>Source</th><th>When</th><th /></tr></thead>
            <tbody>
              {data.announcements.map((a) => (
                <tr key={a.id}>
                  <td><b>{a.pinned && '📌 '}{a.title}</b><div className="help" style={{ maxWidth: 480, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.body}</div></td>
                  <td>{a.source === 'discord' ? <span className="badge" style={{ color: '#a5b4fc' }}>Discord</span> : <span className="badge">Web</span>}</td>
                  <td className="help">{timeAgo(a.createdAt)}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ghost btn-sm" title="Pin / unpin" onClick={() => api('saveAnnouncement', { ...a, pinned: !a.pinned })}><Pin size={14} /></button>
                      <button className="btn btn-ghost btn-sm" onClick={() => edit(a)}><Pencil size={14} /></button>
                      <button className="btn btn-danger btn-sm" onClick={() => confirmDo('Delete this announcement?', () => api('deleteAnnouncement', { id: a.id }))}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ================= Products & prices =================
type ProductForm = Omit<Product, 'id' | 'perks' | 'price' | 'oldPrice' | 'durationDays'> & { id?: number; perks: string; price: string; oldPrice: string; durationDays: string }
const toForm = (p?: Product, category: Category = 'ranks', mode: Mode = 'lifesteal'): ProductForm => ({
  id: p?.id, mode: p?.mode ?? mode, category: p?.category ?? category, name: p?.name ?? '', price: p?.price?.toString() ?? '', oldPrice: p?.oldPrice?.toString() ?? '',
  icon: p?.icon ?? '👑', tag: p?.tag ?? '', color: p?.color ?? '#43dcff', perks: (p?.perks ?? []).join('\n'),
  popular: p?.popular ?? false, active: p?.active ?? true, sortOrder: p?.sortOrder ?? 0,
  // New ranks start at 30 days, change it per item. Empty = no time limit.
  durationDays: p ? (p.durationDays?.toString() ?? '') : category === 'ranks' ? '30' : '',
})

export function ProductsTab({ data, api }: Props) {
  const s = data.settings
  const [cat, setCat] = useState<Category>('ranks')
  const [mode, setMode] = useState<Mode>('lifesteal')
  const [edit, setEdit] = useState<ProductForm | null>(null)
  const [prices, setPrices] = useState<Record<number, { name: string; price: string; oldPrice: string; durationDays: string }>>({})
  const mc = modeCfg(s, mode)
  const items = data.products.filter((p) => p.category === cat && p.mode === mode)
  const dirty = Object.keys(prices).length > 0
  // Claim blocks are a Survival-only category.
  const catsFor = (m: Mode) => categoryList(modeCfg(s, m)).filter((c) => c !== 'claims' || m === 'survival')

  const setP = (p: Product, k: 'name' | 'price' | 'oldPrice' | 'durationDays', v: string) =>
    setPrices((x) => ({ ...x, [p.id]: { name: x[p.id]?.name ?? p.name, price: x[p.id]?.price ?? (p.price?.toString() ?? ''), oldPrice: x[p.id]?.oldPrice ?? (p.oldPrice?.toString() ?? ''), durationDays: x[p.id]?.durationDays ?? (p.durationDays?.toString() ?? ''), [k]: v } }))

  const saveAll = async () => {
    const list = Object.entries(prices).map(([id, v]) => ({ id: Number(id), ...v }))
    if (await api('bulkPrices', { items: list })) setPrices({})
  }
  const saveOne = async () => {
    if (!edit) return
    const ok = await api('saveProduct', { ...edit, perks: edit.perks.split('\n').map((x) => x.trim()).filter(Boolean) })
    if (ok) setEdit(null)
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="cat-tabs">
            {MODES.map((m) => (
              <button key={m} className={m === mode ? 'active' : ''} onClick={() => { setMode(m); if (cat === 'claims' && m !== 'survival') setCat('ranks') }} style={{ textTransform: 'capitalize' }}>{m === 'survival' ? '🌲' : '❤️'} {m}</button>
            ))}
          </div>
          <div className="cat-tabs">
            {catsFor(mode).map((c) => (
              <button key={c} className={c === cat ? 'active' : ''} onClick={() => setCat(c)}>{mc.categories[c]?.icon} {mc.categories[c]?.label} <small style={{ opacity: 0.7 }}>({data.products.filter((p) => p.category === c && p.mode === mode).length})</small></button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {dirty && <button className="btn btn-primary" onClick={saveAll}><Save size={16} /> Save {Object.keys(prices).length} change(s)</button>}
          <button className="btn btn-primary" onClick={() => setEdit(toForm(undefined, cat, mode))}><Plus size={16} /> New sell item</button>
        </div>
      </div>

      <div className="glass panel">
        <p className="help" style={{ marginTop: 0 }}>Edit names and prices right in the table, then press <b>Save</b>. Leave price empty to show "Price on request". Use ✏️ for icon, colour, perks and more.</p>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th style={{ width: 50 }} /><th>Name</th><th>Price ({s.currency})</th><th>Old price</th><th>Days</th><th>Status</th><th /></tr></thead>
            <tbody>
              {items.map((p) => {
                const v = prices[p.id]
                return (
                  <tr key={p.id} style={{ opacity: p.active ? 1 : 0.5 }}>
                    <td style={{ fontSize: 26 }}>{p.icon}</td>
                    <td><input className="input" value={v?.name ?? p.name} onChange={(e) => setP(p, 'name', e.target.value)} style={{ minWidth: 140, color: p.color, fontWeight: 700 }} /></td>
                    <td><input className="input" type="number" min={0} value={v?.price ?? (p.price ?? '')} placeholder="On request" onChange={(e) => setP(p, 'price', e.target.value)} style={{ width: 130 }} /></td>
                    <td><input className="input" type="number" min={0} value={v?.oldPrice ?? (p.oldPrice ?? '')} placeholder="—" onChange={(e) => setP(p, 'oldPrice', e.target.value)} style={{ width: 110 }} /></td>
                    <td><input className="input" type="number" min={0} value={v?.durationDays ?? (p.durationDays ?? '')} placeholder="No limit" onChange={(e) => setP(p, 'durationDays', e.target.value)} style={{ width: 90 }} /></td>
                    <td>
                      {p.popular && <span className="badge soon" style={{ marginRight: 6 }}>Popular</span>}
                      <span className={'status ' + (p.active ? 'delivered' : 'cancelled')}>{p.active ? 'Visible' : 'Hidden'}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => api('saveProduct', { ...p, active: !p.active })}>{p.active ? 'Hide' : 'Show'}</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEdit(toForm(p))}><Pencil size={14} /></button>
                        <button className="btn btn-danger btn-sm" onClick={() => confirmDo(`Delete ${p.name}?`, () => api('deleteProduct', { id: p.id }))}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!items.length && <p className="help">No items yet — add one.</p>}
        </div>
      </div>

      {edit && (
        <Modal title={edit.id ? `Edit ${edit.name}` : `New sell item · ${edit.mode === 'survival' ? 'Survival' : 'Lifesteal'}`} onClose={() => setEdit(null)} wide>
          <div className="grid3">
            <Field label="Game mode">
              <select value={edit.mode} onChange={(e) => { const m = e.target.value as Mode; setEdit({ ...edit, mode: m, category: edit.category === 'claims' && m !== 'survival' ? 'ranks' : edit.category }) }}>
                {MODES.map((m) => <option key={m} value={m}>{m === 'survival' ? 'Survival' : 'Lifesteal'}</option>)}
              </select>
            </Field>
            <Field label="Category">
              <select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value as Category })}>
                {catsFor(edit.mode).map((c) => <option key={c} value={c}>{modeCfg(s, edit.mode).categories[c].label}</option>)}
              </select>
            </Field>
            <Field label="Name"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Icon (emoji)"><input value={edit.icon} onChange={(e) => setEdit({ ...edit, icon: e.target.value })} /></Field>
            <Field label={`Price (${s.currency})`} hint="Empty = on request"><input type="number" min={0} value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></Field>
            <Field label="Old price" hint="Shows a strike-through sale"><input type="number" min={0} value={edit.oldPrice} onChange={(e) => setEdit({ ...edit, oldPrice: e.target.value })} /></Field>
            <Field label="Duration (days)" hint="How long it lasts, e.g. 30 for a rank. Empty = no time limit"><input type="number" min={0} value={edit.durationDays} onChange={(e) => setEdit({ ...edit, durationDays: e.target.value })} placeholder="30" /></Field>
            <Field label="Label / tag"><input value={edit.tag} onChange={(e) => setEdit({ ...edit, tag: e.target.value })} placeholder="Tier 1 / Best value" /></Field>
            <Field label="Accent colour">
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="color" value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} style={{ width: 54, padding: 4 }} />
                <input value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} />
              </div>
            </Field>
            <Field label="Sort order" hint="Lower shows first"><input type="number" value={edit.sortOrder} onChange={(e) => setEdit({ ...edit, sortOrder: Number(e.target.value) })} /></Field>
            <div style={{ display: 'grid', gap: 10, alignContent: 'center' }}>
              <label className="check"><input type="checkbox" checked={edit.popular} onChange={(e) => setEdit({ ...edit, popular: e.target.checked })} /> Mark as popular</label>
              <label className="check"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Visible in store</label>
            </div>
          </div>
          <Field label="Perks (one per line)"><textarea rows={5} value={edit.perks} onChange={(e) => setEdit({ ...edit, perks: e.target.value })} placeholder={'Custom prefix\n5 /sethome\nKit every 3 days'} /></Field>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveOne}><Save size={16} /> Save item</button>
          </div>
        </Modal>
      )}
    </>
  )
}

// ================= Categories =================
export function CategoriesTab({ draft, setDraft, api }: Props) {
  const set = (patch: Partial<SiteSettings>) => setDraft((d) => (d ? { ...d, ...patch } : d))
  return (
    <>
      <div className="glass panel">
        <h2>Store settings (both modes)</h2>
        <div className="grid3">
          <Field label="Currency symbol"><input value={draft.currency} onChange={(e) => set({ currency: e.target.value })} /></Field>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <label className="check"><input type="checkbox" checked={draft.storeOpen} onChange={(e) => set({ storeOpen: e.target.checked })} /> Master switch: stores are open</label>
          </div>
        </div>
        <p className="help">Turning the master switch off closes the Survival and Lifesteal stores together. To close only one mode, or to rename its Ranks / Keys / Coins sections, use <b>Game Modes</b>.</p>
      </div>
      <SaveBar draft={draft} api={api} />
    </>
  )
}

// ================= Orders =================
export function OrdersTab({ data, api }: Props) {
  const [filter, setFilter] = useState<'all' | Order['status']>('all')
  const [modeF, setModeF] = useState<'all' | Mode>('all')
  const [q, setQ] = useState('')
  const list = useMemo(
    () => data.orders.filter((o) => (filter === 'all' || o.status === filter) && (modeF === 'all' || o.mode === modeF) && (!q || (o.mcUsername + o.discordName + o.productName + o.id).toLowerCase().includes(q.toLowerCase()))),
    [data.orders, filter, modeF, q],
  )
  return (
    <div className="glass panel">
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <div className="cat-tabs">
          {(['all', 'pending', 'review', 'paid', 'delivered', 'rejected', 'cancelled'] as const).map((f) => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)} style={{ textTransform: 'capitalize', padding: '9px 14px', fontSize: 13.5 }}>
              {f} {f !== 'all' && `(${data.orders.filter((o) => o.status === f).length})`}
            </button>
          ))}
        </div>
        <select className="input" value={modeF} onChange={(e) => setModeF(e.target.value as 'all' | Mode)} style={{ maxWidth: 160 }}>
          <option value="all">Both modes</option><option value="survival">Survival</option><option value="lifesteal">Lifesteal</option>
        </select>
        <input className="input" placeholder="Search username, item or #id" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280 }} />
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>#</th><th>Player</th><th>Item</th><th>Price</th><th>When</th><th>Status</th><th /></tr></thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.id}>
                <td><b>#{o.id}</b></td>
                <td>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <img src={`https://mc-heads.net/avatar/${encodeURIComponent(o.mcUsername)}/32`} alt="" width={28} height={28} style={{ borderRadius: 6 }} />
                    <div><b>{o.mcUsername}</b>{o.discordName && <div className="help">💬 {o.discordName}</div>}</div>
                  </div>
                  {o.note && <div className="help" style={{ marginTop: 4 }}>📝 {o.note}</div>}
                </td>
                <td>{o.productName}<div className="help" style={{ textTransform: 'capitalize' }}>{o.mode}{o.channelId ? ' · ticket open' : ''}</div></td>
                <td>{formatPrice(data.settings.currency, o.price) ?? 'On request'}</td>
                <td className="help">{timeAgo(o.createdAt)}</td>
                <td>
                  <select className="input" value={o.status} onChange={(e) => api('updateOrder', { id: o.id, status: e.target.value })} style={{ padding: '7px 10px', width: 130 }}>
                    <option value="pending">Awaiting payment</option><option value="review">In review</option><option value="paid">Settled</option><option value="delivered">Delivered</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option>
                  </select>
                </td>
                <td><div className="row-actions"><button className="btn btn-danger btn-sm" onClick={() => confirmDo(`Delete order #${o.id}?`, () => api('deleteOrder', { id: o.id }))}><Trash2 size={14} /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && <p className="help">No orders here.</p>}
      </div>
    </div>
  )
}

// ================= Server & links =================
export function ServerTab({ draft, setDraft, api }: Props) {
  const set = (patch: Partial<SiteSettings>) => setDraft((d) => (d ? { ...d, ...patch } : d))
  return (
    <>
      <div className="glass panel">
        <p className="help" style={{ margin: 0 }}>This is the <b>main</b> address. Survival and Lifesteal can each have their own address in <b>Game Modes</b>. Any mode you leave empty there uses these values.</p>
      </div>
      <div className="glass panel">
        <h2>Java Edition</h2>
        <div className="grid3">
          <Field label="Server IP"><input value={draft.ip} onChange={(e) => set({ ip: e.target.value.trim() })} /></Field>
          <Field label="Port" hint="25565 is hidden from the IP automatically"><input value={draft.port} onChange={(e) => set({ port: e.target.value.trim() })} /></Field>
          <Field label="Supported versions"><input value={draft.version} onChange={(e) => set({ version: e.target.value })} /></Field>
        </div>
      </div>
      <div className="glass panel">
        <h2>Bedrock Edition</h2>
        <div className="grid2">
          <Field label="Bedrock IP"><input value={draft.bedrockIp} onChange={(e) => set({ bedrockIp: e.target.value.trim() })} /></Field>
          <Field label="Bedrock port"><input value={draft.bedrockPort} onChange={(e) => set({ bedrockPort: e.target.value.trim() })} /></Field>
        </div>
      </div>
      <div className="glass panel">
        <h2>Links</h2>
        <div className="grid3">
          <Field label="Discord invite link" hint="Change it here once and it updates everywhere: menu, footer, home, news, checkout and the bot"><input value={draft.discordInvite} onChange={(e) => set({ discordInvite: e.target.value.trim() })} /></Field>
          <Field label="YouTube (optional)"><input value={draft.youtube} onChange={(e) => set({ youtube: e.target.value.trim() })} /></Field>
          <Field label="Instagram (optional)"><input value={draft.instagram} onChange={(e) => set({ instagram: e.target.value.trim() })} /></Field>
        </div>
      </div>
      <SaveBar draft={draft} api={api} />
    </>
  )
}

// ================= Discord integration =================
export function DiscordTab({ data, api }: Props) {
  const p = data.private
  const [webhook, setWebhook] = useState('')
  const [bot, setBot] = useState('')
  const [channel, setChannel] = useState(p.discordChannelId)
  const [auto, setAuto] = useState(p.autoPostToDiscord)
  const save = async () => {
    if (await api('saveDiscord', { discordWebhookUrl: webhook, discordBotToken: bot, discordChannelId: channel, autoPostToDiscord: auto })) { setWebhook(''); setBot('') }
  }
  // Bot + slash commands. Permissions: Manage Channels, View Channels, Send Messages, Manage Messages, Embed Links, Attach Files, Read Message History.
  const inviteUrl = 'https://discord.com/oauth2/authorize?client_id=1519990400574689430&scope=bot%20applications.commands&permissions=125968'
  return (
    <>
      <div className="glass panel" style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 6px' }}>🤖 Bot authorization</h2>
          <p className="help" style={{ margin: 0 }}>Adds the MOMO MC bot to your Discord server. The same Discord app also powers the website's Login button.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a className="btn btn-discord" href={inviteUrl} target="_blank" rel="noopener"><DiscordIcon size={18} /> Add bot to server</a>
          <button className="btn btn-ghost" onClick={() => copy(inviteUrl, 'Invite link copied')}>Copy link</button>
        </div>
      </div>
      <div className="grid2">
        <div className="glass panel">
          <h2>🌐 → <DiscordIcon size={18} /> Website to Discord</h2>
          <p className="help">Announcements you publish here are posted to your Discord channel through a webhook.</p>
          <Field label={p.hasWebhook ? 'Webhook URL (saved — paste a new one to replace)' : 'Webhook URL'} hint={p.hasWebhook ? `Current: ${p.webhookPreview}` : 'Discord → Channel settings → Integrations → Webhooks → Copy URL'}>
            <input type="password" value={webhook} onChange={(e) => setWebhook(e.target.value)} placeholder="https://discord.com/api/webhooks/…" autoComplete="off" />
          </Field>
          <label className="check" style={{ marginBottom: 14 }}><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Tick "Also post to Discord" by default</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" disabled={!p.hasWebhook} onClick={() => api('testWebhook')}><Send size={14} /> Send test message</button>
            {p.hasWebhook && <button className="btn btn-danger btn-sm" onClick={() => confirmDo('Remove the webhook?', () => api('saveDiscord', { discordWebhookUrl: '-', discordChannelId: channel, autoPostToDiscord: auto }))}>Remove webhook</button>}
          </div>
        </div>
        <div className="glass panel">
          <h2><DiscordIcon size={18} /> → 🌐 Discord to Website</h2>
          <p className="help">New messages in your Discord announcement channel appear on the website automatically (checked every few minutes).</p>
          <Field label={p.hasSavedBotToken ? 'Bot token (saved — paste a new one to replace)' : 'Bot token'} hint={p.envBotToken ? '✓ DISCORD_BOT_TOKEN is configured in Vercel Environment Variables and is used automatically. The secret stays hidden.' : undefined}>
            <input type="password" value={bot} onChange={(e) => setBot(e.target.value)} placeholder={p.hasSavedBotToken ? '•••••••• saved' : p.envBotToken ? 'Using Vercel environment token' : 'Paste bot token'} autoComplete="off" />
          </Field>
          <Field label="Announcement channel ID"><input value={channel} onChange={(e) => setChannel(e.target.value.trim())} placeholder="e.g. 1234567890123456789" /></Field>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => api('syncDiscord')}><RefreshCw size={14} /> Sync now</button>
            {p.hasSavedBotToken && <button className="btn btn-danger btn-sm" onClick={() => confirmDo('Remove the saved bot token? The Vercel environment token will still be used if configured.', () => api('saveDiscord', { discordBotToken: '-', discordChannelId: channel, autoPostToDiscord: auto }))}>Remove saved token</button>}
            <span className="help">{p.lastDiscordSync ? `Last sync ${timeAgo(p.lastDiscordSync)}` : 'Never synced'}</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
        <button className="btn btn-primary" onClick={save}><Save size={16} /> Save Discord settings</button>
      </div>
      <div className="glass panel help">
        <h2 style={{ color: 'var(--text)' }}>Setup guide</h2>
        <ol style={{ paddingLeft: 18, margin: 0, display: 'grid', gap: 6 }}>
          <li><b>Webhook:</b> in Discord open your announcements channel → ⚙️ Edit Channel → Integrations → Webhooks → New Webhook → Copy Webhook URL. Paste it above.</li>
          <li><b>Bot:</b> go to <a href="https://discord.com/developers/applications" target="_blank" rel="noopener" style={{ color: 'var(--cyan2)' }}>Discord Developer Portal <ExternalLink size={11} style={{ display: 'inline' }} /></a> → New Application → Bot → Reset Token → copy it. Turn on <code>Message Content Intent</code>.</li>
          <li>Invite the bot: OAuth2 → URL Generator → scope <code>bot</code>, permissions <code>View Channels</code> + <code>Read Message History</code>. Open the link and add it to your server.</li>
          <li><b>Channel ID:</b> Discord Settings → Advanced → enable Developer Mode, then right-click the channel → Copy Channel ID.</li>
          <li>Press <b>Save</b>, then <b>Sync now</b>. Messages posted by the website webhook are never duplicated.</li>
        </ol>
      </div>
    </>
  )
}

// ================= Branding & content =================
function ListEditor<T extends Record<string, string>>({ items, fields, onChange, blank, title }: {
  items: T[]; fields: { key: keyof T & string; label: string; wide?: boolean; options?: string[] }[]; onChange: (v: T[]) => void; blank: T; title: string
}) {
  const upd = (i: number, k: keyof T, v: string) => onChange(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)))
  const move = (i: number, d: number) => {
    const n = [...items]; const j = i + d
    if (j < 0 || j >= n.length) return
    ;[n[i], n[j]] = [n[j], n[i]]
    onChange(n)
  }
  return (
    <div className="glass panel">
      <h2 style={{ justifyContent: 'space-between' }}>{title}<button className="btn btn-ghost btn-sm" onClick={() => onChange([...items, { ...blank }])}><Plus size={14} /> Add</button></h2>
      <div className="list-edit">
        {items.map((it, i) => (
          <div key={i} className="item">
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(160px, 1fr))`, gap: 8 }}>
              {fields.map((f) => (
                <div key={f.key} style={f.wide ? { gridColumn: '1 / -1' } : undefined}>
                  <small className="help">{f.label}</small>
                  {f.options ? (
                    <select className="input" value={it[f.key]} onChange={(e) => upd(i, f.key, e.target.value)}>{f.options.map((o) => <option key={o}>{o}</option>)}</select>
                  ) : f.wide ? (
                    <textarea className="input" rows={2} value={it[f.key]} onChange={(e) => upd(i, f.key, e.target.value)} />
                  ) : (
                    <input className="input" value={it[f.key]} onChange={(e) => upd(i, f.key, e.target.value)} />
                  )}
                </div>
              ))}
            </div>
            <div className="row-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => move(i, -1)}>↑</button>
              <button className="btn btn-ghost btn-sm" onClick={() => move(i, 1)}>↓</button>
              <button className="btn btn-danger btn-sm" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function BrandingTab({ draft, setDraft, api }: Props) {
  const set = (patch: Partial<SiteSettings>) => setDraft((d) => (d ? { ...d, ...patch } : d))
  return (
    <>
      <div className="glass panel">
        <h2>Hero & branding</h2>
        <div className="grid2">
          <Field label="Server name"><input value={draft.serverName} onChange={(e) => set({ serverName: e.target.value })} /></Field>
          <Field label="Small heading above logo"><input value={draft.heroEyebrow} onChange={(e) => set({ heroEyebrow: e.target.value })} /></Field>
        </div>
        <Field label="Hero title"><input value={draft.heroTitle} onChange={(e) => set({ heroTitle: e.target.value })} /></Field>
        <Field label="Hero subtitle"><textarea rows={2} value={draft.heroSubtitle} onChange={(e) => set({ heroSubtitle: e.target.value })} /></Field>
        <Field label="Top ticker bar" hint="Leave empty to hide"><input value={draft.tickerText} onChange={(e) => set({ tickerText: e.target.value })} /></Field>
      </div>
      <div className="glass panel">
        <p className="help" style={{ margin: 0 }}>The Survival and Lifesteal cards on the home page now come from <b>Game Modes</b> (name, icon, tagline, live / coming soon and live player count).</p>
      </div>
      <ListEditor
        title="Features"
        items={draft.features}
        blank={{ icon: '⭐', title: 'New feature', text: '' }}
        fields={[{ key: 'icon', label: 'Icon' }, { key: 'title', label: 'Title' }, { key: 'text', label: 'Text', wide: true }]}
        onChange={(v) => set({ features: v })}
      />
      <ListEditor
        title="FAQ"
        items={draft.faq}
        blank={{ q: 'New question?', a: '' }}
        fields={[{ key: 'q', label: 'Question', wide: true }, { key: 'a', label: 'Answer', wide: true }]}
        onChange={(v) => set({ faq: v })}
      />
      <SaveBar draft={draft} api={api} />
    </>
  )
}

// ================= Security =================
export function SecurityTab({ data, api }: Props) {
  const [f, setF] = useState({ currentPassword: '', newUsername: '', newPassword: '', confirmPassword: '' })
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }))
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const [appr, setAppr] = useState({ id: '', pw: '' })
  const changeApprover = async (action: 'addApprover' | 'removeApprover', id: string) => {
    setBusy(true)
    const ok = await api(action, { id, currentPassword: appr.pw })
    setBusy(false)
    if (ok) setAppr({ id: '', pw: '' })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const ok = await api('changeCredentials', f)
    setBusy(false)
    if (ok) setF({ currentPassword: '', newUsername: '', newPassword: '', confirmPassword: '' })
  }

  return (
    <>
      <form className="glass panel" onSubmit={submit}>
        <h2>🔐 Change admin username & password</h2>
        <p className="help" style={{ marginTop: 0 }}>
          The new login is saved securely in the database (password is hashed, never stored as plain text). You stay logged in; every other session is signed out.
        </p>
        <div className="grid2">
          <Field label="Current password *"><input type="password" autoComplete="current-password" required value={f.currentPassword} onChange={(e) => set({ currentPassword: e.target.value })} /></Field>
          <Field label="New username" hint="Leave empty to keep your current username"><input autoComplete="username" value={f.newUsername} onChange={(e) => set({ newUsername: e.target.value })} /></Field>
          <Field label="New password *" hint="At least 8 characters"><input type="password" autoComplete="new-password" required minLength={8} value={f.newPassword} onChange={(e) => set({ newPassword: e.target.value })} /></Field>
          <Field label="Confirm new password *"><input type="password" autoComplete="new-password" required minLength={8} value={f.confirmPassword} onChange={(e) => set({ confirmPassword: e.target.value })} /></Field>
        </div>
        <button className="btn btn-primary" disabled={busy}><Save size={16} /> {busy ? 'Saving…' : 'Update login'}</button>
      </form>

      <div className="glass panel">
        <h2>✅ Login approvers (Discord)</h2>
        <p className="help" style={{ marginTop: 0 }}>
          After a correct username and password, the bot posts an Approve / Deny link in the approval channel and pings these Discord accounts. Anyone who can see that channel can press it, so keep the channel private (only these people).
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px', display: 'grid', gap: 8 }}>
          {data.approvers.map((id) => (
            <li key={id} style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
              <code>{id}</code>
              <button type="button" className="btn btn-ghost" disabled={busy || data.approvers.length <= 1} onClick={() => changeApprover('removeApprover', id)}>
                <Trash2 size={15} /> Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="grid2">
          <Field label="Discord user ID" hint="Discord > Settings > Advanced > Developer Mode, then right click the user > Copy User ID"><input inputMode="numeric" value={appr.id} onChange={(e) => setAppr({ ...appr, id: e.target.value.trim() })} /></Field>
          <Field label="Your admin password *" hint="Needed to add or remove an approver"><input type="password" autoComplete="current-password" value={appr.pw} onChange={(e) => setAppr({ ...appr, pw: e.target.value })} /></Field>
        </div>
        <button type="button" className="btn btn-primary" disabled={busy || !appr.id} onClick={() => changeApprover('addApprover', appr.id)}><Plus size={16} /> Add approver</button>
      </div>

      <div className="glass panel help" style={{ fontSize: 14.5 }}>
        <h2 style={{ color: 'var(--text)' }}>Discord login for visitors</h2>
        <p>
          Status:{' '}
          <b style={{ color: data.private.discordLoginReady ? 'var(--ok)' : 'var(--bad)' }}>
            {data.private.discordLoginReady ? 'Ready ✔' : 'Not configured'}
          </b>
        </p>
        <ol style={{ paddingLeft: 18 }}>
          <li>Open the Discord Developer Portal → your application → <b>OAuth2</b>.</li>
          <li>Add this redirect URL exactly: <code>{origin}/api/auth/callback</code></li>
          <li>In Vercel (Project Settings → Environment Variables) add <code>DISCORD_CLIENT_SECRET</code> (the Client ID is already built in), then redeploy.</li>
        </ol>
        <p>Visitors then see a <b>Login</b> button in the header, and their verified Discord name is attached to every purchase request.</p>
      </div>

      <div className="glass panel help" style={{ fontSize: 14.5 }}>
        <h2 style={{ color: 'var(--text)' }}>Good to know</h2>
        <ul style={{ paddingLeft: 18 }}>
          <li>Admin sessions last 12 hours or until the browser tab is closed. After 6 wrong attempts a login is blocked for 10 minutes.</li>
          <li>There is no public link to this panel. Keep the <code>/admin</code> address to yourself.</li>
          <li>Forgot the password? In Vercel set <code>ADMIN_FORCE_ENV=true</code> plus <code>ADMIN_USERNAME</code> and <code>ADMIN_PASSWORD</code>, redeploy, log in, change the login here, then remove those variables.</li>
          <li>Optional: <code>ADMIN_SESSION_SECRET</code> (random string) and <code>SITE_URL</code> (your public domain, used for the Discord redirect).</li>
          <li>Webhook URLs and bot tokens are stored server-side and never shown on the public website.</li>
        </ul>
      </div>
    </>
  )
}


// ================= Game modes: everything per Survival / Lifesteal =================
export function ModesTab({ data, draft, setDraft, api }: Props) {
  const [mode, setMode] = useState<Mode>('survival')
  const cfg = modeCfg(draft, mode)
  const name = modeName(draft, mode)

  const setCfg = (patch: Partial<ModeConfig>) =>
    setDraft((d) => (d ? { ...d, modeConfig: { ...d.modeConfig, [mode]: { ...modeCfg(d, mode), ...patch } } } : d))
  const setCat = (c: Category, patch: Partial<ModeConfig['categories'][Category]>) =>
    setCfg({ categories: { ...cfg.categories, [c]: { ...cfg.categories[c], ...patch } } })

  const [newCat, setNewCat] = useState({ label: '', icon: '⭐', description: '', sort: '' })
  const addCategory = () => {
    const label = newCat.label.trim()
    // The short key is made from the name: "Mystery Crates" -> mystery-crates
    let key = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24)
    if (key.length < 2) return alert('Give the category a name (letters or numbers, at least 2 characters).')
    if (key === 'overview' || key === 'how') key += '-shop'
    if (cfg.categories[key]) return alert('A category with that name already exists in this mode.')
    const last = Math.max(0, ...Object.values(cfg.categories).map((c) => c.sort ?? 0))
    setCfg({ categories: { ...cfg.categories, [key]: { label, icon: newCat.icon.trim() || '⭐', description: newCat.description.trim(), enabled: true, sort: newCat.sort === '' ? last + 1 : Number(newCat.sort) } } })
    setNewCat({ label: '', icon: '⭐', description: '', sort: '' })
  }

  // Discord ticket setup is saved on its own (it is private, not part of the public settings).
  const p = data.private
  const [guild, setGuild] = useState(p.guildId)
  const [tickets, setTickets] = useState<Record<Mode, TicketSettings>>(p.tickets)
  const setT = (patch: Partial<TicketSettings>) => setTickets((t) => ({ ...t, [mode]: { ...t[mode], ...patch } }))
  const t = tickets[mode]
  const [busy, setBusy] = useState(false)
  const saveTickets = async () => { setBusy(true); await api('saveTickets', { guildId: guild, tickets }); setBusy(false) }

  const count = (m: Mode) => data.products.filter((x) => x.mode === m).length

  return (
    <>
      <div className="glass panel" style={{ display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div className="cat-tabs">
          {MODES.map((m) => (
            <button key={m} className={m === mode ? 'active' : ''} onClick={() => setMode(m)}>
              {modeCfg(draft, m).emoji} {modeName(draft, m)} <small style={{ opacity: 0.7 }}>({count(m)} items)</small>
            </button>
          ))}
        </div>
        <p className="help" style={{ margin: 0, maxWidth: 460 }}>Everything on this page belongs to <b>{name}</b> only. Switch above to edit the other mode. Items and prices are in <b>Store Items &amp; Prices</b>.</p>
      </div>

      <div className="glass panel">
        <h2>{cfg.emoji} {name} page</h2>
        <Field label="Mode name" hint="Shown on the menu, home page, cart, vote and terms pages"><input value={draft.modeConfig?.[mode]?.name ?? cfg.name} onChange={(e) => setCfg({ name: e.target.value })} placeholder={MODE_NAME[mode]} /></Field>
        <div className="grid3">
          <Field label="Icon (emoji)"><input value={cfg.emoji} onChange={(e) => setCfg({ emoji: e.target.value })} /></Field>
          <Field label="Accent colour">
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="color" value={cfg.accent} onChange={(e) => setCfg({ accent: e.target.value })} style={{ width: 54, padding: 4 }} />
              <input value={cfg.accent} onChange={(e) => setCfg({ accent: e.target.value })} />
            </div>
          </Field>
          <Field label="Status">
            <select value={cfg.status} onChange={(e) => setCfg({ status: e.target.value as 'live' | 'soon' })}>
              <option value="live">Live now</option><option value="soon">Coming soon</option>
            </select>
          </Field>
        </div>
        <Field label="Tagline (big line under the title)"><input value={cfg.tagline} onChange={(e) => setCfg({ tagline: e.target.value })} /></Field>
        <Field label="About text (Overview section)"><textarea rows={3} value={cfg.about} onChange={(e) => setCfg({ about: e.target.value })} /></Field>
      </div>

      <div className="glass panel">
        <h2>{name} server address</h2>
        <p className="help" style={{ marginTop: 0 }}>Used for the live status, the player count and the copy buttons of {name}. Leave a field empty to use the main address from <b>Server &amp; Links</b> (shown greyed out).</p>
        <div className="grid3">
          <Field label="Java IP"><input value={cfg.ip} placeholder={draft.ip} onChange={(e) => setCfg({ ip: e.target.value.trim() })} /></Field>
          <Field label="Java port"><input value={cfg.port} placeholder={draft.port} onChange={(e) => setCfg({ port: e.target.value.trim() })} /></Field>
          <Field label="Supported versions"><input value={cfg.version} placeholder={draft.version} onChange={(e) => setCfg({ version: e.target.value })} /></Field>
        </div>
        <div className="grid2">
          <Field label="Bedrock IP"><input value={cfg.bedrockIp} placeholder={draft.bedrockIp} onChange={(e) => setCfg({ bedrockIp: e.target.value.trim() })} /></Field>
          <Field label="Bedrock port"><input value={cfg.bedrockPort} placeholder={draft.bedrockPort} onChange={(e) => setCfg({ bedrockPort: e.target.value.trim() })} /></Field>
        </div>
      </div>

      <ListEditor
        title={`${name} highlights (Overview cards)`}
        items={cfg.highlights}
        blank={{ icon: '⭐', title: 'New highlight', text: '' }}
        fields={[{ key: 'icon', label: 'Icon' }, { key: 'title', label: 'Title' }, { key: 'text', label: 'Text', wide: true }]}
        onChange={(v) => setCfg({ highlights: v })}
      />

      <div className="glass panel">
        <h2>{name} vote page</h2>
        <Field label="Text under the title"><textarea rows={2} value={cfg.voteNote} onChange={(e) => setCfg({ voteNote: e.target.value })} /></Field>
      </div>
      <ListEditor
        title={`${name} vote links`}
        items={cfg.votes}
        blank={{ name: 'Vote site name', url: 'https://', reward: '' }}
        fields={[{ key: 'name', label: 'Site name' }, { key: 'url', label: 'Vote link' }, { key: 'reward', label: 'Reward shown on the card', wide: true }]}
        onChange={(v) => setCfg({ votes: v })}
      />

      <div className="glass panel">
        <h2>{name} terms &amp; refund policy</h2>
        <p className="help" style={{ marginTop: 0 }}>Plain text. A line starting with <b># </b> is a heading, a line starting with <b>- </b> is a bullet point, and a blank line starts a new paragraph.</p>
        <Field label="Terms of purchase"><textarea rows={12} value={cfg.terms} onChange={(e) => setCfg({ terms: e.target.value })} /></Field>
        <Field label="Refund policy"><textarea rows={12} value={cfg.refund} onChange={(e) => setCfg({ refund: e.target.value })} /></Field>
      </div>

      <div className="glass panel">
        <h2>{name} store</h2>
        <label className="check" style={{ marginBottom: 12 }}><input type="checkbox" checked={cfg.storeOpen} onChange={(e) => setCfg({ storeOpen: e.target.checked })} /> {name} store is open for purchases</label>
        {!draft.storeOpen && <p className="help" style={{ color: '#fde68a' }}>The master switch (Store Categories tab) is off, so both stores are closed right now.</p>}
        <Field label="Note shown in the How to buy section"><textarea rows={2} value={cfg.storeNote} onChange={(e) => setCfg({ storeNote: e.target.value })} /></Field>
        <h2 style={{ fontSize: 17, marginTop: 8 }}>Store categories</h2>
        <p className="help" style={{ marginTop: 0 }}>Each category is a section on the {name} store page (like Ranks or Keys). Add your own below, e.g. Crates, Kits or Pets, then put items in it from <b>Store Items &amp; Prices</b>. Press the Save button under this box to apply.</p>
        <div className="grid3">
          {categoryList(cfg).filter((c) => c !== 'claims' || mode === 'survival').map((c) => {
            const info = cfg.categories[c]
            const builtin = CATEGORIES.includes(c)
            const used = data.products.filter((x) => x.mode === mode && x.category === c).length
            return (
              <div key={c} className="glass panel" style={{ margin: 0 }}>
                <h2 style={{ fontSize: 16 }}>{info.icon} {info.label} <small className="help">({c}{builtin ? '' : ', custom'})</small></h2>
                <Field label="Display name"><input value={info.label} onChange={(e) => setCat(c, { label: e.target.value })} /></Field>
                <div className="grid2">
                  <Field label="Icon"><input value={info.icon} onChange={(e) => setCat(c, { icon: e.target.value })} /></Field>
                  <Field label="Order" hint="Lower shows first"><input type="number" value={info.sort ?? 999} onChange={(e) => setCat(c, { sort: Number(e.target.value) })} /></Field>
                </div>
                <Field label="Description"><textarea rows={2} value={info.description} onChange={(e) => setCat(c, { description: e.target.value })} /></Field>
                <label className="check"><input type="checkbox" checked={info.enabled} onChange={(e) => setCat(c, { enabled: e.target.checked })} /> Show this section</label>
                {!builtin && (
                  <button className="btn btn-danger btn-sm" style={{ marginTop: 10 }} onClick={() => {
                    if (used) return alert(`This category still has ${used} item(s). Delete or move them in Store Items & Prices first.`)
                    confirmDo(`Delete the ${info.label} category?`, async () => {
                      const rest = { ...cfg.categories }
                      delete rest[c]
                      setCfg({ categories: rest })
                    })
                  }}><Trash2 size={14} /> Delete category</button>
                )}
              </div>
            )
          })}
          <div className="glass panel" style={{ margin: 0, borderStyle: 'dashed' }}>
            <h2 style={{ fontSize: 16 }}><Plus size={16} /> New category</h2>
            <Field label="Name"><input value={newCat.label} onChange={(e) => setNewCat({ ...newCat, label: e.target.value })} placeholder="Crates" /></Field>
            <div className="grid2">
              <Field label="Icon"><input value={newCat.icon} onChange={(e) => setNewCat({ ...newCat, icon: e.target.value })} /></Field>
              <Field label="Order" hint="Empty = last"><input type="number" value={newCat.sort} onChange={(e) => setNewCat({ ...newCat, sort: e.target.value })} /></Field>
            </div>
            <Field label="Description (optional)"><textarea rows={2} value={newCat.description} onChange={(e) => setNewCat({ ...newCat, description: e.target.value })} /></Field>
            <button className="btn btn-primary btn-sm" onClick={addCategory}><Plus size={14} /> Add category</button>
          </div>
        </div>
      </div>
      <SaveBar draft={draft} api={api} label={`Save ${name} & ${mode === 'survival' ? 'Lifesteal' : 'Survival'} changes`} />

      <div className="glass panel">
        <h2><DiscordIcon size={18} /> {name} Discord tickets</h2>
        <p className="help" style={{ marginTop: 0 }}>Where the site opens tickets for {name} orders, and who can see and approve them. In Discord turn on Settings &gt; Advanced &gt; Developer Mode, then right-click a category, role or channel &gt; Copy ID.</p>
        <Field label="Discord server ID (shared by both modes)"><input value={guild} onChange={(e) => setGuild(e.target.value.trim())} placeholder="e.g. 1234567890123456789" /></Field>
        <div className="grid3">
          <Field label={`${name} ticket category ID`} hint="Tickets are created inside this category"><input value={t.categoryId} onChange={(e) => setT({ categoryId: e.target.value.trim() })} /></Field>
          <Field label={`${name} staff role ID`} hint="Can see, approve and reject these tickets"><input value={t.staffRoleId} onChange={(e) => setT({ staffRoleId: e.target.value.trim() })} /></Field>
          <Field label={`${name} sales log channel ID`} hint="Optional. Settled orders are logged here"><input value={t.logChannelId} onChange={(e) => setT({ logChannelId: e.target.value.trim() })} /></Field>
        </div>
        <div className="grid3">
          <Field label={`${name} UPI ID`} hint="The bot makes a payment QR with the exact total from this (e.g. name@upi)"><input value={t.upiId ?? ''} onChange={(e) => setT({ upiId: e.target.value.trim() })} placeholder="yourname@upi" /></Field>
          <Field label={`${name} fixed QR image link (optional)`} hint="https:// link to your own QR picture. Used instead of the UPI ID QR"><input value={t.qrUrl ?? ''} onChange={(e) => setT({ qrUrl: e.target.value.trim() })} placeholder="https://…" /></Field>
        </div>
        <Field label={`How to pay for ${name}`} hint="Shown to the buyer inside the ticket, e.g. UPI ID or QR instructions"><textarea rows={3} value={t.paymentInfo} onChange={(e) => setT({ paymentInfo: e.target.value })} /></Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" disabled={busy} onClick={saveTickets}><Save size={16} /> {busy ? 'Saving…' : 'Save ticket settings (both modes)'}</button>
        </div>
      </div>
    </>
  )
}


// ================= Theme & logo =================
// Shrinks the chosen picture in the browser (keeps transparency) so the upload stays small.
async function prepareLogo(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Choose a PNG, JPG or WebP image')
  const url = URL.createObjectURL(file)
  const im = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = () => rej(new Error('Could not read that image'))
    i.src = url
  })
  URL.revokeObjectURL(url)
  for (const max of [1000, 800, 600, 450]) {
    const k = Math.min(1, max / Math.max(im.width, im.height))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k))
    c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height)
    const webp = c.toDataURL('image/webp', 0.9)
    if (webp.startsWith('data:image/webp') && webp.length * 0.75 < 600_000) return webp
    const png = c.toDataURL('image/png')
    if (png.length * 0.75 < 600_000) return png
  }
  throw new Error('That image is too detailed. Try a smaller one.')
}

export function ThemeTab({ data, draft, setDraft, api }: Props) {
  const theme = draft.theme ?? DEFAULT_THEME
  const [busy, setBusy] = useState(false)
  const setTheme = (t: Partial<typeof theme>) => setDraft((d) => (d ? { ...d, theme: { ...(d.theme ?? DEFAULT_THEME), ...t } } : d))
  const pick = (id: string) => {
    const p = THEME_PRESETS.find((x) => x.id === id)!
    setTheme({ preset: id, accent: p.accent, accent2: p.accent2, bg: p.bg })
  }
  const custom = (patch: Partial<typeof theme>) => setTheme({ ...patch, preset: 'custom' })
  const logoSrc = data.logoVersion ? `/logo?v=${data.logoVersion}` : DEFAULT_LOGO

  const onFile = async (f?: File) => {
    if (!f) return
    setBusy(true)
    try {
      await api('setLogo', { dataUrl: await prepareLogo(f) })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed', true)
    }
    setBusy(false)
  }

  return (
    <>
      {/* live preview of the unsaved choice while this tab is open */}
      <style dangerouslySetInnerHTML={{ __html: themeCssPreview(theme) }} />

      <div className="glass panel">
        <h2>🎨 Theme</h2>
        <p className="help" style={{ marginTop: 0 }}>Pick a ready-made theme or make your own below. The whole website changes colour. <b>Ocean</b> is the original look. You see the change right away, but it goes live for everyone only after you press Save.</p>
        <div className="grid3" style={{ marginTop: 14 }}>
          {THEME_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p.id)}
              style={{
                textAlign: 'left', padding: 12, borderRadius: 16, cursor: 'pointer', background: p.bg,
                border: theme.preset === p.id ? `2px solid ${p.accent}` : '2px solid rgba(255,255,255,.12)',
                boxShadow: theme.preset === p.id ? `0 0 24px -6px ${p.accent}` : 'none',
              }}
            >
              <div style={{ height: 34, borderRadius: 10, background: `linear-gradient(135deg, ${p.accent}, ${p.accent2})`, marginBottom: 10 }} />
              <b style={{ display: 'block', color: '#fff' }}>{p.name}{theme.preset === p.id ? ' ✓' : ''}</b>
              <small style={{ color: 'rgba(255,255,255,.65)' }}>{p.note}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="glass panel">
        <h2>🖌️ Custom colours {theme.preset === 'custom' && <span className="badge">in use</span>}</h2>
        <p className="help" style={{ marginTop: 0 }}>Change any colour and the theme becomes "Custom". Pick a dark background so the text stays readable.</p>
        <div className="grid3">
          <Field label="Main colour" hint="Buttons, glow, highlights"><input type="color" value={theme.accent} onChange={(e) => custom({ accent: e.target.value })} style={{ height: 46, padding: 4, width: '100%' }} /></Field>
          <Field label="Second colour" hint="Gradients and accents"><input type="color" value={theme.accent2} onChange={(e) => custom({ accent2: e.target.value })} style={{ height: 46, padding: 4, width: '100%' }} /></Field>
          <Field label="Background tone" hint="Dark colour of the page and cards"><input type="color" value={theme.bg} onChange={(e) => custom({ bg: e.target.value })} style={{ height: 46, padding: 4, width: '100%' }} /></Field>
        </div>
        <button type="button" className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => pick('ocean')}><RefreshCw size={15} /> Back to normal (Ocean)</button>
      </div>

      <SaveBar draft={draft} api={api} label="Save theme" />

      <div className="glass panel">
        <h2>🖼️ Logo</h2>
        <p className="help" style={{ marginTop: 0 }}>Your logo shows in the menu, the home page, the login screen and the footer. The current logo stays until you upload a new one. A PNG with a transparent background about 1000 px wide looks best. Logo changes go live as soon as the upload finishes.</p>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', margin: '14px 0' }}>
          <div style={{ width: 200, height: 130, borderRadius: 16, border: '1px dashed var(--line2)', display: 'grid', placeItems: 'center', padding: 10 }}>
            <img src={logoSrc} alt="Current logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <label className="btn btn-primary" style={{ cursor: busy ? 'wait' : 'pointer' }}>
              <Plus size={16} /> {busy ? 'Uploading…' : 'Upload new logo'}
              <input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={busy} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
            </label>
            {!!data.logoVersion && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => api('resetLogo')}><Trash2 size={15} /> Use the original logo</button>}
          </div>
        </div>
      </div>
    </>
  )
}


// ================= Redeem codes =================
const blankCode = (mode: Mode) => ({ id: 0, mode, code: '', count: '1', title: '', icon: '🎁', description: '', commands: '', maxUses: '1', perPlayer: true, expiresAt: '', active: true })

export function RedeemTab({ data, draft, api }: Props) {
  const [mode, setMode] = useState<Mode>('survival')
  const [f, setF] = useState(blankCode('survival'))
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }))
  const codes = data.redeem.codes.filter((c) => c.mode === mode)
  const claims = data.redeem.claims.filter((c) => c.mode === mode)
  const name = modeName(draft, mode)

  const save = async () => {
    setBusy(true)
    const ok = await api('saveRedeemCode', { ...f, mode, expiresAt: f.expiresAt ? new Date(f.expiresAt).toISOString() : '' })
    setBusy(false)
    if (ok) setF(blankCode(mode))
  }
  const edit = (c: (typeof codes)[number]) =>
    setF({
      id: c.id, mode: c.mode, code: c.code, count: '1', title: c.title, icon: c.icon, description: c.description, commands: c.commands.join('\n'),
      maxUses: c.maxUses == null ? '' : String(c.maxUses), perPlayer: c.perPlayer, active: c.active,
      expiresAt: c.expiresAt ? new Date(new Date(c.expiresAt).getTime() - new Date(c.expiresAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '',
    })
  const badge = (s: string) => (s === 'delivered' ? 'live' : s === 'failed' ? '' : 'soon')

  return (
    <>
      <div className="mode-switch" style={{ marginBottom: 16 }}>
        {MODES.map((m) => (
          <a key={m} href="#" className={m === mode ? 'active' : ''} onClick={(e) => { e.preventDefault(); setMode(m); setF(blankCode(m)) }}>
            {modeCfg(draft, m).emoji} {modeName(draft, m)}
          </a>
        ))}
      </div>

      <div className="glass panel">
        <h2>{f.id ? `✏️ Edit code ${f.code}` : `➕ New ${name} redeem code`}</h2>
        <p className="help" style={{ marginTop: 0 }}>A code made here works only for <b>{name}</b>. The bot gives the reward by running the commands below on the {name} server (RCON). With no commands, the bot posts it in the {name} log channel for staff to give by hand.</p>
        <div className="grid3">
          <Field label="Reward name *" hint="Shown to the player"><input value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="2x Mythic Key" /></Field>
          <Field label="Icon"><input value={f.icon} onChange={(e) => set({ icon: e.target.value })} maxLength={8} /></Field>
          {f.id ? (
            <Field label="Code"><input value={f.code} disabled /></Field>
          ) : (
            <Field label="Code (optional)" hint="Empty = random codes are generated"><input value={f.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="e.g. WELCOME2026" /></Field>
          )}
        </div>
        <Field label="Short description (optional)"><input value={f.description} onChange={(e) => set({ description: e.target.value })} /></Field>
        <Field label="Console commands, one per line" hint="{player} becomes the player's Minecraft name. Examples: give {player} diamond 5  ·  crate key give {player} mythic 2  ·  lp user {player} parent add vip">
          <textarea rows={4} value={f.commands} onChange={(e) => set({ commands: e.target.value })} placeholder={'give {player} diamond 5'} spellCheck={false} style={{ fontFamily: 'ui-monospace, monospace' }} />
        </Field>
        <div className="grid3">
          <Field label="Max uses" hint="Empty = unlimited"><input inputMode="numeric" value={f.maxUses} onChange={(e) => set({ maxUses: e.target.value.replace(/\D/g, '') })} /></Field>
          <Field label="Expires (optional)"><input type="datetime-local" value={f.expiresAt} onChange={(e) => set({ expiresAt: e.target.value })} /></Field>
          {!f.id && <Field label="How many codes" hint="Only with the code box empty (max 100)"><input inputMode="numeric" value={f.count} onChange={(e) => set({ count: e.target.value.replace(/\D/g, '') })} /></Field>}
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '4px 0 14px' }}>
          <input type="checkbox" checked={f.perPlayer} onChange={(e) => set({ perPlayer: e.target.checked })} /> One use per Discord account
        </label>
        {!!f.id && (
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '0 0 14px' }}>
            <input type="checkbox" checked={f.active} onChange={(e) => set({ active: e.target.checked })} /> Code is active
          </label>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" disabled={busy || !f.title.trim()} onClick={save}><Save size={16} /> {f.id ? 'Save changes' : 'Create code'}</button>
          {!!f.id && <button type="button" className="btn btn-ghost" onClick={() => setF(blankCode(mode))}>Cancel edit</button>}
        </div>
      </div>

      <div className="glass panel">
        <h2>{modeCfg(draft, mode).emoji} {name} codes ({codes.length})</h2>
        {!codes.length ? <p className="help">No codes yet.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>Code</th><th>Reward</th><th>Used</th><th>Expires</th><th /></tr></thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id} style={{ opacity: c.active ? 1 : 0.5 }}>
                    <td><code style={{ cursor: 'pointer' }} title="Copy" onClick={() => copy(c.code, 'Code copied')}>{c.code}</code></td>
                    <td>{c.icon} {c.title}{!c.commands.length && <small className="help"> · by hand</small>}</td>
                    <td>{c.uses}{c.maxUses != null ? ` / ${c.maxUses}` : ' / ∞'}</td>
                    <td>{c.expiresAt ? new Date(c.expiresAt).toLocaleString() : '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-ghost" onClick={() => edit(c)}><Pencil size={14} /></button>{' '}
                      <button type="button" className="btn btn-ghost" onClick={() => { if (confirm(`Delete code ${c.code}?`)) api('deleteRedeemCode', { id: c.id }) }}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="glass panel">
        <h2>Recent redeems ({claims.length})</h2>
        {!claims.length ? <p className="help">Nobody redeemed a {name} code yet.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>When</th><th>Player</th><th>Reward</th><th>Status</th><th /></tr></thead>
              <tbody>
                {claims.map((c) => (
                  <tr key={c.id}>
                    <td>{timeAgo(c.createdAt)}</td>
                    <td><b>{c.mcUsername}</b><br /><small className="help">{c.discordName}</small></td>
                    <td>{c.icon} {c.title}<br /><small className="help">{c.code}</small></td>
                    <td><span className={'badge ' + badge(c.status)}>{c.status === 'manual' ? 'waiting for staff' : c.status}</span>{c.note && <><br /><small className="help">{c.note}</small></>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {c.status !== 'delivered' && c.status !== 'pending' && <button type="button" className="btn btn-ghost" onClick={() => api('retryRedeemClaim', { id: c.id })}><RefreshCw size={14} /> Retry</button>}{' '}
                      {c.status !== 'delivered' && <button type="button" className="btn btn-ghost" onClick={() => api('deliverRedeemClaim', { id: c.id })}>Mark delivered</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}


// ================= Deploy =================
const DEPLOY_BADGE: Record<string, [string, string]> = {
  READY: ['live', 'Live'], BUILDING: ['soon', 'Building…'], QUEUED: ['soon', 'Queued'], INITIALIZING: ['soon', 'Starting'], ERROR: ['', 'Failed'], CANCELED: ['', 'Cancelled'],
}

export function DeployTab({ data, api }: Props) {
  const d = data.deploy
  const [f, setF] = useState({ hookUrl: '', token: '', projectId: d.projectId, teamId: d.teamId })
  const [busy, setBusy] = useState(false)
  const items = d.status?.items ?? []
  const building = items[0] && ['BUILDING', 'QUEUED', 'INITIALIZING'].includes(items[0].state)
  const canStatus = d.hasToken && !!d.projectId

  // While a deployment is building, check on it every 8 seconds.
  useEffect(() => {
    if (!building || !canStatus) return
    const t = setInterval(() => api('deployStatus'), 8000)
    return () => clearInterval(t)
  }, [building, canStatus, api])

  const run = async (fn: () => Promise<unknown>) => { setBusy(true); await fn(); setBusy(false) }

  return (
    <>
      <div className="glass panel">
        <h2>🚀 Deploy</h2>
        <p className="help" style={{ marginTop: 0 }}>
          Changes you make in this panel (products, prices, redeem codes, theme, logo, settings, news) are live <b>instantly</b>, no deploy needed.
          Deploy is for <b>new code</b>: push it to GitHub, then press the button and Vercel publishes the latest code. The site stays online while it builds.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="btn btn-primary" disabled={busy || !d.hasHook || !!building} onClick={() => { if (confirm('Deploy the latest code from GitHub to the live website now?')) run(() => api('deployNow')) }}>
            <Rocket size={17} /> {building ? 'Deploying…' : 'Deploy now'}
          </button>
          {canStatus && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run(() => api('deployStatus'))}><RefreshCw size={15} /> Check status</button>}
          {!d.hasHook && <span className="help">Add the Deploy Hook below first.</span>}
        </div>
      </div>

      {canStatus && (
        <div className="glass panel">
          <h2>Latest deployments</h2>
          {!items.length ? <p className="help">Press "Check status" to load them.</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead><tr><th>Status</th><th>When</th><th>Commit</th><th /></tr></thead>
                <tbody>
                  {items.map((x) => {
                    const [cls, label] = DEPLOY_BADGE[x.state] ?? ['', x.state]
                    return (
                      <tr key={x.id}>
                        <td><span className={'badge ' + cls}>{label}</span>{x.target === 'production' && <small className="help"> · production</small>}</td>
                        <td>{x.createdAt ? timeAgo(new Date(x.createdAt).toISOString()) : '—'}</td>
                        <td>{x.message || '—'}{x.sha && <small className="help"> · {x.sha}</small>}</td>
                        <td>{x.url && <a href={x.url} target="_blank" rel="noopener" className="btn btn-ghost">Open</a>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="glass panel">
        <h2>Setup</h2>
        <ol className="help" style={{ marginTop: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li><b>Deploy Hook</b> (needed): Vercel → your project → Settings → Git → Deploy Hooks → create one for your main branch → copy the URL.</li>
          <li><b>Token + Project ID</b> (optional, shows the build status here): Vercel → Account Settings → Tokens, and Project Settings → General → Project ID. Team ID only if the project is in a team.</li>
        </ol>
        <p className="help">Deploy hook: {d.hasHook ? (d.hookFromEnv ? '✅ set (environment variable)' : '✅ saved') : '❌ not set'} · Token: {d.hasToken ? (d.tokenFromEnv ? '✅ set (environment variable)' : '✅ saved') : 'not set'}. Saved secrets are never shown again; leave a box empty to keep it.</p>
        <Field label="Deploy Hook URL"><input type="password" autoComplete="off" value={f.hookUrl} onChange={(e) => setF({ ...f, hookUrl: e.target.value.trim() })} placeholder="https://api.vercel.com/v1/integrations/deploy/..." /></Field>
        <div className="grid3">
          <Field label="Vercel token (optional)"><input type="password" autoComplete="off" value={f.token} onChange={(e) => setF({ ...f, token: e.target.value.trim() })} /></Field>
          <Field label="Project ID (optional)"><input value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value.trim() })} placeholder="prj_..." /></Field>
          <Field label="Team ID (optional)"><input value={f.teamId} onChange={(e) => setF({ ...f, teamId: e.target.value.trim() })} placeholder="team_..." /></Field>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(async () => { if (await api('saveDeploy', f)) setF((x) => ({ ...x, hookUrl: '', token: '' })) })}><Save size={16} /> Save</button>
          {(d.hasHook || d.hasToken) && !d.hookFromEnv && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => { if (confirm('Remove the saved deploy settings?')) run(() => api('clearDeploy')) }}><Trash2 size={15} /> Remove saved</button>}
        </div>
      </div>
    </>
  )
}
