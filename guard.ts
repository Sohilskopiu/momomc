// Request guard: rate limiting, same-origin check and body-size cap for public API routes.
// Rate limits are kept in memory, so they are per server instance (best effort on serverless).
// For a hard limit across all instances also turn on Vercel Firewall rate-limit rules (see README).

const buckets = new Map<string, { n: number; reset: number }>()

export function clientIp(req: Request) {
  const h = req.headers
  return (h.get('x-vercel-forwarded-for') || h.get('x-real-ip') || h.get('x-forwarded-for') || 'unknown').split(',')[0].trim()
}

const tooMany = (retry: number) =>
  Response.json({ error: 'Too many requests. Please slow down and try again shortly.' }, { status: 429, headers: { 'Retry-After': String(retry), 'Cache-Control': 'no-store' } })

/** Returns a 429 Response when `name` was called more than `max` times by this IP in `windowMs`, otherwise null. */
export function rateLimit(req: Request, name: string, max: number, windowMs: number): Response | null {
  const now = Date.now()
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k)
  const key = `${name}:${clientIp(req)}`
  const b = buckets.get(key)
  if (!b || b.reset <= now) {
    buckets.set(key, { n: 1, reset: now + windowMs })
    return null
  }
  b.n++
  return b.n > max ? tooMany(Math.ceil((b.reset - now) / 1000)) : null
}

/** Blocks cross-site browser POSTs (CSRF). Server-to-server calls without an Origin header pass. */
export function sameOrigin(req: Request): Response | null {
  const site = req.headers.get('sec-fetch-site')
  if (site === 'cross-site') return Response.json({ error: 'Forbidden' }, { status: 403 })
  const origin = req.headers.get('origin')
  if (!origin) return null
  let host = ''
  try { host = new URL(origin).host.toLowerCase() } catch { return Response.json({ error: 'Forbidden' }, { status: 403 }) }
  const allowed = new Set<string>()
  const own = req.headers.get('x-forwarded-host') || req.headers.get('host')
  if (own) allowed.add(own.toLowerCase())
  try { if (process.env.SITE_URL) allowed.add(new URL(process.env.SITE_URL).host.toLowerCase()) } catch { /* ignore bad SITE_URL */ }
  return allowed.has(host) ? null : Response.json({ error: 'Forbidden' }, { status: 403 })
}

/** Reads a JSON body but refuses anything bigger than `maxBytes`. Returns {} for bad or oversized input. */
export async function readJson(req: Request, maxBytes = 20_000): Promise<unknown> {
  const len = Number(req.headers.get('content-length') || 0)
  if (len > maxBytes) return {}
  const text = await req.text().catch(() => '')
  if (text.length > maxBytes) return {}
  try { return JSON.parse(text) } catch { return {} }
}
