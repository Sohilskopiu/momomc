import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { and, eq, like, lt } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { settings } from '../../db/schema.js'
import { getPrivate, readKey, writeKey } from './site'

// ---------------------------------------------------------------------------
// Admin login approval
// A correct username + password is NOT enough. The bot posts an Approve / Deny link in the private approval channel and pings the approvers,
// and the login waits until ONE of them opens the Approve link. The first decision (Approve or Deny) wins.
// Requests live 10 minutes, are single use, and are stored only as hashes.
//   ADMIN_APPROVER_DISCORD_IDS  comma separated Discord user IDs (defaults to the two below)
//   ADMIN_APPROVAL=off          emergency switch to turn the check off
//   ADMIN_APPROVAL_CHANNEL_ID   channel for the requests (default 1557784605833171084). KEEP IT PRIVATE
//   DISCORD_BOT_TOKEN           the bot token (or the one saved in Admin Panel) posts the messages
// ---------------------------------------------------------------------------
const DEFAULT_APPROVERS = ['896582112487043082', '1373581087506301003']
const TTL_MS = 10 * 60e3

export const approvalEnabled = () => process.env.ADMIN_APPROVAL !== 'off'
const defaultApprovers = () =>
  (process.env.ADMIN_APPROVER_DISCORD_IDS || DEFAULT_APPROVERS.join(',')).split(',').map((e) => e.trim()).filter((e) => /^\d{15,25}$/.test(e))

type Row = {
  user: string
  ip: string
  ua: string
  created: number
  status: 'pending' | 'approved' | 'denied'
  pollHash: string
  approveHash: string
  denyHash: string
  decidedBy?: string
}

/** The approver list lives in the database (editable in Admin Panel > Security); env/default is only the fallback. */
export async function getApprovers(): Promise<string[]> {
  const v = await readKey<{ ids?: string[] }>('approvers', {})
  const ids = (v.ids ?? []).filter((e) => /^\d{15,25}$/.test(e))
  return ids.length ? ids : defaultApprovers()
}
export const saveApprovers = (ids: string[]) => writeKey('approvers', { ids })

const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}
const rk = (id: string) => `loginreq:${id}`
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

async function load(id: string): Promise<Row | null> {
  if (!/^[a-f0-9]{24}$/.test(id)) return null
  const [r] = await db.select().from(settings).where(eq(settings.key, rk(id))).limit(1)
  return (r?.value as Row | undefined) ?? null
}
const save = (id: string, v: Row) =>
  db.insert(settings).values({ key: rk(id), value: v }).onConflictDoUpdate({ target: settings.key, set: { value: v, updatedAt: new Date() } })
const drop = (id: string) => db.delete(settings).where(eq(settings.key, rk(id)))

