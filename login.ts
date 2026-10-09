import { createFileRoute } from '@tanstack/react-router'
import { checkCredentials, createToken } from '@/server/auth'
import { clientIp, rateLimit, readJson, sameOrigin } from '@/server/guard'
import { approvalEnabled, createRequest } from '@/server/approval'
import { siteOrigin } from '@/server/visitor'

// Best-effort brute-force guard (per server instance): 6 failures per IP per 10 minutes.
const fails = new Map<string, { n: number; until: number }>()

export const Route = createFileRoute('/api/admin/login')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const blocked = sameOrigin(request) ?? rateLimit(request, 'admin-login', 30, 10 * 60_000)
        if (blocked) return blocked
        const ip = clientIp(request)
        const f = fails.get(ip)
        if (f && f.n >= 6 && f.until > Date.now()) {
          return Response.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 })
        }
        const { username = '', password = '' } = (await readJson(request, 2_000)) as { username?: string; password?: string }
        if (!(await checkCredentials(String(username), String(password)))) {
          fails.set(ip, { n: (f && f.until > Date.now() ? f.n : 0) + 1, until: Date.now() + 10 * 60e3 })
          await new Promise((r) => setTimeout(r, 800))
          return Response.json({ error: 'Wrong username or password' }, { status: 401 })
        }
        fails.delete(ip)
        // Right password is not enough: one of the approver Discord accounts must approve this login first.
        if (approvalEnabled()) {
          const limited = rateLimit(request, 'login-approval', 5, 10 * 60_000)
          if (limited) return limited
          try {
            const { id, poll } = await createRequest(String(username), ip, request.headers.get('user-agent') || 'unknown', siteOrigin(request))
            return Response.json({ pending: true, id, poll, expiresIn: 600 })
          } catch (e) {
            console.error('login approval post failed', e)
            const detail = e instanceof Error ? e.message : 'Unknown Discord error'
            return Response.json({ error: `Could not post the approval request in Discord, so login stays locked. ${detail}` }, { status: 503 })
          }
        }
        return Response.json({ token: await createToken(String(username)) })
      },
    },
  },
})
