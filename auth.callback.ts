import { createFileRoute } from '@tanstack/react-router'
import { readCookie, unseal } from '@/server/auth'
import { rateLimit } from '@/server/guard'
import { OAUTH_COOKIE, USER_COOKIE, avatarUrl, cookie, oauthConfig, redirectUri, sealUser, userMaxAge } from '@/server/visitor'

// Step 2: Discord sends the visitor back here with ?code=...
export const Route = createFileRoute('/api/auth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const blocked = rateLimit(request, 'oauth-cb', 30, 60_000)
        if (blocked) return blocked
        const url = new URL(request.url)
        const saved = await unseal<{ state: string; back: string }>('oauth', readCookie(request, OAUTH_COOKIE))
        const back = saved?.back || '/'
        const go = (login: 'ok' | 'error', why?: string, extra?: string) => {
          const dest = new URL(back, url)
          dest.searchParams.set('login', login)
          if (why) dest.searchParams.set('why', why)
          if (why === 'redirect') dest.searchParams.set('ru', redirectUri(request))
          const h = new Headers({ Location: dest.toString() })
          h.append('Set-Cookie', cookie(OAUTH_COOKIE, '', request, 0))
          if (extra) h.append('Set-Cookie', extra)
          return new Response(null, { status: 302, headers: h })
        }

        if (url.searchParams.get('error')) return go('error', 'denied')
        const code = url.searchParams.get('code')
        if (!saved || !code || url.searchParams.get('state') !== saved.state) return go('error', 'session')

        try {
          const { id, secret } = oauthConfig()
          const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: 'authorization_code', code, redirect_uri: redirectUri(request) }),
          })
          if (!tokenRes.ok) {
            const body = (await tokenRes.json().catch(() => ({}))) as { error?: string; error_description?: string }
            console.error('Discord token step failed', tokenRes.status, body.error, body.error_description)
            if (body.error === 'invalid_client') return go('error', 'secret')
            if (body.error === 'invalid_grant' && /redirect/i.test(body.error_description ?? '')) return go('error', 'redirect')
            return go('error', 'token')
          }
          const { access_token } = await tokenRes.json()
          const meRes = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${access_token}` } })
          if (!meRes.ok) return go('error', 'user')
          const me = await meRes.json()
          const user = { id: String(me.id), name: String(me.global_name || me.username), username: String(me.username), avatar: avatarUrl(me.id, me.avatar) }
          return go('ok', undefined, cookie(USER_COOKIE, await sealUser(user), request, userMaxAge))
        } catch (e) {
          console.error('Discord login failed', e)
          return go('error', 'token')
        }
      },
    },
  },
})
