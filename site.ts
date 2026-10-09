import { asc, desc, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { announcements, orders, products, settings, staff } from '../../db/schema.js'
import { DEFAULT_PRIVATE, DEFAULT_SETTINGS, SEED_ANNOUNCEMENTS, SEED_CLAIM_PRODUCTS, SEED_PRODUCTS, SEED_STAFF } from '../lib/defaults'
import type { Announcement, Order, PrivateSettings, Product, PublicSite, SiteSettings, StaffMember } from '../lib/types'

let seeded = false

// First visit fills an empty database with the MOMO MC starter content.
export async function ensureSeeded() {
  if (seeded) return
  const claimed = await db.insert(settings).values({ key: 'seeded', value: true }).onConflictDoNothing().returning()
  if (claimed.length) {
    // Each mode gets its own copy of the starter items so prices can be edited per mode.
    await db.insert(products).values(
      (['lifesteal', 'survival'] as const).flatMap((mode) => SEED_PRODUCTS.map((p, i) => ({ ...p, mode, perks: [...p.perks], durationDays: p.category === 'ranks' ? 30 : null, sortOrder: i }))),
    )
    await db.insert(staff).values(SEED_STAFF.map((s, i) => ({ ...s, sortOrder: i })))
    await db.insert(announcements).values([...SEED_ANNOUNCEMENTS])
  }
  // Claim blocks (Survival only) are added once, also to databases that were seeded before this category existed.
  const claims = await db.insert(settings).values({ key: 'seeded_claims', value: true }).onConflictDoNothing().returning()
  if (claims.length) {
    await db.insert(products).values(SEED_CLAIM_PRODUCTS.map((p, i) => ({ ...p, mode: 'survival' as const, perks: [...p.perks], sortOrder: 100 + i })))
  }
  seeded = true
}

export async function readKey<T extends object>(key: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key))
  return { ...fallback, ...((row?.value as object) || {}) } as T
}

export async function writeKey(key: string, value: unknown) {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } })
}

export const getSettings = () => readKey<SiteSettings>('site', DEFAULT_SETTINGS)
export const getPrivate = () => readKey<PrivateSettings>('private', DEFAULT_PRIVATE)

// Admin credentials (salted hash) and the random key used to sign sessions. Never sent to the browser.
export const getAuth = () => readKey<{ user?: string; salt?: string; hash?: string; sessionKey?: string }>('auth', {})

const iso = <T extends { createdAt: Date | null }>(r: T) => ({ ...r, createdAt: (r.createdAt ?? new Date()).toISOString() })

export async function listProducts(all = false): Promise<Product[]> {
  const rows = await db.select().from(products).orderBy(asc(products.sortOrder), asc(products.id))
  return rows.filter((r) => all || r.active).map(({ createdAt: _c, ...r }) => r as Product)
}

export async function listStaff(): Promise<StaffMember[]> {
  return db.select().from(staff).orderBy(asc(staff.sortOrder), asc(staff.id))
}

export async function listAnnouncements(limit = 50): Promise<Announcement[]> {
  const rows = await db.select().from(announcements).orderBy(desc(announcements.pinned), desc(announcements.createdAt)).limit(limit)
  return rows.map(({ discordMessageId: _d, ...r }) => iso(r) as Announcement)
}

export async function listOrders(): Promise<Order[]> {
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(300)
  return rows.map((r) => iso(r) as Order)
}

export async function getPublicSite(): Promise<PublicSite> {
  await ensureSeeded()
  const [s, p, st, a] = await Promise.all([getSettings(), listProducts(), listStaff(), listAnnouncements(30)])
  const logo = await readKey<{ v?: number }>('logo_meta', {})
  return { settings: s, products: p, staff: st, announcements: a, logoVersion: logo.v || 0 }
}
