import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

// Key/value site settings (server IP, Discord, branding, category labels, FAQ…)
export const settings = pgTable('settings', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// Store items. mode is survival | lifesteal, category is one of: ranks | keys | coins
export const products = pgTable('products', {
  id: serial().primaryKey(),
  mode: text().notNull().default('lifesteal'),
  category: text().notNull(),
  name: text().notNull(),
  price: integer(),
  oldPrice: integer('old_price'),
  icon: text().notNull().default('👑'),
  tag: text().notNull().default(''),
  color: text().notNull().default('#43dcff'),
  perks: jsonb().$type<string[]>().notNull().default([]),
  popular: boolean().notNull().default(false),
  active: boolean().notNull().default(true),
  durationDays: integer('duration_days'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
})

export const staff = pgTable('staff', {
  id: serial().primaryKey(),
  name: text().notNull(),
  role: text().notNull(),
  color: text().notNull().default('#43dcff'),
  discord: text().notNull().default(''),
  bio: text().notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
})

// source: web | discord
export const announcements = pgTable('announcements', {
  id: serial().primaryKey(),
  title: text().notNull(),
  body: text().notNull(),
  tag: text().notNull().default('News'),
  pinned: boolean().notNull().default(false),
  source: text().notNull().default('web'),
  author: text().notNull().default('MOMO MC'),
  discordMessageId: text('discord_message_id').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Cart checkouts. One order = one Discord ticket.
// status: pending (waiting for payment) | review (screenshot sent, staff checking) | paid (settled) | delivered | rejected | cancelled
export const orders = pgTable('orders', {
  id: serial().primaryKey(),
  mcUsername: text('mc_username').notNull(),
  discordName: text('discord_name').notNull().default(''),
  productId: integer('product_id'),
  productName: text('product_name').notNull(),
  category: text().notNull(),
  price: integer(),
  note: text().notNull().default(''),
  status: text().notNull().default('pending'),
  mode: text().notNull().default('lifesteal'),
  items: jsonb().$type<{ id: number; name: string; icon: string; category: string; price: number | null; qty: number; perks: string[] }[]>().notNull().default([]),
  discordId: text('discord_id').notNull().default(''),
  channelId: text('channel_id').notNull().default(''),
  proofUrl: text('proof_url').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Redeem codes. One code belongs to one mode; redeeming it creates a claim that the Discord bot delivers
// (it runs `commands` over RCON, replacing {player}, or asks staff to deliver by hand).
export const redeemCodes = pgTable('redeem_codes', {
  id: serial().primaryKey(),
  code: text().notNull().unique(),
  mode: text().notNull(),
  title: text().notNull(),
  icon: text().notNull().default('🎁'),
  description: text().notNull().default(''),
  commands: jsonb().$type<string[]>().notNull().default([]),
  maxUses: integer('max_uses'), // null = unlimited
  perPlayer: boolean('per_player').notNull().default(true), // one redeem per Discord account
  uses: integer().notNull().default(0),
  expiresAt: timestamp('expires_at'),
  active: boolean().notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// status: pending (waiting for the bot) | processing | delivered | manual (staff must deliver) | failed
export const redeemClaims = pgTable('redeem_claims', {
  id: serial().primaryKey(),
  codeId: integer('code_id').notNull(),
  code: text().notNull(),
  mode: text().notNull(),
  mcUsername: text('mc_username').notNull(),
  discordId: text('discord_id').notNull().default(''),
  discordName: text('discord_name').notNull().default(''),
  title: text().notNull(),
  icon: text().notNull().default('🎁'),
  commands: jsonb().$type<string[]>().notNull().default([]),
  status: text().notNull().default('pending'),
  note: text().notNull().default(''),
  uniqKey: text('uniq_key').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  deliveredAt: timestamp('delivered_at'),
})
