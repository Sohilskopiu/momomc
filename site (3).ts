import { createFileRoute } from '@tanstack/react-router'
import { getPublicSite } from '@/server/site'
import { maybeSync } from '@/server/discord'
import { rateLimit } from '@/server/guard'

export const Route = createFileRoute('/api/site')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const blocked = rateLimit(request, 'site', 120, 60_000)
        if (blocked) return blocked
        await maybeSync()
        return Response.json(await getPublicSite(), { headers: { 'Cache-Control': 'no-store' } })
      },
    },
  },
})
