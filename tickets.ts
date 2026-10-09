import { getPrivate, writeKey } from './site'
import type { DiscordUser, Mode, OrderItem } from '../lib/types'
import { OWNER_ID } from '../lib/owner'

// ---------------------------------------------------------------------------
// Discord tickets for store orders. Survival and Lifesteal are configured
// completely separately (own ticket category, own staff role, own payment note).
//
// Everything below is edited per mode in Admin Panel > Game Modes > Discord tickets:
// server ID, ticket category, staff role, payment info and sale-log channel.
// The DISCORD_BOT_TOKEN env var (or the token saved under Discord Sync) is still needed.
// ---------------------------------------------------------------------------
const API = 'https://discord.com/api/v10'

export const MODE_STYLE: Record<Mode, { label: string; emoji: string; color: number }> = {
  survival: { label: 'Survival', emoji: '🌲', color: 0x4ade80 },
  lifesteal: { label: 'Lifesteal', emoji: '❤️', color: 0xf43f5e },
}

// Set in Admin Panel > Game Modes > Discord tickets. Environment variables still work as a fallback.
export async function ticketConfig(mode: Mode) {
  const M = mode.toUpperCase()
  const priv = await getPrivate()
  const t = priv.tickets?.[mode]
  return {
    guildId: priv.guildId || process.env.DISCORD_GUILD_ID || '',
    categoryId: t?.categoryId || process.env[`TICKET_CATEGORY_${M}`] || '',
    staffRoleId: t?.staffRoleId || process.env[`STAFF_ROLE_${M}`] || '',
    logChannelId: t?.logChannelId || process.env[`LOG_CHANNEL_${M}`] || '',
    payment: t?.paymentInfo || process.env[`PAYMENT_INFO_${M}`] || process.env.PAYMENT_INFO || '',
    upiId: t?.upiId || process.env[`UPI_ID_${M}`] || process.env.UPI_ID || '',
    qrUrl: t?.qrUrl || process.env[`QR_URL_${M}`] || '',
  }
}

// Every mode keeps its tickets in its OWN category. If no category is set (or the saved one was deleted),
// the bot creates "Survival Tickets" / "Lifesteal Tickets" itself and remembers the ID in the settings.
async function ensureCategory(mode: Mode, cfg: Awaited<ReturnType<typeof ticketConfig>>, recreate = false): Promise<string | undefined> {
  if (cfg.categoryId && !recreate) return cfg.categoryId
  const style = MODE_STYLE[mode]
  const base = 1024 + 2048 + 16384 + 32768 + 65536
  const overwrites: { id: string; type: number; allow?: string; deny?: string }[] = [
    { id: cfg.guildId, type: 0, deny: '1024' },
    { id: process.env.DISCORD_CLIENT_ID || '1519990400574689430', type: 1, allow: String(base + 8192 + 16) },
    { id: OWNER_ID, type: 1, allow: String(base + 8192) },
  ]
  if (cfg.staffRoleId) overwrites.push({ id: cfg.staffRoleId, type: 0, allow: String(base + 8192) })
  const res = await discord(`/guilds/${cfg.guildId}/channels`, { json: { name: `${style.emoji} ${style.label} Tickets`, type: 4, permission_overwrites: overwrites } })
  if (!res.ok) return cfg.categoryId || undefined // could not create (bot needs Manage Channels); fall back to the old behaviour
  const { id } = (await res.json()) as { id: string }
  const priv = await getPrivate()
  await writeKey('private', { ...priv, tickets: { ...priv.tickets, [mode]: { ...priv.tickets?.[mode], categoryId: id } } })
  return id
}

export class TicketError extends Error {
  constructor(message: string, public code: 'not_configured' | 'not_member' | 'discord' = 'discord') {
    super(message)
  }
}

async function botToken() {
  const priv = await getPrivate()
  return process.env.DISCORD_BOT_TOKEN || priv.discordBotToken || ''
}

async function discord(path: string, init: RequestInit & { json?: unknown } = {}) {
  const token = await botToken()
  const res = await fetch(API + path, {
    method: init.method ?? (init.json ? 'POST' : 'GET'),
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    body: init.json ? JSON.stringify(init.json) : undefined,
  })
  return res
}

export const ticketUrl = async (mode: Mode, channelId: string) => `https://discord.com/channels/${(await ticketConfig(mode)).guildId}/${channelId}`

// True when the ticket channel still exists (so we can avoid opening duplicates).
export async function channelExists(channelId: string) {
  if (!channelId) return false
  const res = await discord(`/channels/${channelId}`)
  return res.ok
}

// Payment QR shown in the ticket: your own fixed QR image, or a UPI QR with the exact total filled in.
export function paymentQr(cfg: { upiId: string; qrUrl: string }, total: number, orderId: number) {
  if (cfg.qrUrl) return cfg.qrUrl
  if (!cfg.upiId || total <= 0) return ''
  const upi = `upi://pay?pa=${encodeURIComponent(cfg.upiId)}&pn=${encodeURIComponent('MOMO MC')}&am=${total}&cu=INR&tn=${encodeURIComponent('Order ' + orderId)}`
  return `https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=12&data=${encodeURIComponent(upi)}`
}

const money = (currency: string, n: number) => currency + n.toLocaleString('en-IN')

