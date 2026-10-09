import { createFileRoute } from '@tanstack/react-router'
import { getVisitor } from '@/server/visitor'
import { rateLimit } from '@/server/guard'

export const Route = createFileRoute('/api/auth/me')({
  server: {
    handlers: {
      GET: async ({ request }) => rateLimit(request, 'me', 120, 60_000) ?? Response.json({ user: await getVisitor(request) }, { headers: { 'Cache-Control': 'no-store' } }),
    },
  },
})
