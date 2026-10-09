import { createFileRoute } from '@tanstack/react-router'
import { and, desc, eq } from 'drizzle-orm'
import { timingSafeEqual } from 'node:crypto'
import { db } from '../../../../db/index.js'
import { orders } from '../../../../db/schema.js'

// Lists orders for the Python bot (/myorders, /pending, /stats ...). Protected by BOT_API_KEY.
// Filters: ?discord=<id>  ?status=pending|review|paid|delivered|rejected|cancelled  ?mode=survival|lifesteal  ?limit=1..200
function authorized(req: Request) {
  const key = process.env.BOT_API_KEY || ''
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!key || key.length < 16) return false
  const a = Buffer.from(got), b = Buffer.from(key)
  return a.length === b.length && timingSafeEqual(a, b)
}

export const Route = createFileRoute('/api/bot/orders')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const q = new URL(request.url).searchParams
        const limit = Math.max(1, Math.min(200, Number(q.get('limit') || 20)))
        const where = and(
          q.get('discord') ? eq(orders.discordId, q.get('discord')!) : undefined,
          q.get('status') ? eq(orders.status, q.get('status')!) : undefined,
          q.get('mode') ? eq(orders.mode, q.get('mode')!) : undefined,
        )
        const rows = await db.select().from(orders).where(where).orderBy(desc(orders.id)).limit(limit)
        return Response.json({ orders: rows }, { headers: { 'Cache-Control': 'no-store' } })
      },
    },
  },
})
