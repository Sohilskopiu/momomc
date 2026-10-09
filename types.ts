// A category is just a short key. The four built-in ones are below, and the owner can add more in Admin Panel > Game Modes.
export type Category = string
export const CATEGORIES: Category[] = ['ranks', 'keys', 'coins', 'claims']

// Every game mode has its own store, its own tickets and its own staff role.
export type Mode = 'survival' | 'lifesteal'
export const MODES: Mode[] = ['survival', 'lifesteal']
export const isMode = (v: unknown): v is Mode => v === 'survival' || v === 'lifesteal'

export type CategoryInfo = { label: string; icon: string; description: string; enabled: boolean; sort?: number }

export type GameMode = { name: string; icon: string; description: string; status: 'live' | 'soon' }
export type Feature = { icon: string; title: string; text: string }
export type Faq = { q: string; a: string }
export type VoteLink = { name: string; url: string; reward: string }

// Everything on a mode's page and in its store can be edited separately for Survival and Lifesteal.
export type ModeConfig = {
  name: string
  // Own server address for this mode. Empty fields fall back to the main address in Server & Links.
  ip: string
  port: string
  bedrockIp: string
  bedrockPort: string
  version: string
  // Vote page, Terms page and Refund policy for this mode (edited in Admin Panel > Game Modes).
  voteNote: string
  votes: VoteLink[]
  terms: string
  refund: string
  emoji: string
  accent: string
  tagline: string
  about: string
  status: 'live' | 'soon'
  storeOpen: boolean
  storeNote: string
  highlights: Feature[]
  categories: Record<Category, CategoryInfo>
}

import type { ThemeSettings } from './theme'

export type SiteSettings = {
  theme: ThemeSettings
  serverName: string
  heroEyebrow: string
  heroTitle: string
  heroSubtitle: string
  tickerText: string
  ip: string
  port: string
  bedrockIp: string
  bedrockPort: string
  version: string
  discordInvite: string
  currency: string
  storeOpen: boolean
  storeNote: string
  categories: Record<Category, CategoryInfo>
  modeConfig: Record<Mode, ModeConfig>
  modes: GameMode[]
  features: Feature[]
  faq: Faq[]
  youtube: string
  instagram: string
}

// Discord ticket setup for one mode (IDs are copied from Discord with Developer Mode on)
// upiId makes the bot build a payment QR with the exact amount. qrUrl is an optional fixed QR image (used instead).
export type TicketSettings = { categoryId: string; staffRoleId: string; paymentInfo: string; logChannelId: string; upiId?: string; qrUrl?: string }

// Never sent to the public site
export type PrivateSettings = {
  guildId: string
  tickets: Record<Mode, TicketSettings>
  discordWebhookUrl: string
  discordBotToken: string
  discordChannelId: string
  autoPostToDiscord: boolean
  lastDiscordSync: string | null
}

export type Product = {
  id: number
  mode: Mode
  category: Category
  name: string
  price: number | null
  oldPrice: number | null
  icon: string
  tag: string
  color: string
  perks: string[]
  durationDays: number | null // how long the purchase lasts, null = no limit
  popular: boolean
  active: boolean
  sortOrder: number
}

export type StaffMember = {
  id: number
  name: string
  role: string
  color: string
  discord: string
  bio: string
  sortOrder: number
}

export type Announcement = {
  id: number
  title: string
  body: string
  tag: string
  pinned: boolean
  source: 'web' | 'discord'
  author: string
  createdAt: string
}

export type OrderItem = { id: number; name: string; icon: string; category: string; price: number | null; qty: number; perks: string[]; durationDays?: number | null }

// pending = waiting for payment, review = screenshot sent, paid = settled, rejected = screenshot refused
export type OrderStatus = 'pending' | 'review' | 'paid' | 'delivered' | 'rejected' | 'cancelled'

export type Order = {
  id: number
  mcUsername: string
  discordName: string
  discordId: string
  productId: number | null
  productName: string
  category: string
  price: number | null
  note: string
  status: OrderStatus
  mode: Mode
  items: OrderItem[]
  channelId: string
  proofUrl: string
  createdAt: string
}

export type PublicSite = {
  settings: SiteSettings
  logoVersion?: number // 0 / missing = the built-in logo; otherwise /logo?v=<n> is the uploaded one
  products: Product[]
  staff: StaffMember[]
  announcements: Announcement[]
}

export type RedeemCode = {
  id: number; code: string; mode: Mode; title: string; icon: string; description: string; commands: string[]
  maxUses: number | null; perPlayer: boolean; uses: number; expiresAt: string | null; active: boolean; createdAt: string
}
export type RedeemClaim = {
  id: number; codeId: number; code: string; mode: Mode; mcUsername: string; discordName: string; title: string; icon: string
  status: 'pending' | 'processing' | 'delivered' | 'manual' | 'failed'; note: string; createdAt: string; deliveredAt: string | null
}

export type AdminData = PublicSite & {
  redeem: { codes: RedeemCode[]; claims: RedeemClaim[] }
  deploy: {
    hasHook: boolean; hasToken: boolean; hookFromEnv: boolean; tokenFromEnv: boolean; projectId: string; teamId: string
    status: { at: number; items: { id: string; state: string; url: string; createdAt: number; target: string; message: string; sha: string }[] } | null
  }
  products: Product[]
  announcements: Announcement[]
  orders: Order[]
  approvers: string[]
  private: Omit<PrivateSettings, 'discordBotToken' | 'discordWebhookUrl'> & {
    hasBotToken: boolean
    hasSavedBotToken: boolean
    hasWebhook: boolean
    webhookPreview: string
    envBotToken: boolean
    discordLoginReady: boolean
    discordClientId: string
  }
}

export type DiscordUser = { id: string; name: string; username: string; avatar: string }
