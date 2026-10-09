import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { getAuth, writeKey } from './site'

// ---------------------------------------------------------------------------
// Admin login
//  1. Credentials saved from the Admin Panel (Security tab) live in the database
//     as a salted scrypt hash and win over everything else.
//  2. Before that, ADMIN_USERNAME / ADMIN_PASSWORD env vars are used.
//  3. As a last resort the built-in default account below.
//  Locked out? Set ADMIN_FORCE_ENV=true together with ADMIN_USERNAME / ADMIN_PASSWORD
//  and the env credentials work again (then change them in the panel).
// ---------------------------------------------------------------------------
const DEFAULT_USER = 'MAGAROX7x'
const DEFAULT_PASS_HASH = '4d6dc0567aadbe994e8840da5f4f0e4f20e4bec02eddd1b0a42b655af2bdea79'
const ADMIN_HOURS = 12

const legacyHash = (p: string) => createHash('sha256').update('momomc-admin:' + p).digest('hex')
const scryptHex = (p: string, salt: string) => scryptSync(p, salt, 64).toString('hex')

function safeEq(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export async function checkCredentials(user: string, pass: string) {
  const a = await getAuth()
  if (a.user && a.salt && a.hash && process.env.ADMIN_FORCE_ENV !== 'true') {
    const okUser = safeEq(user, a.user)
    const okPass = safeEq(scryptHex(pass, a.salt), a.hash)
    return okUser && okPass
  }
  const expectedUser = process.env.ADMIN_USERNAME || DEFAULT_USER
  const expectedHash = process.env.ADMIN_PASSWORD ? legacyHash(process.env.ADMIN_PASSWORD) : DEFAULT_PASS_HASH
  const okUser = safeEq(user, expectedUser)
  const okPass = safeEq(legacyHash(pass), expectedHash)
  return okUser && okPass
}

// Saves a new admin username + password and rotates the session key, so every old session stops working.
export async function setCredentials(user: string, pass: string) {
  const a = await getAuth()
  const salt = randomBytes(16).toString('hex')
  await writeKey('auth', {
    ...a,
    user,
    salt,
    hash: scryptHex(pass, salt),
    sessionKey: randomBytes(32).toString('hex'),
  })
}

// ---------------------------------------------------------------------------
// Signed tokens (admin sessions and the Discord visitor cookie)
// ---------------------------------------------------------------------------
async function sessionKey() {
  if (process.env.ADMIN_SESSION_SECRET) return process.env.ADMIN_SESSION_SECRET
  const a = await getAuth()
  if (a.sessionKey) return a.sessionKey
  await writeKey('auth', { ...a, sessionKey: randomBytes(32).toString('hex') })
  return (await getAuth()).sessionKey as string
}

const mac = (key: string, purpose: string, payload: string) =>
  createHmac('sha256', key).update(purpose + '.' + payload).digest('base64url')

export async function seal(purpose: string, data: object, ttlMs: number) {
  const payload = Buffer.from(JSON.stringify({ d: data, exp: Date.now() + ttlMs })).toString('base64url')
  return payload + '.' + mac(await sessionKey(), purpose, payload)
}

export async function unseal<T = Record<string, unknown>>(purpose: string, token: string | undefined | null): Promise<T | null> {
  const [payload, sig] = (token || '').split('.')
  if (!payload || !sig || !safeEq(sig, mac(await sessionKey(), purpose, payload))) return null
  try {
    const v = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return v.exp > Date.now() ? (v.d as T) : null
  } catch {
    return null
  }
}

export const createToken = (user: string) => seal('admin', { u: user }, ADMIN_HOURS * 3600e3)

export async function verifyRequest(req: Request): Promise<string | null> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const d = await unseal<{ u: string }>('admin', token)
  return d?.u ?? null
}

export function readCookie(req: Request, name: string) {
  const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'))
  return m ? decodeURIComponent(m[1]) : undefined
}
