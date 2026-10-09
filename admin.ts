import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { announcements, orders, products, staff } from '../../db/schema.js'
import { isMode } from '../lib/types'
import type { AdminData, Category } from '../lib/types'
import { modeCfg } from '../lib/modes'
import { checkCredentials, setCredentials } from './auth'
import { postToDiscord, syncFromDiscord } from './discord'
import { oauthConfig } from './visitor'
import { getApprovers, saveApprovers } from './approval'
import { THEME_PRESETS, isHex } from '../lib/theme'
import { clearDeployConfig, deployNow, getDeployConfig, refreshDeployStatus, saveDeployConfig } from './deploy'
import { ensureRedeemTables, genCode, listRedeem, normCode, parseCommands } from './redeem'
import { redeemClaims, redeemCodes } from '../../db/schema.js'
import { ensureSeeded, getPrivate, getSettings, listAnnouncements, listOrders, listProducts, listStaff, readKey, writeKey } from './site'

export async function adminData(): Promise<AdminData> {
  await ensureSeeded()
  const [s, p, st, a, o, priv, appr, logo, dc, dstat] = await Promise.all([
    getSettings(), listProducts(true), listStaff(), listAnnouncements(200), listOrders(), getPrivate(), getApprovers(), readKey<{ v?: number }>('logo_meta', {}), getDeployConfig(), readKey<{ at?: number; items?: unknown[] }>('deploy_status', {}),
  ])
  const redeem = await listRedeem().catch(() => ({ codes: [], claims: [] })) // never lets a redeem problem lock the admin out
  const { discordBotToken, discordWebhookUrl, ...rest } = priv
  return {
    settings: s, products: p, staff: st, announcements: a, orders: o, approvers: appr, logoVersion: logo.v || 0, redeem,
    deploy: {
      hasHook: !!dc.hookUrl, hasToken: !!dc.token, hookFromEnv: dc.hookFromEnv, tokenFromEnv: dc.tokenFromEnv, projectId: dc.projectId, teamId: dc.teamId,
      status: dstat.at ? (dstat as AdminData['deploy']['status']) : null,
    },
    private: {
      ...rest,
      hasBotToken: !!discordBotToken || !!process.env.DISCORD_BOT_TOKEN,
      hasSavedBotToken: !!discordBotToken,
      hasWebhook: !!discordWebhookUrl,
      webhookPreview: discordWebhookUrl ? discordWebhookUrl.replace(/\/[^/]+$/, '/••••••') : '',
      envBotToken: !!process.env.DISCORD_BOT_TOKEN,
      discordClientId: oauthConfig().id,
      discordLoginReady: !!(oauthConfig().id && oauthConfig().secret),
    },
  }
}

type Payload = Record<string, any>

const num = (v: unknown) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Math.round(Number(v)))
const str = (v: unknown, max = 2000) => String(v ?? '').slice(0, max)

function productFields(p: Payload) {
  if (typeof p.category !== 'string' || !/^[a-z0-9-]{2,24}$/.test(p.category)) throw new Error('Unknown category')
  if (!isMode(p.mode)) throw new Error('Pick a game mode (Survival or Lifesteal)')
  if (!str(p.name).trim()) throw new Error('Name is required')
  return {
    mode: p.mode,
    category: p.category as Category,
    name: str(p.name, 80).trim(),
    price: num(p.price),
    oldPrice: num(p.oldPrice),
    icon: str(p.icon, 16) || '⭐',
    tag: str(p.tag, 40),
    color: str(p.color, 20) || '#43dcff',
    durationDays: ((d) => (d && d > 0 ? Math.min(Math.floor(d), 3650) : null))(num(p.durationDays)),
    perks: (Array.isArray(p.perks) ? p.perks : []).map((x: unknown) => str(x, 120)).filter(Boolean),
    popular: !!p.popular,
    active: p.active !== false,
    sortOrder: num(p.sortOrder) ?? 0,
  }
}

function staffFields(p: Payload) {
  if (!str(p.name).trim()) throw new Error('Name is required')
  return {
    name: str(p.name, 40).trim(), role: str(p.role, 40) || 'Staff', color: str(p.color, 20) || '#43dcff',
    discord: str(p.discord, 60), bio: str(p.bio, 200), sortOrder: num(p.sortOrder) ?? 0,
  }
}

