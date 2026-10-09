import { createFileRoute } from '@tanstack/react-router'
import { timingSafeEqual } from 'node:crypto'
import { ticketConfig } from '@/server/tickets'

// The bot asks the website which staff role and log channel belong to each mode,
// so those are edited in the Admin Panel and never need a bot restart.
export const Route = createFileRoute('/api/bot/config')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = process.env.BOT_API_KEY || ''
        const got = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
        const a = Buffer.from(got), b = Buffer.from(key)
        if (key.length < 16 || a.length !== b.length || !timingSafeEqual(a, b)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const [survival, lifesteal] = await Promise.all([ticketConfig('survival'), ticketConfig('lifesteal')])
        const pick = (c: typeof survival) => ({ staffRoleId: c.staffRoleId, logChannelId: c.logChannelId, upiId: c.upiId, qrUrl: c.qrUrl, payment: c.payment })
        return Response.json({
          survival: pick(survival),
          lifesteal: pick(lifesteal),
        }, { headers: { 'Cache-Control': 'no-store' } })
      },
    },
  },
})
