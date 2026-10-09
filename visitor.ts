import type { DiscordUser } from '../lib/types'
import { readCookie, seal, unseal } from './auth'

// "Login with Discord" for website visitors (OAuth2, identify scope only).
export const USER_COOKIE = 'momo_user'
export const OAUTH_COOKIE = 'momo_oauth'
const USER_DAYS = 30

export const oauthConfig = () => ({
  // The client ID is public (it is visible in the authorize link), so it is safe to keep as a default.
  id: process.env.DISCORD_CLIENT_ID || '1519990400574689430',
  secret: process.env.DISCORD_CLIENT_SECRET || '',
})

export const siteOrigin = (req: Request) => (process.env.SITE_URL || new URL(req.url).origin).replace(/\/$/, '')
export const redirectUri = (req: Request) => siteOrigin(req) + '/api/auth/callback'

// Only allow same-site return paths.
export const safePath = (p: string | null | undefined) => (p && p.startsWith('/') && !p.startsWith('//') && !p.startsWith('/api') ? p : '/')

export function cookie(name: string, value: string, req: Request, maxAgeSec: number) {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : ''
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`
}

export const sealUser = (u: DiscordUser) => seal('visitor', u, USER_DAYS * 86400e3)
export const userMaxAge = USER_DAYS * 86400

export async function getVisitor(req: Request): Promise<DiscordUser | null> {
  return unseal<DiscordUser>('visitor', readCookie(req, USER_COOKIE))
}

export function avatarUrl(id: string, hash: string | null) {
  if (hash) return `https://cdn.discordapp.com/avatars/${id}/${hash}.png?size=64`
  const idx = Number((BigInt(id) >> 22n) % 6n)
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`
}
