// MOMO MC ticket bot.
// The website opens the ticket. This bot watches the ticket channels:
//   1. the buyer posts a payment screenshot  -> bot checks it and asks that mode's staff to confirm
//   2. staff press Approve                    -> order is settled, bot pings the buyer 3 times
//   3. staff press Mark delivered / Close     -> ticket is archived
// Survival and Lifesteal each use their own staff role, log channel, colours and wording.
//
// Redeem codes: when a player redeems a code on the website, this bot delivers the reward.
//   - if RCON is set for that mode (RCON_SURVIVAL_* / RCON_LIFESTEAL_* in .env) it runs the code's console commands, {player} = the player
//   - otherwise it posts the reward in the mode's log channel and staff press "Mark delivered"
import net from 'node:net'
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder, Events, GatewayIntentBits, PermissionFlagsBits,
} from 'discord.js'

const { DISCORD_BOT_TOKEN, SITE_URL, BOT_API_KEY } = process.env
// The owner is pinged 5 times whenever a buyer posts a payment screenshot.
const OWNER_ID = process.env.OWNER_ID || '1373581087506301003'
if (!DISCORD_BOT_TOKEN || !SITE_URL || !BOT_API_KEY) {
  console.error('Set DISCORD_BOT_TOKEN, SITE_URL and BOT_API_KEY (see .env.example)')
  process.exit(1)
}

// Staff role and log channel per mode come from Admin Panel > Game Modes (refreshed every minute).
// The env vars below are only a fallback if the website cannot be reached.
const MODES = {
  survival: {
    label: 'Survival', emoji: '🌲', color: 0x4ade80,
    staffRole: process.env.STAFF_ROLE_SURVIVAL || '', logChannel: process.env.LOG_CHANNEL_SURVIVAL || '',
    thanks: 'Thanks for supporting MOMO Survival! 🌲',
  },
  lifesteal: {
    label: 'Lifesteal', emoji: '❤️', color: 0xf43f5e,
    staffRole: process.env.STAFF_ROLE_LIFESTEAL || '', logChannel: process.env.LOG_CHANNEL_LIFESTEAL || '',
    thanks: 'Thanks for supporting MOMO Lifesteal! ❤️',
  },
}
let configAt = 0
async function refreshConfig() {
  if (Date.now() - configAt < 60_000) return
  configAt = Date.now()
  const c = await site('/api/bot/config').catch(() => null)
  if (!c?.ok) return
  for (const m of Object.keys(MODES)) {
    if (c[m]?.staffRoleId) MODES[m].staffRole = c[m].staffRoleId
    if (c[m]?.logChannelId) MODES[m].logChannel = c[m].logChannelId
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function site(path, body) {
  const res = await fetch(SITE_URL.replace(/\/$/, '') + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${BOT_API_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, ...data }
}
const getOrder = async (channelId) => { await refreshConfig(); return (await site(`/api/bot/order?channel=${channelId}`)).order ?? null }
const act = (id, action, extra = {}) => site('/api/bot/order', { id, action, ...extra })

const money = (n) => '₹' + Number(n ?? 0).toLocaleString('en-IN')
const isStaff = (member, mode) =>
  member.permissions.has(PermissionFlagsBits.Administrator) || (MODES[mode].staffRole && member.roles.cache.has(MODES[mode].staffRole))

// ---- redeem codes: RCON delivery ---------------------------------------------------------------
const RCON = {
  survival: { host: process.env.RCON_SURVIVAL_HOST, port: Number(process.env.RCON_SURVIVAL_PORT || 25575), password: process.env.RCON_SURVIVAL_PASSWORD },
  lifesteal: { host: process.env.RCON_LIFESTEAL_HOST, port: Number(process.env.RCON_LIFESTEAL_PORT || 25575), password: process.env.RCON_LIFESTEAL_PASSWORD },
}
const MC_NAME = /^[A-Za-z0-9_.]{3,20}$/

// Minimal Minecraft RCON client: logs in, runs the commands one after another, returns their replies.
function rconRun({ host, port, password }, commands, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host, port })
    let buf = Buffer.alloc(0), authed = false, next = 0
    const replies = []
    const finish = (err, val) => { clearTimeout(timer); sock.destroy(); err ? reject(err) : resolve(val) }
    const timer = setTimeout(() => finish(new Error('RCON timed out (is the server up and RCON reachable?)')), timeoutMs)
    const send = (id, type, body) => {
      const b = Buffer.from(body, 'utf8'), p = Buffer.alloc(14 + b.length)
      p.writeInt32LE(10 + b.length, 0); p.writeInt32LE(id, 4); p.writeInt32LE(type, 8); b.copy(p, 12)
      sock.write(p)
    }
    const sendNext = () => send(10 + next, 2, commands[next])
    sock.on('error', (e) => finish(new Error('RCON connection failed: ' + e.message)))
    sock.on('connect', () => send(1, 3, password))
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d])
      while (buf.length >= 4) {
        const len = buf.readInt32LE(0)
        if (buf.length < 4 + len) break
        const id = buf.readInt32LE(4), type = buf.readInt32LE(8), body = buf.toString('utf8', 12, 4 + len - 2)
        buf = buf.subarray(4 + len)
        if (!authed) {
          if (type !== 2) continue
          if (id === -1) return finish(new Error('RCON password is wrong'))
          authed = true
          if (!commands.length) return finish(null, replies)
          sendNext()
        } else if (type === 0) {
          if (/unknown or incomplete command|unknown command/i.test(body)) return finish(new Error(`Server rejected "${commands[next]}": ${body.slice(0, 80)}`))
          replies.push(body)
          if (++next < commands.length) sendNext()
          else return finish(null, replies)
        }
      }
    })
  })
}

