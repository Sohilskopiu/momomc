import { createFileRoute } from '@tanstack/react-router'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../../db/index.js'
import { orders, products } from '../../../db/schema.js'
import { getVisitor } from '@/server/visitor'
import { rateLimit, readJson, sameOrigin } from '@/server/guard'
import { getSettings } from '@/server/site'
import { storeIsOpen } from '@/lib/modes'
import { TicketError, channelExists, createTicket, summarize, ticketUrl } from '@/server/tickets'
import type { OrderItem } from '@/lib/types'

const Input = z.object({
  mode: z.enum(['survival', 'lifesteal']),
  mcUsername: z.string().trim().regex(/^[A-Za-z0-9_.]{3,20}$/, 'Enter a valid Minecraft username'),
  note: z.string().trim().max(300).default(''),
  items: z.array(z.object({ productId: z.number().int(), qty: z.number().int().min(1).max(20) })).min(1, 'Your cart is empty').max(30),
})

// Cart -> order -> private Discord ticket. The browser is then sent straight into that ticket.
export const Route = createFileRoute('/api/checkout')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const blocked = sameOrigin(request) ?? rateLimit(request, 'checkout', 8, 60_000)
        if (blocked) return blocked
        const user = await getVisitor(request)
        if (!user) return Response.json({ error: 'Login with Discord first.' }, { status: 401 })

        const parsed = Input.safeParse(await readJson(request))
        if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
        const { mode, mcUsername, note, items: cart } = parsed.data

        const settings = await getSettings()
        if (!storeIsOpen(settings, mode)) return Response.json({ error: `The ${mode} store is temporarily closed.` }, { status: 403 })

        // One open ticket per player per mode, so tickets do not pile up.
        const [open] = await db
          .select()
          .from(orders)
          .where(and(eq(orders.discordId, user.id), eq(orders.mode, mode), inArray(orders.status, ['pending', 'review', 'rejected'])))
          .orderBy(desc(orders.id))
          .limit(1)
        if (open?.channelId) {
          if (await channelExists(open.channelId)) {
            return Response.json(
              { error: `You already have an open ${mode} ticket (#${open.id}). Finish it or press Cancel order inside the ticket.`, code: 'open_ticket', url: await ticketUrl(mode, open.channelId) },
              { status: 409 },
            )
          }
          await db.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, open.id)) // channel was deleted
        }

        // Prices always come from the database, never from the browser.
        const rows = await db.select().from(products).where(and(eq(products.mode, mode), eq(products.active, true), inArray(products.id, cart.map((c) => c.productId))))
        const items: OrderItem[] = cart.flatMap((c) => {
          const p = rows.find((r) => r.id === c.productId && (r.category !== 'claims' || mode === 'survival'))
          return p ? [{ id: p.id, name: p.name, icon: p.icon, category: p.category, price: p.price, qty: c.qty, perks: p.perks, durationDays: p.durationDays }] : []
        })
        if (!items.length) return Response.json({ error: 'Those items are no longer available.' }, { status: 404 })

        const { total } = summarize(items, settings.currency)
        const [order] = await db
          .insert(orders)
          .values({
            mcUsername, note, mode, items,
            discordId: user.id,
            discordName: `${user.name} (@${user.username}) · ID ${user.id}`,
            productName: items.map((i) => `${i.name} ×${i.qty}`).join(', ').slice(0, 200),
            category: items.length === 1 ? items[0].category : 'mixed',
            price: total,
          })
          .returning({ id: orders.id })

        try {
          const channelId = await createTicket({ orderId: order.id, mode, user, mcUsername, note, items, currency: settings.currency })
          await db.update(orders).set({ channelId }).where(eq(orders.id, order.id))
          return Response.json({ ok: true, orderId: order.id, url: await ticketUrl(mode, channelId) })
        } catch (e) {
          await db.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, order.id))
          if (e instanceof TicketError) {
            return Response.json({ error: e.message, code: e.code, invite: e.code === 'not_member' ? settings.discordInvite : undefined }, { status: e.code === 'not_member' ? 403 : 502 })
          }
          console.error('checkout', e)
          return Response.json({ error: 'Could not open your ticket. Please try again in a moment.' }, { status: 502 })
        }
      },
    },
  },
})
