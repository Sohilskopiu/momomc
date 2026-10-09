import { useCallback, useEffect, useRef, useState } from 'react'
import { useLoaderData } from '@tanstack/react-router'
import type { DiscordUser, PublicSite } from './types'

// Static files from /public (the big logo is pre-converted to a small .webp).
// The logo is the built-in one unless the owner uploaded their own in Admin Panel > Theme & Logo.
export const DEFAULT_LOGO = '/img/momo-logo.webp'
let LOGO = DEFAULT_LOGO
export const setLogo = (version?: number) => { LOGO = version ? `/logo?v=${version}` : DEFAULT_LOGO }
export const img = (path: string, _w?: number) => (path === '/img/momo-logo.png' ? LOGO : path)

export const useSite = () => useLoaderData({ from: '__root__' }) as PublicSite

export const formatPrice = (currency: string, price: number | null) =>
  price == null ? null : currency + price.toLocaleString('en-IN')

export const fullAddress = (ip: string, port: string) => (port && port !== '25565' ? `${ip}:${port}` : ip)

export const timeAgo = (iso: string) => {
  const s = (Date.now() - Date.parse(iso)) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`
  return new Date(iso).toLocaleDateString()
}

// ---------- toast ----------
type ToastState = { msg: string; err?: boolean } | null
let pushToast: (t: ToastState) => void = () => {}
export const toast = (msg: string, err = false) => pushToast({ msg, err })

export function Toaster() {
  const [t, setT] = useState<ToastState>(null)
  useEffect(() => {
    let h: ReturnType<typeof setTimeout>
    pushToast = (x) => {
      setT(x)
      clearTimeout(h)
      h = setTimeout(() => setT(null), 2600)
    }
  }, [])
  return t ? <div className={'toast' + (t.err ? ' err' : '')}>{t.msg}</div> : null
}

export async function copy(text: string, label = 'Copied') {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* clipboard blocked; still show the value */
  }
  toast(`${label}: ${text}`)
}

// ---------- 3D tilt + cursor shine ----------
export function useTilt<T extends HTMLElement>(max = 10) {
  const ref = useRef<T>(null)
  const onMove = useCallback(
    (e: React.PointerEvent) => {
      const el = ref.current
      if (!el || e.pointerType === 'touch') return
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
      el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max}deg) translateZ(0)`
      el.style.setProperty('--mx', `${x * 100}%`)
      el.style.setProperty('--my', `${y * 100}%`)
    },
    [max],
  )
  const onLeave = useCallback(() => {
    if (ref.current) ref.current.style.transform = ''
  }, [])
  return { ref, onPointerMove: onMove, onPointerLeave: onLeave }
}

// ---------- scroll reveal ----------
export function useReveal(dep?: unknown) {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal:not(.in)')
    if (!('IntersectionObserver' in window)) return els.forEach((e) => e.classList.add('in'))
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }),
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [dep])
}

// ---------- live Minecraft server status ----------
export type ServerStatus = { online: boolean; players: number; max: number; loading: boolean }
export function useServerStatus(ip: string, port: string) {
  const [s, setS] = useState<ServerStatus>({ online: false, players: 0, max: 0, loading: true })
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const r = await fetch('https://api.mcsrvstat.us/3/' + fullAddress(ip, port))
        const d = await r.json()
        if (alive) setS({ online: !!d.online, players: d.players?.online ?? 0, max: d.players?.max ?? 0, loading: false })
      } catch {
        if (alive) setS((x) => ({ ...x, loading: false }))
      }
    }
    load()
    const h = setInterval(load, 30000)
    return () => { alive = false; clearInterval(h) }
  }, [ip, port])
  return s
}

// ---------- Discord member count ----------
export function useDiscordCount(invite: string) {
  const [n, setN] = useState<{ online: number; members: number } | null>(null)
  useEffect(() => {
    const code = invite.split('/').filter(Boolean).pop()
    if (!code) return
    fetch(`https://discord.com/api/v10/invites/${code}?with_counts=true`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setN({ online: d.approximate_presence_count ?? 0, members: d.approximate_member_count ?? 0 }))
      .catch(() => {})
  }, [invite])
  return n
}

// ---------- Discord login (visitor) ----------
// One shared store, so the login gate, header and cart all react to login / logout together.
let visitor: DiscordUser | null | undefined
let inflight = false
const listeners = new Set<() => void>()
const setVisitor = (u: DiscordUser | null) => { visitor = u; listeners.forEach((l) => l()) }
// Result of the Discord login round-trip. The URL is cleaned right away, so it is kept here for the login screen.
const RESULT_KEY = 'momo_login_result'
export type LoginResult = { login: string; why?: string; ru?: string }
export const saveLoginResult = (r: LoginResult | null) => { try { r ? sessionStorage.setItem(RESULT_KEY, JSON.stringify(r)) : sessionStorage.removeItem(RESULT_KEY) } catch { /* private mode */ } }
export const readLoginResult = (): LoginResult | null => { try { return JSON.parse(sessionStorage.getItem(RESULT_KEY) || 'null') } catch { return null } }
export const discordLoginUrl = () => '/api/auth/discord?return=' + encodeURIComponent(location.pathname + location.search)

export function useDiscordUser() {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    if (visitor === undefined && !inflight) {
      inflight = true
      fetch('/api/auth/me')
        .then((r) => r.json())
        .then((d) => setVisitor(d.user ?? null))
        .catch(() => setVisitor(null))
        .finally(() => { inflight = false })
    } else l()
    return () => { listeners.delete(l) }
  }, [])
  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    setVisitor(null)
    toast('Logged out')
  }, [])
  return { user: visitor ?? null, loading: visitor === undefined, logout }
}
