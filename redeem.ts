import { and, desc, eq, sql } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { db } from '../../db/index.js'
import { redeemClaims, redeemCodes } from '../../db/schema.js'
import type { Mode, RedeemClaim, RedeemCode } from '../lib/types'

// The two tables are created on first use, so an existing database needs no manual migration.
let ready: Promise<void> | null = null
export function ensureRedeemTables() {
  ready ??= (async () => {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS "redeem_codes" (
      "id" serial PRIMARY KEY, "code" text NOT NULL UNIQUE, "mode" text NOT NULL, "title" text NOT NULL,
      "icon" text NOT NULL DEFAULT '🎁', "description" text NOT NULL DEFAULT '', "commands" jsonb NOT NULL DEFAULT '[]',
      "max_uses" integer, "per_player" boolean NOT NULL DEFAULT true, "uses" integer NOT NULL DEFAULT 0,
      "expires_at" timestamp, "active" boolean NOT NULL DEFAULT true, "created_at" timestamp NOT NULL DEFAULT now())`)
    await db.execute(sql`CREATE TABLE IF NOT EXISTS "redeem_claims" (
      "id" serial PRIMARY KEY, "code_id" integer NOT NULL, "code" text NOT NULL, "mode" text NOT NULL, "mc_username" text NOT NULL,
      "discord_id" text NOT NULL DEFAULT '', "discord_name" text NOT NULL DEFAULT '', "title" text NOT NULL,
      "icon" text NOT NULL DEFAULT '🎁', "commands" jsonb NOT NULL DEFAULT '[]', "status" text NOT NULL DEFAULT 'pending',
      "note" text NOT NULL DEFAULT '', "uniq_key" text UNIQUE, "created_at" timestamp NOT NULL DEFAULT now(), "delivered_at" timestamp)`)
  })().catch((e) => { ready = null; throw e })
  return ready
}

export class RedeemError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

// Only these characters ever reach a game console, so a name can never smuggle in a second command.
export const MC_NAME = /^[A-Za-z0-9_.]{3,20}$/

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export function genCode() {
  const s = Array.from(randomBytes(12), (x) => ALPHABET[x % ALPHABET.length]).join('')
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`
}
export const normCode = (c: string) => String(c || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 40)

/** One command per line. {player} is replaced by the redeemer's Minecraft name. */
export function parseCommands(v: unknown): string[] {
  const lines = String(v ?? '').split(/\r?\n/).map((l) => l.trim().replace(/^\//, '').trim()).filter(Boolean)
  if (lines.length > 10) throw new Error('At most 10 commands per code')
  for (const l of lines) {
    if (l.length > 200) throw new Error('A command is too long (max 200 characters)')
    if (/[\u0000-\u001f]/.test(l)) throw new Error('Commands cannot contain control characters')
  }
  return lines
}

const dbErrCode = (e: unknown) => (e as { code?: string })?.code ?? (e as { cause?: { code?: string } })?.cause?.code

export async function redeemCode(mode: Mode, rawCode: string, mcUsername: string, user: { id: string; name: string; username: string }) {
  await ensureRedeemTables()
  const code = normCode(rawCode)
  if (code.length < 4) throw new RedeemError('Enter your code.')
  const [row] = await db.select().from(redeemCodes).where(eq(redeemCodes.code, code))
  if (!row || !row.active) throw new RedeemError('That code is not valid.', 404)
  if (row.mode !== mode) throw new RedeemError('That code belongs to the other game mode. Switch the mode at the top of this page.', 400)
  if (row.expiresAt && row.expiresAt <= new Date()) throw new RedeemError('This code has expired.', 410)

  // Reserve one use atomically so a limited code can never be over-used, even when two people press at the same time.
  const reserved = await db
    .update(redeemCodes)
    .set({ uses: sql`${redeemCodes.uses} + 1` })
    .where(and(
      eq(redeemCodes.id, row.id),
      eq(redeemCodes.active, true),
      sql`(${redeemCodes.maxUses} IS NULL OR ${redeemCodes.uses} < ${redeemCodes.maxUses})`,
      sql`(${redeemCodes.expiresAt} IS NULL OR ${redeemCodes.expiresAt} > now())`,
    ))
    .returning({ id: redeemCodes.id })
  if (!reserved.length) throw new RedeemError('This code has already been used up.', 410)

  try {
    const [claim] = await db
      .insert(redeemClaims)
      .values({
        codeId: row.id, code, mode, mcUsername,
        discordId: user.id, discordName: `${user.name} (@${user.username}) · ID ${user.id}`,
        title: row.title, icon: row.icon, commands: row.commands,
        uniqKey: row.perPlayer ? `${row.id}:${user.id}` : null, // unique, so one account cannot redeem it twice
      })
      .returning()
    return { claim, code: row }
  } catch (e) {
    await db.update(redeemCodes).set({ uses: sql`${redeemCodes.uses} - 1` }).where(eq(redeemCodes.id, row.id))
    if (dbErrCode(e) === '23505') throw new RedeemError('You already redeemed this code.', 409)
    throw e
  }
}

const iso = (d: Date | null) => (d ? d.toISOString() : null)

export async function listRedeem(): Promise<{ codes: RedeemCode[]; claims: RedeemClaim[] }> {
  await ensureRedeemTables()
  const [codes, claims] = await Promise.all([
    db.select().from(redeemCodes).orderBy(desc(redeemCodes.id)).limit(500),
    db.select().from(redeemClaims).orderBy(desc(redeemClaims.id)).limit(150),
  ])
  return {
    codes: codes.map((c) => ({ ...c, mode: c.mode as Mode, expiresAt: iso(c.expiresAt), createdAt: c.createdAt.toISOString() })),
    claims: claims.map(({ commands: _c, uniqKey: _u, discordId: _d, ...c }) => ({
      ...c, mode: c.mode as Mode, status: c.status as RedeemClaim['status'], createdAt: c.createdAt.toISOString(), deliveredAt: iso(c.deliveredAt),
    })),
  }
}
