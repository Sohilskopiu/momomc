import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getVisitor } from '@/server/visitor'
import { rateLimit, readJson, sameOrigin } from '@/server/guard'
import { MC_NAME, RedeemError, redeemCode } from '@/server/redeem'

const Input = z.object({
  mode: z.enum(['survival', 'lifesteal']),
  code: z.string().trim().min(4, 'Enter your code').max(60),
  mcUsername: z.string().trim().regex(MC_NAME, 'Enter a valid Minecraft username'),
})

// Redeem a code for one game mode. Needs a Discord login; the Discord bot then delivers the reward in-game.
export const Route = createFileRoute('/api/redeem')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Strict limit: stops anyone from guessing codes.
        const blocked = sameOrigin(request) ?? rateLimit(request, 'redeem', 8, 60_000)
        if (blocked) return blocked
        const user = await getVisitor(request)
        if (!user) return Response.json({ error: 'Login with Discord first.' }, { status: 401 })
        const parsed = Input.safeParse(await readJson(request))
        if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
        try {
          const { code } = await redeemCode(parsed.data.mode, parsed.data.code, parsed.data.mcUsername, user)
          return Response.json({ ok: true, title: code.title, icon: code.icon, description: code.description, auto: code.commands.length > 0 })
        } catch (e) {
          if (e instanceof RedeemError) return Response.json({ error: e.message }, { status: e.status })
          console.error('redeem failed', e)
          return Response.json({ error: 'Could not redeem right now, please try again.' }, { status: 500 })
        }
      },
    },
  },
})