async function logChannelOf(mode) {
  await refreshConfig()
  const id = MODES[mode]?.logChannel
  return id ? client.channels.fetch(id).catch(() => null) : null
}

async function dmUser(discordId, text) {
  const u = await client.users.fetch(discordId).catch(() => null)
  await u?.send(text).catch(() => {}) // DMs may be closed, that is fine
}

let redeemBusy = false
async function processRedeems() {
  if (redeemBusy) return
  redeemBusy = true
  try {
    const r = await site('/api/bot/redeems?status=pending&limit=20')
    for (const c of r.claims ?? []) {
      const taken = await site('/api/bot/redeems', { id: c.id, action: 'claim' })
      if (!taken.ok) continue // another run took it
      const cfg = MODES[c.mode]
      if (!cfg) { await site('/api/bot/redeems', { id: c.id, action: 'failed', note: 'Unknown game mode' }); continue }
      const rc = RCON[c.mode]
      const log = await logChannelOf(c.mode)
      const staffPing = cfg.staffRole ? `<@&${cfg.staffRole}> ` : ''

      if (rc.host && rc.password && c.commands.length) {
        try {
          if (!MC_NAME.test(c.mcUsername)) throw new Error('Invalid Minecraft username')
          await rconRun(rc, c.commands.map((cmd) => cmd.replaceAll('{player}', c.mcUsername)))
          await site('/api/bot/redeems', { id: c.id, action: 'delivered', note: 'Delivered by the bot' })
          await log?.send({ embeds: [new EmbedBuilder().setColor(cfg.color).setTitle(`${cfg.emoji} ${cfg.label} code redeemed`).setDescription(`\`${c.mcUsername}\` got **${c.icon} ${c.title}** (code \`${c.code}\`)\nDelivered automatically.`)] }).catch(() => {})
          await dmUser(c.discordId, `✅ Your ${cfg.label} reward **${c.title}** was delivered to **${c.mcUsername}**. Enjoy!`)
        } catch (e) {
          await site('/api/bot/redeems', { id: c.id, action: 'failed', note: String(e.message).slice(0, 280) })
          await log?.send({ content: `${staffPing}⚠️ Could not deliver code **${c.title}** to \`${c.mcUsername}\` (claim #${c.id}): ${String(e.message).slice(0, 200)}\nUse Retry in Admin Panel > Redeem Codes, or give it by hand.`, allowedMentions: { roles: cfg.staffRole ? [cfg.staffRole] : [] } }).catch(() => {})
        }
        continue
      }

      // No RCON for this mode: staff deliver by hand.
      await site('/api/bot/redeems', { id: c.id, action: 'manual', note: 'Waiting for staff' })
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`rd:${c.id}`).setLabel('Mark delivered').setStyle(ButtonStyle.Success))
      const lines = c.commands.length ? `\nCommands:\n${c.commands.map((cmd) => '`' + cmd.replaceAll('{player}', c.mcUsername) + '`').join('\n')}` : ''
      await log?.send({
        content: `${staffPing}🎁 Please deliver this redeem reward in-game.`,
        allowedMentions: { roles: cfg.staffRole ? [cfg.staffRole] : [] },
        embeds: [new EmbedBuilder().setColor(cfg.color).setTitle(`${cfg.emoji} ${cfg.label} code #${c.id}`).setDescription(`Player: \`${c.mcUsername}\` (<@${c.discordId}>)\nReward: **${c.icon} ${c.title}**\nCode: \`${c.code}\`${lines}`)],
        components: [row],
      }).catch(() => {})
    }
  } catch (e) {
    console.error('redeem poll failed', e.message)
  } finally {
    redeemBusy = false
  }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] })
