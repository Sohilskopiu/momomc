import { createFileRoute } from '@tanstack/react-router'
import { USER_COOKIE, cookie } from '@/server/visitor'
import { sameOrigin } from '@/server/guard'

export const Route = createFileRoute('/api/auth/logout')({
  server: {
    handlers: {
      POST: async ({ request }) =>
        sameOrigin(request) ?? new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie(USER_COOKIE, '', request, 0) } }),
    },
  },
})
