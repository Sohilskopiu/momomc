import { createFileRoute } from '@tanstack/react-router'
import { createToken } from '@/server/auth'
import { getVisitor } from '@/server/visitor'
import { OWNER_IDS } from '@/lib/owner'
import { rateLimit } from '@/server/guard'

// If the visitor is logged in with the owner's Discord account, hand out an admin session automatically.
// The Discord ID comes from the signed login cookie, so it cannot be faked from the browser.
export const Route = createFileRoute('/api/admin/owner')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const blocked = rateLimit(request, 'admin-owner', 60, 60_000)
        if (blocked) return blocked
        const user = await getVisitor(request)
        if (!user || !OWNER_IDS.includes(user.id as (typeof OWNER_IDS)[number])) return Response.json({ owner: false }, { headers: { 'Cache-Control': 'no-store' } })
        return Response.json({ owner: true, token: await createToken(`owner:${user.username}`) }, { headers: { 'Cache-Control': 'no-store' } })
      },
    },
  },
})
