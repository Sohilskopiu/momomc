import type { CategoryInfo, Category, Mode, ModeConfig, SiteSettings } from './types'

export const MODE_NAME: Record<Mode, string> = { survival: 'Survival', lifesteal: 'Lifesteal' }

// Claim blocks only exist in Survival, so Lifesteal starts with that section switched off.
const BLANK_CATEGORY = { icon: '⭐', description: '', enabled: true, sort: 999 }

const CATS = (claims: boolean): Record<Category, CategoryInfo> => ({
  ranks: { label: 'Ranks', icon: '👑', description: 'Ranks with exclusive perks, kits and a shiny prefix.', enabled: true, sort: 0 },
  keys: { label: 'Keys', icon: '🔑', description: 'Crate keys packed with rare loot, gear and spawners.', enabled: true, sort: 1 },
  coins: { label: 'Coins', icon: '🪙', description: 'In-game coins to spend in the server shop and auction house.', enabled: true, sort: 2 },
  claims: { label: 'Claim Blocks', icon: '🧱', description: 'Claim more land to protect your base, farms and builds from griefers.', enabled: claims, sort: 3 },
})

const SERVER_BLANK = { ip: '', port: '', bedrockIp: '', bedrockPort: '', version: '' }

const REFUND = `# Refunds
- Everything in the store is digital and delivered in-game, so a purchase cannot be refunded once it has been delivered.
- If your order is not delivered within 48 hours after staff approve your payment, tell us in your ticket and we will deliver it or refund you.
- If you paid twice or paid the wrong amount by mistake, tell staff in your ticket and we will refund the extra amount.

# Bans and chargebacks
- Purchases are not refunded when an account is banned for breaking the rules.
- Please talk to us before you dispute a payment with your bank. Chargebacks can lead to a ban.

# How to ask for a refund
Open a ticket in our Discord and include your Minecraft username and your order details.`

const VOTE_NOTE = 'Vote once a day on each site. Rewards are given in-game, and you can also ask staff in Discord if you did not get yours.'

// Starting content. Every value here can be changed later in Admin Panel > Game Modes.
export const DEFAULT_MODE_CONFIG: Record<Mode, ModeConfig> = {
  survival: {
    name: 'Survival',
    ...SERVER_BLANK,
    voteNote: VOTE_NOTE,
    votes: [],
    terms: `# Purchases
- All purchases are digital and are only for the Survival server.
- Ranks, keys and coins are given to the Minecraft username you enter at checkout, so check the spelling before you pay.
- You pay inside your private Discord ticket. Staff check your payment before anything is delivered.

# Rules
- Cheating, duping or abusing bugs can lead to a ban with no refund.
- Prices, perks and items can change at any time. Items you already bought keep the perks they had when you bought them.
- A map reset can remove builds and items. It does not remove a rank you bought, unless we announce otherwise.`,
    refund: REFUND,
    emoji: '🌲',
    accent: '#4ade80',
    tagline: 'Build, farm and trade in peace.',
    about: 'Classic survival with land claims, jobs and a player-run economy. Build a base, grow a farm and trade with your neighbours.',
    status: 'live',
    storeOpen: true,
    storeNote: 'Add items to your cart, continue to payment and finish in your private Survival ticket.',
    highlights: [
      { icon: '🏡', title: 'Land claims', text: 'Protect your builds so nobody can grief them.' },
      { icon: '💰', title: 'Player economy', text: 'Sell drops, buy from other players and run a shop.' },
      { icon: '⛏️', title: 'Jobs & quests', text: 'Earn coins while you mine, farm and explore.' },
    ],
    categories: CATS(true),
  },
  lifesteal: {
    name: 'Lifesteal',
    ...SERVER_BLANK,
    voteNote: VOTE_NOTE,
    votes: [],
    terms: `# Purchases
- All purchases are digital and are only for the Lifesteal server.
- Ranks, keys and coins are given to the Minecraft username you enter at checkout, so check the spelling before you pay.
- You pay inside your private Discord ticket. Staff check your payment before anything is delivered.

# Rules
- Cheating, duping, combat logging or abusing bugs can lead to a ban with no refund.
- Hearts, gear and items you lose in PvP are not refunded, and buying a rank does not protect you from losing them.
- Season wipes reset hearts and progress. Rank and coin handling on a wipe will be announced before it happens.
- Prices, perks and items can change at any time. Items you already bought keep the perks they had when you bought them.`,
    refund: REFUND,
    emoji: '❤️',
    accent: '#f43f5e',
    tagline: 'Kill to steal hearts. Lose them all and you are out.',
    about: 'Every kill takes a heart from your victim and gives it to you. Stack hearts, protect your own and survive the season.',
    status: 'live',
    storeOpen: true,
    storeNote: 'Add items to your cart, continue to payment and finish in your private Lifesteal ticket.',
    highlights: [
      { icon: '⚔️', title: 'Heart stealing', text: 'Win a fight, gain a heart. Lose one, and it is gone.' },
      { icon: '🩸', title: 'Seasonal wipes', text: 'A fresh start every season with new rewards.' },
      { icon: '🏆', title: 'Leaderboards', text: 'Climb the top-hearts board and get remembered.' },
    ],
    categories: CATS(false),
  },
}

// Safe read: works even if the saved settings are older than this feature.
export function modeCfg(s: SiteSettings, mode: Mode): ModeConfig {
  const d = DEFAULT_MODE_CONFIG[mode]
  const saved = (s.modeConfig?.[mode] ?? {}) as Partial<ModeConfig>
  return {
    ...d,
    ...saved,
    name: saved.name?.trim() || d.name,
    highlights: saved.highlights ?? d.highlights,
    votes: saved.votes ?? d.votes,
    // Built-in categories plus any the owner added. Missing fields fall back to the defaults.
    categories: Object.fromEntries(
      [...new Set([...Object.keys(d.categories), ...Object.keys(saved.categories ?? {})])].map((k) => [
        k,
        ({ ...BLANK_CATEGORY, ...d.categories[k], ...saved.categories?.[k] }) as CategoryInfo,
      ]),
    ),
  }
}

// Category keys in the order the owner arranged them (built-ins first by default).
export const categoryList = (cfg: ModeConfig): string[] =>
  Object.keys(cfg.categories).sort((a, b) => (cfg.categories[a].sort ?? 999) - (cfg.categories[b].sort ?? 999) || a.localeCompare(b))

// Sections that are actually shown in a mode's store. Claim blocks exist in Survival only.
export const visibleCategories = (cfg: ModeConfig, mode: Mode): string[] =>
  categoryList(cfg).filter((c) => cfg.categories[c].enabled && (c !== 'claims' || mode === 'survival'))

// A mode's store is open only when both the master switch and the mode's own switch are on.
export const storeIsOpen = (s: SiteSettings, mode: Mode) => s.storeOpen && modeCfg(s, mode).storeOpen

// The name shown on the site for a mode (editable in Admin Panel > Game Modes).
export const modeName = (s: SiteSettings, mode: Mode) => modeCfg(s, mode).name || MODE_NAME[mode]

// Each mode can have its own address and version. Any empty field uses the main one from Server & Links.
export function modeServer(s: SiteSettings, mode: Mode) {
  const c = modeCfg(s, mode)
  return {
    ip: c.ip.trim() || s.ip,
    port: c.port.trim() || s.port,
    bedrockIp: c.bedrockIp.trim() || s.bedrockIp,
    bedrockPort: c.bedrockPort.trim() || s.bedrockPort,
    version: c.version.trim() || s.version,
  }
}
