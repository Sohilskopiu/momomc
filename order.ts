import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { timingSafeEqual } from 'node:crypto'
import { db } from '../../../../db/index.js'
import { orders } from '../../../../db/schema.js'

// Used only by the Discord bot process in /bot. Protected by BOT_API_KEY.
function authorized(req: Request) {
  const key = process.env.BOT_API_KEY || ''
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!key || key.length < 16) return false
  const a = Buffer.from(got), b = Buffer.from(key)
  return a.length === b.length && timingSafeEqual(a, b)
}

const NEXT: Record<string, { to: 'review' | 'paid' | 'rejected' | 'cancelled' | 'delivered'; from: string[] }> = {
  proof: { to: 'review', from: ['pending', 'rejected', 'review'] },
  settle: { to: 'paid', from: ['review', 'pending'] },
  reject: { to: 'rejected', from: ['review', 'pending'] },
  cancel: { to: 'cancelled', from: ['pending', 'review', 'rejected'] },
  deliver: { to: 'delivered', from: ['paid'] },
}

export const Route = createFileRoute('/api/bot/order')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const q = new URL(request.url).searchParams
        const channel = q.get('channel') || ''
        const id = Number(q.get('id') || 0)
        const [order] = channel
          ? await db.select().from(orders).where(eq(orders.channelId, channel))
          : id ? await db.select().from(orders).where(eq(orders.id, id)) : []
        return Response.json({ order: order ?? null }, { headers: { 'Cache-Control': 'no-store' } })
      },
      POST: async ({ request }) => {
        if (!authorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const body = (await request.json().catch(() => ({}))) as { id?: number; action?: string; proofUrl?: string }
        const rule = NEXT[body.action ?? '']
        if (!rule || !body.id) return Response.json({ error: 'Bad request' }, { status: 400 })
        const [current] = await db.select().from(orders).where(eq(orders.id, Number(body.id)))
        if (!current) return Response.json({ error: 'Order not found' }, { status: 404 })
        if (!rule.from.includes(current.status)) return Response.json({ error: `Order is already ${current.status}`, order: current }, { status: 409 })
        const set: Record<string, unknown> = { status: rule.to }
        if (body.action === 'proof' && body.proofUrl) set.proofUrl = String(body.proofUrl).slice(0, 1000)
        const [order] = await db.update(orders).set(set).where(eq(orders.id, current.id)).returning()
        return Response.json({ order })
      },
    },
  },
})
