import { DEFAULT_MODE_CONFIG } from './modes'
import { DEFAULT_THEME } from './theme'
import type { PrivateSettings, SiteSettings } from './types'

export const DEFAULT_SETTINGS: SiteSettings = {
  theme: DEFAULT_THEME,
  serverName: 'MOMO MC',
  heroEyebrow: 'Minecraft Network · Java & Bedrock',
  heroTitle: 'Your adventure starts here.',
  heroSubtitle: 'Two worlds, one network. Build in Survival or fight for hearts in Lifesteal, then power up in each mode\'s own store.',
  tickerText: 'Survival & Lifesteal are LIVE · Join our Discord for giveaways',
  ip: 'play.momomc.fun',
  port: '25565',
  bedrockIp: 'play.momomc.fun',
  bedrockPort: '19132',
  version: '1.20 – 1.21',
  discordInvite: 'https://discord.gg/MomoMc',
  currency: '₹',
  storeOpen: true,
  storeNote: 'Add items to your cart, continue to payment and finish in your private Discord ticket. Staff deliver it in-game.',
  categories: {
    ranks: { label: 'Ranks', icon: '👑', description: 'Ranks with exclusive perks, kits and a shiny prefix.', enabled: true },
    keys: { label: 'Keys', icon: '🔑', description: 'Crate keys packed with rare loot, gear and spawners.', enabled: true },
    coins: { label: 'Coins', icon: '🪙', description: 'In-game coins to spend in the server shop and auction house.', enabled: true },
    claims: { label: 'Claim Blocks', icon: '🧱', description: 'More claim blocks to protect a bigger base. Survival only.', enabled: true },
  },
  modeConfig: DEFAULT_MODE_CONFIG,
  modes: [
    { name: 'Lifesteal', icon: '❤️', description: 'Kill to steal hearts, lose them all and you are out. Pure PvP adrenaline.', status: 'live' },
    { name: 'Survival', icon: '🌲', description: 'Classic survival with claims, jobs and a player economy.', status: 'live' },
  ],
  features: [
    { icon: '⚡', title: 'Lag-free performance', text: 'Tuned hardware and optimized plugins keep every fight smooth.' },
    { icon: '🛡️', title: 'Fair & protected', text: 'Active anti-cheat and a staff team online around the clock.' },
    { icon: '🎉', title: 'Weekly events', text: 'Tournaments, drop parties and giveaways every single week.' },
    { icon: '💬', title: 'Real community', text: 'A friendly Discord where players team up and make friends.' },
  ],
  faq: [
    { q: 'How do I buy?', a: 'Open Survival or Lifesteal, add items to your cart and press Continue to payment. You land in a private Discord ticket where the bot lists your price and perks. Pay, send a screenshot and staff deliver in-game.' },
    { q: 'When will I get my item?', a: 'Items are delivered in-game after staff verify your payment — usually within a few hours.' },
    { q: 'Can I join from Bedrock / mobile?', a: 'Yes! Use the Bedrock IP and port shown on the home page.' },
    { q: 'I have a payment problem.', a: 'Tell staff inside your ticket right away — we will sort it out.' },
  ],
  youtube: '',
  instagram: '',
}

const NO_TICKET = { categoryId: '', staffRoleId: '', paymentInfo: '', logChannelId: '', upiId: '', qrUrl: '' }
export const DEFAULT_PRIVATE: PrivateSettings = {
  guildId: '',
  tickets: { survival: { ...NO_TICKET }, lifesteal: { ...NO_TICKET } },
  discordWebhookUrl: '',
  discordBotToken: '',
  discordChannelId: '',
  autoPostToDiscord: true,
  lastDiscordSync: null,
}

// Claim blocks are sold in Survival only. Prices are starting values: edit them in Admin Panel > Store Items & Prices.
export const SEED_CLAIM_PRODUCTS = [
  { category: 'claims', name: '100 Claim Blocks', price: 20, icon: '🧱', tag: 'Starter', color: '#4ade80', perks: ['+100 claim blocks', 'Protect a small base'] },
  { category: 'claims', name: '500 Claim Blocks', price: 80, icon: '🧱', tag: 'Pack', color: '#4ade80', perks: ['+500 claim blocks', 'Room for farms and builds'] },
  { category: 'claims', name: '1,000 Claim Blocks', price: 150, icon: '🏡', tag: 'Pack', color: '#38bdf8', perks: ['+1,000 claim blocks', 'A full base with land around it'], popular: true },
  { category: 'claims', name: '5,000 Claim Blocks', price: 600, icon: '🏰', tag: 'Best Value', color: '#facc15', perks: ['+5,000 claim blocks', 'Build a whole town'] },
] as const

