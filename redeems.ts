import { createFileRoute } from '@tanstack/react-router'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { timingSafeEqual } from 'node:crypto'
import { db } from '../../../../db/index.js'
import { redeemClaims } from '../../../../db/schema.js'
import { ensureRedeemTables } from '@/server/redeem'

// Used only by the Discord bot. Protected by BOT_API_KEY.
//   GET  ?status=pending&limit=20   or   ?id=12
//   POST { id, action: claim | delivered | manual | failed, note? }
function authorized(req: Request) {
  const key = process.env.BOT_API_KEY || ''
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!key || key.length < 16) return false
  const a = Buffer.from(got), b = Buffer.from(key)
  return a.length === b.length && timingSafeEqual(a, b)
}

const NEXT: Record<string, { to: string; from: string[] }> = {
  claim: { to: 'processing', from: ['pending'] }, // only one bot run can take a claim
  delivered: { to: 'delivered', from: ['processing', 'manual', 'pending', 'failed'] },
  manual: { to: 'manual', from: ['processing'] },
  failed: { to: 'failed', from: ['processing', 'pending'] },
}

export const Route = createFileRoute('/api/bot/redeems')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        await ensureRedeemTables()
        const q = new URL(request.url).searchParams
        const id = Number(q.get('id') || 0)
        const limit = Math.max(1, Math.min(50, Number(q.get('limit') || 20)))
        const rows = await db
          .select()
          .from(redeemClaims)
          .where(id ? eq(redeemClaims.id, id) : eq(redeemClaims.status, q.get('status') || 'pending'))
          .orderBy(asc(redeemClaims.id))
          .limit(limit)
        return Response.json({ claims: rows }, { headers: { 'Cache-Control': 'no-store' } })
      },
      POST: async ({ request }) => {
        if (!authorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        await ensureRedeemTables()
        const body = (await request.json().catch(() => ({}))) as { id?: number; action?: string; note?: string }
        const rule = NEXT[body.action ?? '']
        if (!rule || !body.id) return Response.json({ error: 'Bad request' }, { status: 400 })
        const set: Record<string, unknown> = { status: rule.to }
        if (body.note !== undefined) set.note = String(body.note).slice(0, 300)
        if (rule.to === 'delivered') set.deliveredAt = new Date()
        const [claim] = await db
          .update(redeemClaims)
          .set(set)
          .where(and(eq(redeemClaims.id, Number(body.id)), inArray(redeemClaims.status, rule.from)))
          .returning()
        if (!claim) return Response.json({ error: 'Claim not found or already handled' }, { status: 409 })
        return Response.json({ claim })
      },
    },
  },
})
