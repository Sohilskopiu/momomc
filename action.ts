import { createFileRoute } from '@tanstack/react-router'
import { createToken, verifyRequest } from '@/server/auth'
import { adminData, runAction } from '@/server/admin'
import { rateLimit, readJson, sameOrigin } from '@/server/guard'

export const Route = createFileRoute('/api/admin/action')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const blocked = sameOrigin(request) ?? rateLimit(request, 'admin-action', 120, 60_000)
        if (blocked) return blocked
        const user = await verifyRequest(request)
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const { action, payload } = (await readJson(request, 1_200_000)) as { action?: string; payload?: any }
        try {
          const message = await runAction(String(action), payload ?? {}, user)
          // After a credential change the old session is void, so hand back a fresh token.
          const token = action === 'changeCredentials' ? await createToken(String(payload?.newUsername || user).trim()) : undefined
          return Response.json({ ok: true, message, token, data: await adminData() })
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : 'Action failed' }, { status: 400 })
        }
      },
    },
  },
})
