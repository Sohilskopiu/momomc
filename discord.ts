import { db } from '../../db/index.js'
import { announcements } from '../../db/schema.js'
import { getPrivate, getSettings, writeKey } from './site'

const API = 'https://discord.com/api/v10'

const botToken = (p: { discordBotToken: string }) => p.discordBotToken || process.env.DISCORD_BOT_TOKEN || ''

// Web → Discord: post an announcement through the channel webhook. Returns the Discord message id.
export async function postToDiscord(a: { title: string; body: string; tag: string }): Promise<string | null> {
  const priv = await getPrivate()
  if (!priv.discordWebhookUrl) return null
  const s = await getSettings()
  const url = priv.discordWebhookUrl + (priv.discordWebhookUrl.includes('?') ? '&' : '?') + 'wait=true'
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: s.serverName,
      embeds: [{
        title: `📢 ${a.title}`,
        description: a.body.slice(0, 4000),
        color: 0x43dcff,
        footer: { text: `${s.serverName} · ${a.tag} · ${s.ip}` },
        timestamp: new Date().toISOString(),
      }],
    }),
  })
  if (!res.ok) throw new Error(`Discord webhook failed (${res.status})`)
  const msg = (await res.json().catch(() => ({}))) as { id?: string }
  return msg.id ?? null
}

type DiscordMessage = {
  id: string
  content: string
  timestamp: string
  webhook_id?: string
  author: { username: string; global_name?: string | null; bot?: boolean }
  embeds?: { title?: string; description?: string }[]
}

const clean = (t: string) => t.replace(/<@[!&]?\d+>|@everyone|@here/g, '').replace(/[*_~`#>]+/g, '').trim()

// Discord → Web: import new messages from the announcement channel.
export async function syncFromDiscord(): Promise<{ imported: number; skipped?: string }> {
  const priv = await getPrivate()
  const token = botToken(priv)
  if (!token || !priv.discordChannelId) return { imported: 0, skipped: 'Bot token or channel ID not configured' }

  const res = await fetch(`${API}/channels/${priv.discordChannelId}/messages?limit=25`, {
    headers: { Authorization: `Bot ${token}` },
  })
  if (!res.ok) throw new Error(`Discord API error ${res.status}: ${(await res.text()).slice(0, 160)}`)
  const messages = (await res.json()) as DiscordMessage[]

  const rows = messages
    .map((m) => {
      const embed = m.embeds?.[0]
      const raw = clean(m.content || '')
      const lines = raw.split('\n').filter(Boolean)
      const title = clean(embed?.title || '') || (lines.length > 1 ? lines[0] : 'Discord Announcement')
      const body = clean(embed?.description || '') || (lines.length > 1 ? lines.slice(1).join('\n') : raw)
      return {
        title: title.replace(/^📢\s*/, '').slice(0, 160),
        body,
        tag: 'Discord',
        source: 'discord',
        author: m.author.global_name || m.author.username,
        discordMessageId: m.id,
        createdAt: new Date(m.timestamp),
      }
    })
    .filter((r) => r.body)

  let imported = 0
  if (rows.length) {
    const inserted = await db.insert(announcements).values(rows).onConflictDoNothing({ target: announcements.discordMessageId }).returning({ id: announcements.id })
    imported = inserted.length
  }
  await writeKey('private', { ...priv, lastDiscordSync: new Date().toISOString() })
  return { imported }
}

// Light auto-sync triggered by site traffic (at most once per 2 minutes).
export async function maybeSync() {
  try {
    const priv = await getPrivate()
    if (!botToken(priv) || !priv.discordChannelId) return
    if (priv.lastDiscordSync && Date.now() - Date.parse(priv.lastDiscordSync) < 120e3) return
    await syncFromDiscord()
  } catch (e) {
    console.error('discord sync', e)
  }
}
