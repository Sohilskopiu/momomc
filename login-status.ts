import { createFileRoute } from '@tanstack/react-router'
import { createToken } from '@/server/auth'
import { pollStatus } from '@/server/approval'
import { rateLimit } from '@/server/guard'

// The waiting login screen polls this. When an approver has approved, it gets the admin session token (once).
export const Route = createFileRoute('/api/admin/login-status')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const blocked = rateLimit(request, 'login-status', 90, 60_000)
        if (blocked) return blocked
        const q = new URL(request.url).searchParams
        const r = await pollStatus(q.get('id') || '', q.get('t') || '')
        const body = r.status === 'approved' && r.user ? { status: 'approved', token: await createToken(r.user) } : { status: r.status }
        return Response.json(body, { headers: { 'Cache-Control': 'no-store' } })
      },
    },
  },
})