client.once(Events.ClientReady, (c) => {
  console.log(`Ticket bot online as ${c.user.tag}`)
  setInterval(processRedeems, 10_000) // delivers redeem codes
  processRedeems()
})

// ---- 1. screenshot posted in a ticket -------------------------------------------------------
client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot || !msg.guild) return
  const shot = [...msg.attachments.values()].find((a) => a.contentType?.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(a.name ?? ''))
  if (!shot) return
  const order = await getOrder(msg.channelId)
  if (!order) return // not a ticket channel
  const cfg = MODES[order.mode]
  if (!cfg) return
  if (msg.author.id !== order.discordId) return // only the buyer can submit proof
  if (order.status === 'review') return void msg.reply('⏳ Your earlier screenshot is still being checked by staff.')
  if (!['pending', 'rejected'].includes(order.status)) return

  // Basic checks the bot can really do: it must be a real, readable screenshot.
  const problems = []
  if (shot.size < 15_000) problems.push('the image is very small or heavily compressed')
  if (shot.width && shot.height && (shot.width < 300 || shot.height < 300)) problems.push('the image resolution is too low')
  if (problems.length) return void msg.reply(`⚠️ I could not accept that screenshot: ${problems.join(' and ')}. Please send the full payment screenshot again.`)

  const saved = await act(order.id, 'proof', { proofUrl: shot.url })
  if (!saved.ok) return void msg.reply('⚠️ Could not save your screenshot, please try again in a moment.')
  await msg.react('👀').catch(() => {})

  const embed = new EmbedBuilder()
    .setColor(cfg.color)
    .setTitle(`${cfg.emoji} ${cfg.label} order #${order.id}: payment screenshot received`)
    .setDescription(`<@${order.discordId}> sent a screenshot. Amount to verify: **${money(order.price)}**\nPlayer: \`${order.mcUsername}\`\n\n${order.items.map((i) => `• ${i.icon} **${i.name}** ×${i.qty}`).join('\n')}`)
    .setImage(shot.url)
    .setFooter({ text: 'Staff: check the amount and reference, then choose below.' })
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ok:${order.id}`).setLabel('Approve payment').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`no:${order.id}`).setLabel('Reject').setStyle(ButtonStyle.Danger),
  )
  await msg.channel.send({
    content: `${cfg.staffRole ? `<@&${cfg.staffRole}> ` : ''}✅ Screenshot received. The owner has been pinged to check it.`,
    allowedMentions: { roles: cfg.staffRole ? [cfg.staffRole] : [] },
    embeds: [embed],
    components: [row],
  })

  // Ping the owner 5 times so the payment is never missed.
  for (let n = 1; n <= 5; n++) {
    await msg.channel
      .send({ content: `<@${OWNER_ID}> 💸 Payment screenshot for ${cfg.label} order #${order.id} (${money(order.price)}, \`${order.mcUsername}\`). Please verify! (${n}/5)`, allowedMentions: { users: [OWNER_ID] } })
      .catch(() => {})
    if (n < 5) await sleep(1200)
  }
})