export function summarize(items: OrderItem[], currency: string) {
  let total = 0
  let unpriced = false
  const lines = items.map((i) => {
    if (i.price == null) unpriced = true
    else total += i.price * i.qty
    const price = i.price == null ? 'price on request' : money(currency, i.price * i.qty)
    const perks = i.perks.length ? '\n' + i.perks.map((p) => `  ▫️ ${p}`).join('\n') : ''
    const days = i.durationDays ? ` · ⏳ ${i.durationDays} days` : ''
    return `${i.icon} **${i.name}** ×${i.qty} — ${price}${days}${perks}`
  })
  return { total, unpriced, lines }
}

export async function createTicket(opts: {
  orderId: number
  mode: Mode
  user: DiscordUser
  mcUsername: string
  note: string
  items: OrderItem[]
  currency: string
}): Promise<string> {
  const { orderId, mode, user, mcUsername, note, items, currency } = opts
  const cfg = await ticketConfig(mode)
  const style = MODE_STYLE[mode]
  if (!(await botToken()) || !cfg.guildId) throw new TicketError('Tickets are not set up yet. Please ask staff on Discord.', 'not_configured')

  // The buyer has to be inside the Discord server to see their private ticket.
  const member = await discord(`/guilds/${cfg.guildId}/members/${user.id}`)
  if (member.status === 404) throw new TicketError('Join our Discord server first, then press Continue to payment again.', 'not_member')
  if (!member.ok) throw new TicketError(`Discord error (${member.status}) while checking your membership.`)

  const botId = process.env.DISCORD_CLIENT_ID || '1519990400574689430'
  const base = 1024 + 2048 + 16384 + 32768 + 65536 // view, send, embeds, attach files, read history
  const overwrites: { id: string; type: number; allow?: string; deny?: string }[] = [
    { id: cfg.guildId, type: 0, deny: '1024' },
    { id: user.id, type: 1, allow: String(base) },
    { id: botId, type: 1, allow: String(base + 8192 + 16) },
    { id: OWNER_ID, type: 1, allow: String(base + 8192) }, // the owner always sees every ticket (and gets the screenshot pings)
  ]
  if (cfg.staffRoleId) overwrites.push({ id: cfg.staffRoleId, type: 0, allow: String(base + 8192) })

  const clean = mcUsername.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20) || 'player'
  const makeChannel = (parent?: string) =>
    discord(`/guilds/${cfg.guildId}/channels`, {
      json: {
        name: `${mode}-${orderId}-${clean}`,
        type: 0,
        parent_id: parent || undefined,
        topic: `${style.label} order #${orderId} · ${mcUsername} · discord ${user.id}`,
        permission_overwrites: overwrites,
      },
    })
  let channelRes = await makeChannel(await ensureCategory(mode, cfg))
  // The saved category may have been deleted in Discord: make a fresh one for this mode and retry once.
  if (!channelRes.ok && cfg.categoryId && (channelRes.status === 400 || channelRes.status === 404)) {
    channelRes = await makeChannel(await ensureCategory(mode, cfg, true))
  }
  if (!channelRes.ok) throw new TicketError(`Could not create the ticket (${channelRes.status}). Staff have been told to check the bot permissions.`)
  const channel = (await channelRes.json()) as { id: string }

  const { total, unpriced, lines } = summarize(items, currency)
  const fields = [
    { name: 'Minecraft username', value: `\`${mcUsername}\``, inline: true },
    { name: 'Discord', value: `<@${user.id}>`, inline: true },
    { name: unpriced ? 'Bill total (priced items)' : 'Bill total to pay', value: `**${money(currency, total)}**${unpriced ? '\nSome items are "price on request", staff will quote them here.' : ''}` },
    ...(cfg.payment ? [{ name: 'How to pay', value: cfg.payment.slice(0, 1000) }] : []),
    {
      name: 'What happens next',
      value: '1. Scan the **QR code** below (or use the payment info) and pay the bill total.\n2. Send a **screenshot of the payment** in this channel.\n3. The owner is pinged right away and confirms your payment.\n4. You get pinged when it is settled, then staff deliver in-game.',
    },
  ]
  if (note) fields.splice(2, 0, { name: 'Your note', value: note.slice(0, 300) })

  const qr = paymentQr(cfg, total, orderId)
  const msg = await discord(`/channels/${channel.id}/messages`, {
    json: {
      content: `<@${user.id}>${cfg.staffRoleId ? ` <@&${cfg.staffRoleId}>` : ''}`,
      allowed_mentions: { users: [user.id], roles: cfg.staffRoleId ? [cfg.staffRoleId] : [] },
      embeds: [{
        title: `${style.emoji} ${style.label} order #${orderId}`,
        description: lines.join('\n\n').slice(0, 3800),
        color: style.color,
        fields,
        ...(qr ? { image: { url: qr } } : {}),
        footer: { text: `MOMO MC · ${style.label} store` },
        timestamp: new Date().toISOString(),
      }],
      components: [{ type: 1, components: [{ type: 2, style: 4, label: 'Cancel order', custom_id: `cancel:${orderId}` }] }],
    },
  })
  if (!msg.ok) throw new TicketError(`Ticket was created but the message failed (${msg.status}).`)
  return channel.id
}