export async function runAction(action: string, p: Payload, user: string): Promise<string> {
  switch (action) {
    case 'saveSettings': {
      const current = await getSettings()
      // The Discord link is used by the menu, footer, home, news page, the "join our Discord" button in checkout and the bot's /discord command.
      if (p.discordInvite !== undefined) {
        const link = String(p.discordInvite).trim()
        if (!/^https:\/\/(discord\.gg|(www\.)?discord(app)?\.com\/invite)\/[\w-]+\/?$/i.test(link)) throw new Error('Discord link must look like https://discord.gg/yourcode')
        p.discordInvite = link
      }
      // Store categories: valid short keys only, sane lengths. Built-in ones stay, extra ones are the owner's own.
      if (p.modeConfig && typeof p.modeConfig === 'object') {
        for (const mode of ['survival', 'lifesteal'] as const) {
          const cats = p.modeConfig[mode]?.categories
          if (!cats || typeof cats !== 'object') continue
          const clean: Record<string, unknown> = {}
          for (const [key, v] of Object.entries(cats as Record<string, Record<string, unknown>>)) {
            if (!/^[a-z0-9-]{2,24}$/.test(key) || key === 'overview' || key === 'how') throw new Error(`Bad category key "${key}"`)
            clean[key] = {
              label: str(v.label, 40).trim() || key,
              icon: str(v.icon, 8).trim() || '⭐',
              description: str(v.description, 300),
              enabled: v.enabled !== false,
              sort: Number.isFinite(Number(v.sort)) ? Number(v.sort) : 999,
            }
          }
          p.modeConfig[mode].categories = clean
        }
      }
      // Theme: a known preset or custom colours, always valid hex colours.
      if (p.theme !== undefined) {
        const t = p.theme as Record<string, unknown>
        const hexOk = (v: unknown, d: string) => (isHex(v) ? v.toLowerCase() : d)
        const preset = typeof t?.preset === 'string' && (t.preset === 'custom' || THEME_PRESETS.some((x) => x.id === t.preset)) ? t.preset : 'ocean'
        const base = THEME_PRESETS.find((x) => x.id === preset) ?? THEME_PRESETS[0]
        p.theme = { preset, accent: hexOk(t?.accent, base.accent), accent2: hexOk(t?.accent2, base.accent2), bg: hexOk(t?.bg, base.bg) }
      }
      await writeKey('site', { ...current, ...p })
      return 'Settings saved'
    }
    case 'setLogo': {
      // The logo is shrunk in the browser first; here we only accept real png / jpeg / webp images of a sane size.
      const m = /^data:(image\/(png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(p.dataUrl || ''))
      if (!m) throw new Error('Upload a PNG, JPG or WebP image')
      const bytes = Buffer.from(m[3], 'base64')
      if (bytes.length > 700_000) throw new Error('Logo is too big (max about 700 KB). Try a smaller image.')
      const head = bytes.subarray(0, 12)
      const ok = m[2] === 'png' ? head[0] === 0x89 && head[1] === 0x50 : m[2] === 'jpeg' ? head[0] === 0xff && head[1] === 0xd8 : head.subarray(0, 4).toString() === 'RIFF' && head.subarray(8, 12).toString() === 'WEBP'
      if (!ok) throw new Error('That file is not a valid image')
      await writeKey('logo_data', { mime: m[1], b64: m[3] })
      await writeKey('logo_meta', { v: Date.now() })
      return 'Logo updated'
    }
    case 'resetLogo': {
      await writeKey('logo_data', {})
      await writeKey('logo_meta', { v: 0 })
      return 'Back to the original logo'
    }
    case 'saveRedeemCode': {
      await ensureRedeemTables()
      if (!isMode(p.mode)) throw new Error('Pick Survival or Lifesteal')
      const title = str(p.title, 80).trim()
      if (!title) throw new Error('Reward name is required')
      const maxUses = num(p.maxUses)
      if (maxUses !== null && maxUses < 1) throw new Error('Max uses must be 1 or more (leave empty for unlimited)')
      const expiresAt = p.expiresAt ? new Date(String(p.expiresAt)) : null
      if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new Error('Expiry date is not valid')
      const base = {
        mode: p.mode, title, icon: str(p.icon, 8).trim() || '🎁', description: str(p.description, 300),
        commands: parseCommands(p.commands), maxUses, perPlayer: p.perPlayer !== false, expiresAt, active: p.active !== false,
      }
      if (p.id) {
        await db.update(redeemCodes).set(base).where(eq(redeemCodes.id, Number(p.id)))
        return 'Code updated'
      }
      const custom = normCode(str(p.code, 40))
      const count = Math.min(100, Math.max(1, num(p.count) ?? 1))
      if (custom && custom.length < 4) throw new Error('A custom code needs at least 4 letters or numbers')
      if (custom && count > 1) throw new Error('To make many codes at once, leave the code box empty (they are generated randomly)')
      const codes = custom ? [custom] : Array.from({ length: count }, genCode)
      try {
        await db.insert(redeemCodes).values(codes.map((code) => ({ ...base, code })))
      } catch {
        throw new Error('That code already exists. Pick another one.')
      }
      return codes.length > 1 ? `${codes.length} codes created` : `Code created: ${codes[0]}`
    }
    case 'deleteRedeemCode': {
      await ensureRedeemTables()
      await db.delete(redeemCodes).where(eq(redeemCodes.id, Number(p.id)))
      return 'Code deleted'
    }
    case 'retryRedeemClaim': {
      await ensureRedeemTables()
      await db.update(redeemClaims).set({ status: 'pending', note: 'Retry requested from the admin panel' }).where(eq(redeemClaims.id, Number(p.id)))
      return 'The bot will try again within a few seconds'
    }
    case 'deliverRedeemClaim': {
      await ensureRedeemTables()
      await db.update(redeemClaims).set({ status: 'delivered', deliveredAt: new Date(), note: 'Marked delivered in the admin panel' }).where(eq(redeemClaims.id, Number(p.id)))
      return 'Marked as delivered'
    }
    case 'saveDeploy':
      await saveDeployConfig({ hookUrl: str(p.hookUrl, 300).trim(), token: str(p.token, 200).trim(), projectId: str(p.projectId, 80).trim(), teamId: str(p.teamId, 80).trim() })
      return 'Deploy settings saved'
    case 'clearDeploy':
      await clearDeployConfig()
      return 'Deploy settings removed'
    case 'deployNow':
      await deployNow()
      return 'Deploy started! It usually takes 1 to 2 minutes. The site stays online while it builds.'
    case 'deployStatus':
      await refreshDeployStatus()
      return ''
    case 'saveDiscord': {
      const priv = await getPrivate()
      const next = { ...priv, discordChannelId: str(p.discordChannelId, 40).trim(), autoPostToDiscord: !!p.autoPostToDiscord }
      if (typeof p.discordWebhookUrl === 'string' && p.discordWebhookUrl !== '') {
        if (p.discordWebhookUrl !== '-' && !/^https:\/\/(\w+\.)?discord(app)?\.com\/api\/webhooks\//.test(p.discordWebhookUrl)) throw new Error('That is not a Discord webhook URL')
        next.discordWebhookUrl = p.discordWebhookUrl === '-' ? '' : p.discordWebhookUrl.trim()
      }
      if (typeof p.discordBotToken === 'string' && p.discordBotToken !== '') next.discordBotToken = p.discordBotToken === '-' ? '' : p.discordBotToken.trim()
      await writeKey('private', next)
      return 'Discord integration saved'
    }
    case 'saveTickets': {
      // Per-mode Discord ticket setup. IDs are numbers copied from Discord (Developer Mode on).
      const id = (v: unknown, what: string) => {
        const x = str(v, 30).trim()
        if (x && !/^\d{15,25}$/.test(x)) throw new Error(`${what} must be a Discord ID (only digits)`)
        return x
      }
      const priv = await getPrivate()
      const next = { ...priv, guildId: id(p.guildId, 'Server ID'), tickets: { ...priv.tickets } }
      for (const m of ['survival', 'lifesteal'] as const) {
        const t = (p.tickets?.[m] ?? {}) as Payload
        const label = m === 'survival' ? 'Survival' : 'Lifesteal'
        next.tickets[m] = {
          categoryId: id(t.categoryId, `${label} ticket category ID`),
          staffRoleId: id(t.staffRoleId, `${label} staff role ID`),
          logChannelId: id(t.logChannelId, `${label} log channel ID`),
          paymentInfo: str(t.paymentInfo, 1000),
          upiId: str(t.upiId, 80).trim(),
          qrUrl: ((u) => { if (u && !/^https:\/\/\S+$/i.test(u)) throw new Error(`${label} QR image link must start with https://`); return u })(str(t.qrUrl, 500).trim()),
        }
      }
      await writeKey('private', next)
      return 'Ticket settings saved'
    }
    case 'testWebhook': {
      const id = await postToDiscord({ title: 'Webhook connected', body: 'The MOMO MC website can now post announcements here. ✅', tag: 'System' })
      if (!id) throw new Error('No webhook URL saved yet')
      return 'Test message sent to Discord'
    }
    case 'syncDiscord': {
      const r = await syncFromDiscord()
      return r.skipped ? r.skipped : `Imported ${r.imported} new message(s) from Discord`
    }

    case 'changeCredentials': {
      const newUser = str(p.newUsername, 40).trim() || user
      const newPass = str(p.newPassword, 200)
      if (!(await checkCredentials(user, str(p.currentPassword, 200)))) throw new Error('Current password is wrong')
      if (newUser.length < 3) throw new Error('Username must be at least 3 characters')
      if (newPass.length < 8) throw new Error('New password must be at least 8 characters')
      if (newPass !== str(p.confirmPassword, 200)) throw new Error('New passwords do not match')
      await setCredentials(newUser, newPass)
      return 'Admin login updated'
    }

    case 'addApprover':
    case 'removeApprover': {
      // Changing who can approve logins needs the admin password (Discord-verified owner sessions are exempt).
      if (!user.startsWith('owner:') && !(await checkCredentials(user, str(p.currentPassword, 200)))) throw new Error('Current password is wrong')
      const id = str(p.id, 30).trim()
      if (!/^\d{15,25}$/.test(id)) throw new Error('Enter a valid Discord user ID (only numbers, 15 to 25 digits)')
      const list = await getApprovers()
      if (action === 'addApprover') {
        if (list.includes(id)) throw new Error('That ID is already an approver')
        if (list.length >= 10) throw new Error('At most 10 approvers')
        await saveApprovers([...list, id])
        return 'Approver added'
      }
      if (!list.includes(id)) throw new Error('That ID is not in the list')
      if (list.length <= 1) throw new Error('You cannot remove the last approver, or nobody could approve logins')
      await saveApprovers(list.filter((x) => x !== id))
      return 'Approver removed'
    }

    case 'saveProduct': {
      const f = productFields(p)
      if (f.category === 'claims' && f.mode !== 'survival') throw new Error('Claim blocks can only be sold in Survival')
      if (!(f.category in modeCfg(await getSettings(), f.mode).categories)) throw new Error('That category does not exist in this game mode. Add it in Game Modes first.')
      if (p.id) await db.update(products).set(f).where(eq(products.id, Number(p.id)))
      else await db.insert(products).values(f)
      return p.id ? 'Item updated' : 'Item added'
    }
    case 'deleteProduct':
      await db.delete(products).where(eq(products.id, Number(p.id)))
      return 'Item deleted'
    case 'bulkPrices': {
      // p.items: [{ id, price, oldPrice?, name? }]
      for (const it of (p.items ?? []) as Payload[]) {
        const set: Record<string, unknown> = { price: num(it.price) }
        if ('oldPrice' in it) set.oldPrice = num(it.oldPrice)
        if ('durationDays' in it) { const d = num(it.durationDays); set.durationDays = d && d > 0 ? Math.min(Math.floor(d), 3650) : null }
        if (it.name) set.name = str(it.name, 80)
        await db.update(products).set(set).where(eq(products.id, Number(it.id)))
      }
      return 'Prices updated'
    }

    case 'saveStaff': {
      const f = staffFields(p)
      if (p.id) await db.update(staff).set(f).where(eq(staff.id, Number(p.id)))
      else await db.insert(staff).values(f)
      return p.id ? 'Staff updated' : 'Staff added'
    }
    case 'deleteStaff':
      await db.delete(staff).where(eq(staff.id, Number(p.id)))
      return 'Staff removed'

    case 'saveAnnouncement': {
      const f = { title: str(p.title, 160).trim(), body: str(p.body, 4000).trim(), tag: str(p.tag, 30) || 'News', pinned: !!p.pinned }
      if (!f.title || !f.body) throw new Error('Title and message are required')
      if (p.id) {
        await db.update(announcements).set(f).where(eq(announcements.id, Number(p.id)))
        return 'Announcement updated'
      }
      const [row] = await db.insert(announcements).values({ ...f, author: user }).returning({ id: announcements.id })
      if (p.sendToDiscord) {
        try {
          const msgId = await postToDiscord(f)
          if (msgId) {
            await db.update(announcements).set({ discordMessageId: msgId }).where(eq(announcements.id, row.id))
            return 'Announcement published on the website and Discord'
          }
          return 'Published on the website (no Discord webhook set)'
        } catch (e) {
          return 'Published on the website, but Discord failed: ' + (e as Error).message
        }
      }
      return 'Announcement published'
    }
    case 'deleteAnnouncement':
      await db.delete(announcements).where(eq(announcements.id, Number(p.id)))
      return 'Announcement deleted'

    case 'updateOrder':
      if (!['pending', 'review', 'paid', 'delivered', 'rejected', 'cancelled'].includes(p.status)) throw new Error('Bad status')
      await db.update(orders).set({ status: p.status }).where(eq(orders.id, Number(p.id)))
      return 'Order marked ' + p.status
    case 'deleteOrder':
      await db.delete(orders).where(eq(orders.id, Number(p.id)))
      return 'Order deleted'

    default:
      throw new Error('Unknown action')
  }
}
