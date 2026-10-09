import { createFileRoute } from '@tanstack/react-router'
import { randomBytes } from 'node:crypto'
import { seal } from '@/server/auth'
import { rateLimit } from '@/server/guard'
import { OAUTH_COOKIE, cookie, oauthConfig, redirectUri, safePath, siteOrigin } from '@/server/visitor'

// Step 1: send the visitor to Discord's consent screen.
export const Route = createFileRoute('/api/auth/discord')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const blocked = rateLimit(request, 'oauth-start', 30, 60_000)
        if (blocked) return blocked
        const url = new URL(request.url)
        const back = safePath(url.searchParams.get('return'))
        // The login cookie must live on the same address Discord sends the visitor back to (SITE_URL).
        // If the visitor is on another address (www / old vercel.app link), move them to SITE_URL first.
        const want = new URL(siteOrigin(request)).host
        const have = (request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host).toLowerCase()
        if (want.toLowerCase() !== have && url.searchParams.get('cn') !== '1') {
          const to = new URL('/api/auth/discord', siteOrigin(request))
          to.searchParams.set('return', back)
          to.searchParams.set('cn', '1')
          return Response.redirect(to.toString(), 302)
        }
        const { id, secret } = oauthConfig()
        if (!id || !secret) {
          const dest = new URL(back, url)
          dest.searchParams.set('login', 'unconfigured')
          return Response.redirect(dest.toString(), 302)
        }
        const state = randomBytes(16).toString('hex')
        const to = new URL('https://discord.com/oauth2/authorize')
        to.searchParams.set('client_id', id)
        to.searchParams.set('response_type', 'code')
        to.searchParams.set('scope', 'identify')
        to.searchParams.set('redirect_uri', redirectUri(request))
        to.searchParams.set('state', state)
        const headers = new Headers({ Location: to.toString() })
        headers.append('Set-Cookie', cookie(OAUTH_COOKIE, await seal('oauth', { state, back }, 10 * 60e3), request, 600))
        return new Response(null, { status: 302, headers })
      },
    },
  },
})