// Posts the approval request in the private approval channel and pings every approver.
export const APPROVAL_CHANNEL = () => process.env.ADMIN_APPROVAL_CHANNEL_ID || '1557784605833171084'
async function postApproval(ids: string[], content: string) {
  const priv = await getPrivate()
  // Vercel environment secret takes precedence over any older token saved in the database.
  const token = process.env.DISCORD_BOT_TOKEN?.trim() || priv.discordBotToken?.trim() || ''
  if (!token) throw new Error('Discord bot token is not configured (DISCORD_BOT_TOKEN).')
  const res = await fetch(`https://discord.com/api/v10/channels/${APPROVAL_CHANNEL()}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: `${ids.map((i) => `<@${i}>`).join(' ')}\n${content}`, allowed_mentions: { users: ids }, flags: 4 }),
  })
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json() as { message?: string; code?: number }
      detail = [body.message, body.code ? `Discord code ${body.code}` : ''].filter(Boolean).join(' — ')
    } catch { /* Discord may return a non-JSON error body */ }
    const hint = res.status === 401 ? 'The bot token is invalid or was regenerated.'
      : res.status === 403 ? 'The bot cannot access this channel. Grant View Channel and Send Messages.'
      : res.status === 404 ? 'The approval channel ID is wrong, or the bot is not in that server.'
      : 'Check the bot token, approval channel ID, and channel permissions.'
    throw new Error(`Discord approval post failed (${res.status})${detail ? `: ${detail}` : ''}. ${hint}`)
  }
}

/** Creates a pending login and posts in the approval channel. Throws if the mail cannot be sent (login then stays closed). */
export async function createRequest(user: string, ip: string, ua: string, origin: string) {
  // tidy up old requests so the table does not grow
  await db.delete(settings).where(and(like(settings.key, 'loginreq:%'), lt(settings.updatedAt, new Date(Date.now() - 60 * 60e3))))
  const id = randomBytes(12).toString('hex')
  const poll = randomBytes(24).toString('base64url')
  const approveKey = randomBytes(24).toString('base64url')
  const denyKey = randomBytes(24).toString('base64url')
  await save(id, { user, ip, ua: ua.slice(0, 160), created: Date.now(), status: 'pending', pollHash: sha(poll), approveHash: sha(approveKey), denyHash: sha(denyKey) })

  const link = (k: string, a: string) => `${origin}/api/admin/approve?id=${id}&k=${k}&a=${a}`
  const when = new Date().toUTCString()
  const msg = `🔐 **MOMO MC admin login: approval needed**\nSomeone entered the correct admin username and password for **${user}**.\n\nIP: \`${ip}\`\nDevice: ${ua.slice(0, 120)}\nTime: ${when}\n\n✅ **Approve:** ${link(approveKey, 'approve')}\n❌ **Deny:** ${link(denyKey, 'deny')}\n\nIf this was not you, press Deny and change the admin password. Expires in 10 minutes.`
  try {
    await postApproval(await getApprovers(), msg)
  } catch (e) {
    await drop(id)
    throw e
  }
  return { id, poll }
}

/** Opens from the email link. Either approver can decide; the first decision wins. */
export async function decide(id: string, key: string, action: 'approve' | 'deny') {
  const r = await load(id)
  if (!r || Date.now() - r.created > TTL_MS) return { ok: false as const, message: 'This request has expired or does not exist.' }
  if (r.status !== 'pending') return { ok: false as const, message: `This request was already ${r.status}.` }
  const good = action === 'approve' ? same(sha(key), r.approveHash) : same(sha(key), r.denyHash)
  if (!good) return { ok: false as const, message: 'This link is not valid.' }
  await save(id, { ...r, status: action === 'approve' ? 'approved' : 'denied' })
  return { ok: true as const, message: action === 'approve' ? 'Approved. The login can continue now.' : 'Denied. That login attempt is blocked.', user: r.user, ip: r.ip, ua: r.ua }
}

/** Preview for the confirmation page (does not change anything). */
export async function preview(id: string) {
  const r = await load(id)
  return r && Date.now() - r.created <= TTL_MS && r.status === 'pending' ? { user: r.user, ip: r.ip, ua: r.ua } : null
}

/** Polled by the waiting browser. An approval can be used exactly once. */
export async function pollStatus(id: string, poll: string): Promise<{ status: 'pending' | 'approved' | 'denied' | 'expired'; user?: string }> {
  const r = await load(id)
  if (!r || !same(sha(poll), r.pollHash)) return { status: 'expired' }
  if (Date.now() - r.created > TTL_MS) { await drop(id); return { status: 'expired' } }
  if (r.status === 'approved') { await drop(id); return { status: 'approved', user: r.user } }
  if (r.status === 'denied') { await drop(id); return { status: 'denied' } }
  return { status: 'pending' }
}

export const pageHtml = (title: string, body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#030a14;color:#eef8ff;font-family:Arial,sans-serif"><div style="max-width:420px;width:90%;padding:28px;border:1px solid #1f4a70;border-radius:18px;background:#0a1a30"><h2 style="margin-top:0">${esc(title)}</h2>${body}</div></body></html>`
export { esc }
