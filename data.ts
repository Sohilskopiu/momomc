import { createFileRoute } from '@tanstack/react-router'
import { verifyRequest } from '@/server/auth'
import { adminData } from '@/server/admin'
import { rateLimit } from '@/server/guard'

export const Route = createFileRoute('/api/admin/data')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const blocked = rateLimit(request, 'admin-data', 120, 60_000)
        if (blocked) return blocked
        if (!(await verifyRequest(request))) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        return Response.json(await adminData(), { headers: { 'Cache-Control': 'no-store' } })
      },
    },
  },
})