export const SEED_PRODUCTS = [
  { category: 'ranks', name: 'VIP+', price: 50, icon: '💠', tag: 'Tier 1', color: '#4ade80', perks: ['VIP+ prefix in chat', '2 /sethome', 'Kit VIP every 3 days'] },
  { category: 'ranks', name: 'Hero', price: 100, icon: '🛡️', tag: 'Tier 2', color: '#38bdf8', perks: ['Hero prefix', '4 /sethome', 'Kit Hero', '/craft access'], popular: true },
  { category: 'ranks', name: 'Lord', price: 200, icon: '⚔️', tag: 'Tier 3', color: '#818cf8', perks: ['Lord prefix', '6 /sethome', 'Kit Lord', '/enderchest'] },
  { category: 'ranks', name: 'Legend', price: 300, icon: '🔥', tag: 'Tier 4', color: '#f59e0b', perks: ['Legend prefix', '8 /sethome', 'Kit Legend', '/feed'] },
  { category: 'ranks', name: 'Eternal', price: 400, icon: '🌌', tag: 'Tier 5', color: '#c084fc', perks: ['Eternal prefix', '10 /sethome', 'Kit Eternal', '/fly in lobby'] },
  { category: 'ranks', name: 'Ultra', price: 500, icon: '⚡', tag: 'Tier 6', color: '#f43f5e', perks: ['Ultra prefix', 'Unlimited homes', 'Kit Ultra', '/nick'] },
  { category: 'ranks', name: 'Custom', price: 1200, icon: '✨', tag: 'Ultimate', color: '#facc15', perks: ['Your own custom rank', 'Custom prefix & colour', 'All Ultra perks'] },
  { category: 'keys', name: 'Legend Key', price: null, icon: '🔑', tag: 'Crate Key', color: '#f59e0b', perks: [] },
  { category: 'keys', name: 'Eternal Key', price: null, icon: '🔑', tag: 'Crate Key', color: '#c084fc', perks: [] },
  { category: 'keys', name: 'Ultra Key', price: null, icon: '🔑', tag: 'Crate Key', color: '#f43f5e', perks: [] },
  { category: 'keys', name: 'Spawner Key', price: null, icon: '🗝️', tag: 'Crate Key', color: '#43dcff', perks: [] },
  { category: 'coins', name: '100 Coins', price: null, icon: '🪙', tag: 'Starter', color: '#facc15', perks: [] },
  { category: 'coins', name: '500 Coins', price: null, icon: '🪙', tag: 'Pack', color: '#facc15', perks: [] },
  { category: 'coins', name: '1,000 Coins', price: null, icon: '💰', tag: 'Pack', color: '#facc15', perks: [] },
  { category: 'coins', name: '5,000 Coins', price: null, icon: '💎', tag: 'Best Value', color: '#43dcff', perks: [], popular: true },
] as const

export const SEED_STAFF = [
  { name: 'MAGAROX7x', role: 'Owner', color: '#f43f5e', bio: 'Founder of MOMO MC.' },
  { name: 'Notch', role: 'Admin', color: '#f59e0b', bio: 'Keeps the network running.' },
  { name: 'Steve', role: 'Moderator', color: '#38bdf8', bio: 'Here to help — ask anything.' },
  { name: 'Alex', role: 'Helper', color: '#4ade80', bio: 'Guides new players.' },
]

export const SEED_ANNOUNCEMENTS = [
  { title: 'Lifesteal Season is live!', body: 'The new Lifesteal season has started. Fresh map, balanced hearts and new crate rewards. Hop in at play.momomc.fun!', tag: 'Update', pinned: true },
  { title: 'Official store is open', body: 'Ranks, keys and coins are now available in the MOMO MC store. Every purchase supports the server.', tag: 'Store' },
]
