import { createFileRoute } from '@tanstack/react-router'
import { timingSafeEqual } from 'node:crypto'
import { syncFromDiscord } from '@/server/discord'

// Called by Vercel Cron (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`.
// Visiting the site also syncs (maybeSync), so this is only a safety net.
export const Route = createFileRoute('/api/cron/discord-sync')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = process.env.CRON_SECRET || ''
        const got = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
        const a = Buffer.from(got), b = Buffer.from(key)
        if (key.length < 16 || a.length !== b.length || !timingSafeEqual(a, b)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        try {
          return Response.json(await syncFromDiscord(), { headers: { 'Cache-Control': 'no-store' } })
        } catch (e) {
          return Response.json({ error: String(e) }, { status: 500 })
        }
      },
    },
  },
})