// ---- 2. buttons -------------------------------------------------------------------------------
client.on(Events.InteractionCreate, async (i) => {
  if (!i.isButton()) return
  const [kind, idRaw] = i.customId.split(':')
  const id = Number(idRaw)
  if (kind === 'rd') { // staff delivered a redeem reward by hand
    const found = (await site(`/api/bot/redeems?id=${id}`)).claims?.[0]
    if (!found) return void i.reply({ content: 'This redeem was not found.', ephemeral: true })
    await refreshConfig()
    if (!isStaff(i.member, found.mode)) return void i.reply({ content: `Only ${MODES[found.mode].label} staff can use this button.`, ephemeral: true })
    const r = await site('/api/bot/redeems', { id, action: 'delivered', note: `Delivered by ${i.user.tag}` })
    if (!r.ok) return void i.reply({ content: 'This one was already handled.', ephemeral: true })
    await i.update({ components: [] })
    await i.channel.send(`📦 Redeem #${id} delivered to \`${found.mcUsername}\` by <@${i.user.id}>.`)
    return void dmUser(found.discordId, `✅ Your ${MODES[found.mode].label} reward **${found.title}** was delivered to **${found.mcUsername}**. Enjoy!`)
  }
  if (!['ok', 'no', 'cancel', 'done', 'close'].includes(kind) || !id) return
  const order = await getOrder(i.channelId)
  if (!order || order.id !== id) return void i.reply({ content: 'This order was not found.', ephemeral: true })
  const cfg = MODES[order.mode]
  const staff = isStaff(i.member, order.mode)
  const owner = i.user.id === order.discordId

  if (kind === 'cancel') {
    if (!owner && !staff) return void i.reply({ content: 'Only the buyer or staff can cancel.', ephemeral: true })
    const r = await act(id, 'cancel')
    if (!r.ok) return void i.reply({ content: `Cannot cancel: ${r.error ?? 'error'}`, ephemeral: true })
    await i.reply(`🛑 Order #${id} was cancelled by <@${i.user.id}>. This channel will be deleted in 10 seconds.`)
    await sleep(10_000)
    return void i.channel.delete().catch(() => {})
  }

  if (!staff) return void i.reply({ content: `Only ${cfg.label} staff can use this button.`, ephemeral: true })

  if (kind === 'no') {
    const r = await act(id, 'reject')
    if (!r.ok) return void i.reply({ content: `Cannot reject: ${r.error ?? 'error'}`, ephemeral: true })
    await i.update({ components: [] })
    return void i.channel.send(`❌ <@${order.discordId}> your payment for order #${id} was **not accepted** by <@${i.user.id}>. Please check the amount and send a new screenshot here.`)
  }

  if (kind === 'ok') {
    const r = await act(id, 'settle')
    if (!r.ok) return void i.reply({ content: `Cannot settle: ${r.error ?? 'error'}`, ephemeral: true })
    await i.update({ components: [] })

    const perks = order.items.map((it) => `${it.icon} **${it.name}** ×${it.qty}${it.perks?.length ? `\n${it.perks.map((p) => `  ▫️ ${p}`).join('\n')}` : ''}`).join('\n')
    const settled = new EmbedBuilder()
      .setColor(cfg.color)
      .setTitle(`✅ ${cfg.label} order #${id} settled`)
      .setDescription(`${perks}\n\nPaid: **${money(order.price)}** · Player: \`${order.mcUsername}\`\nApproved by <@${i.user.id}>`)
      .setFooter({ text: cfg.thanks })
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`done:${id}`).setLabel('Mark delivered').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`close:${id}`).setLabel('Close ticket').setStyle(ButtonStyle.Secondary),
    )
    await i.channel.send({ embeds: [settled], components: [row] })

    // Ping the buyer 3 times.
    const pings = [
      `✅ Payment **settled**! Your ${cfg.label} order #${id} is confirmed.`,
      `🎁 Your items: ${order.items.map((it) => `${it.name} ×${it.qty}`).join(', ')}`,
      `🎮 Staff will deliver to **${order.mcUsername}** in-game shortly. Stay online if you can!`,
    ]
    for (const text of pings) {
      await i.channel.send({ content: `<@${order.discordId}> ${text}`, allowedMentions: { users: [order.discordId] } })
      await sleep(1500)
    }

    await i.channel.setName(`settled-${cfg.label.toLowerCase()}-${id}`).catch(() => {}) // may be rate limited, not important
    if (cfg.logChannel) {
      const log = await client.channels.fetch(cfg.logChannel).catch(() => null)
      log?.send({ embeds: [new EmbedBuilder().setColor(cfg.color).setTitle(`${cfg.emoji} ${cfg.label} sale #${id}`).setDescription(`${order.mcUsername} paid **${money(order.price)}**\n${order.items.map((it) => `${it.name} ×${it.qty}`).join(', ')}\nTicket: <#${i.channelId}>`)] }).catch(() => {})
    }
    return
  }

  if (kind === 'done') {
    const r = await act(id, 'deliver')
    if (!r.ok) return void i.reply({ content: `Cannot mark delivered: ${r.error ?? 'error'}`, ephemeral: true })
    await i.update({ components: [] })
    return void i.channel.send(`📦 Order #${id} delivered by <@${i.user.id}>. Enjoy, <@${order.discordId}>! You can close this ticket.`)
  }

  if (kind === 'close') {
    await i.reply('🔒 Closing this ticket in 10 seconds…')
    await sleep(10_000)
    return void i.channel.delete().catch(() => {})
  }
})

client.login(DISCORD_BOT_TOKEN)
