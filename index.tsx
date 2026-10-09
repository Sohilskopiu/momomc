import { useEffect, useRef } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { ArrowRight, Copy } from 'lucide-react'
import Momo from '@/components/Momo'
import { AnnouncementCard, DiscordIcon } from '@/components/Cards'
import ModeStatus from '@/components/ModeStatus'
import { modeCfg, modeName, modeServer } from '@/lib/modes'
import { MODES } from '@/lib/types'
import type { Mode } from '@/lib/types'
import { copy, fullAddress, img, useDiscordCount, useReveal, useServerStatus, useSite, useTilt } from '@/lib/ui'

export const Route = createFileRoute('/')({ component: Home })

// Real momos circling the logo: sizes, tone and the offset of each one along the ring.
const ORBIT = [
  { size: 78, tone: 'steamed' as const },
  { size: 64, tone: 'fried' as const },
  { size: 74, tone: 'steamed' as const },
  { size: 58, tone: 'fried' as const },
  { size: 68, tone: 'steamed' as const },
]

function FloatingLogo({ alt }: { alt: string }) {
  const stage = useRef<HTMLDivElement>(null)
  const orbs = useRef<(HTMLDivElement | null)[]>([])

  // Momos travel on an ellipse around the logo. The half of the ring that is "behind" goes behind the logo and shrinks a little.
  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0, t0 = performance.now()
    const place = (now: number) => {
      const el = stage.current
      if (!el) return
      const w = el.clientWidth, h = el.clientHeight
      const rx = w * 0.56, ry = h * 0.36
      const turn = ((now - t0) / 26000) * Math.PI * 2 // one lap every 26 seconds
      ORBIT.forEach((_, i) => {
        const node = orbs.current[i]
        if (!node) return
        const a = turn + (i / ORBIT.length) * Math.PI * 2
        const depth = Math.sin(a) // 1 = in front of the logo, -1 = behind it
        const x = Math.cos(a) * rx
        const y = depth * ry * 0.9 - h * 0.02 + Math.sin(a * 2 + i) * 6
        const sc = 0.82 + 0.22 * depth
        node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${(depth * 140).toFixed(0)}px) translate(-50%, -50%) scale(${sc.toFixed(3)}) rotate(${(Math.sin(a * 1.5 + i) * 10).toFixed(1)}deg)`
        node.style.opacity = String(0.78 + 0.22 * (depth + 1) / 2)
      })
    }
    const loop = (now: number) => { place(now); raf = requestAnimationFrame(loop) }
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden && !reduce) raf = requestAnimationFrame(loop) }
    place(t0)
    if (!reduce) raf = requestAnimationFrame(loop)
    document.addEventListener('visibilitychange', onVis)
    const onSize = () => place(performance.now())
    addEventListener('resize', onSize)
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis); removeEventListener('resize', onSize) }
  }, [])

  useEffect(() => {
    const el = stage.current
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let rx = 0, ry = 0, tx = 0, ty = 0, raf = 0
    // The loop only runs while the logo is still catching up with the pointer, then it sleeps.
    const loop = () => {
      rx += (ty - rx) * 0.08; ry += (tx - ry) * 0.08
      el.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`
      raf = Math.abs(ty - rx) + Math.abs(tx - ry) > 0.04 ? requestAnimationFrame(loop) : 0
    }
    const wake = () => { if (!raf) raf = requestAnimationFrame(loop) }
    const move = (e: PointerEvent) => {
      tx = (e.clientX / innerWidth - 0.5) * 22
      ty = (e.clientY / innerHeight - 0.5) * -16
      wake()
    }
    const orient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return
      tx = Math.max(-1, Math.min(1, e.gamma / 30)) * 14
      ty = Math.max(-1, Math.min(1, (e.beta - 45) / 30)) * -10
      wake()
    }
    addEventListener('pointermove', move, { passive: true })
    addEventListener('deviceorientation', orient)
    return () => { cancelAnimationFrame(raf); removeEventListener('pointermove', move); removeEventListener('deviceorientation', orient) }
  }, [])
  return (
    <div className="hero-stage" ref={stage}>
      <div className="hero-glow" />
      {ORBIT.map((m, i) => (
        <div key={i} className="orb" ref={(el) => { orbs.current[i] = el }}>
          <Momo size={m.size} tone={m.tone} />
        </div>
      ))}
      <div style={{ transform: 'translateZ(80px)', width: '100%', transformStyle: 'preserve-3d' }}>
        <div className="logo-float">
          <img src={img('/img/momo-logo.png', 900)} alt={alt} width={986} height={652} fetchPriority="high" />
        </div>
      </div>
      <div className="logo-shadow" />
    </div>
  )
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  const tilt = useTilt<HTMLDivElement>(10)
  return (
    <div {...tilt} className="glass tilt shine stat">
      <div className="ic">{icon}</div>
      <div><b>{value}</b><small>{label}</small></div>
    </div>
  )
}

function Home() {
  const site = useSite()
  const { settings: s, announcements } = site
  const router = useRouter()
  const discord = useDiscordCount(s.discordInvite)
  const addr = fullAddress(s.ip, s.port)
  useReveal(site)

  // keep announcements live (web + Discord) while the page is open
  useEffect(() => {
    const h = setInterval(() => router.invalidate(), 60_000)
    return () => clearInterval(h)
  }, [router])

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <span className="eyebrow">{s.heroEyebrow}</span>
          <FloatingLogo alt={s.serverName} />
          <h1><span className="grad">{s.heroTitle}</span></h1>
          <p className="sub">{s.heroSubtitle}</p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={() => copy(addr, 'Server IP copied')}><Copy size={17} /> {addr}</button>
            <Link to="/survival" className="btn btn-ghost">{modeCfg(s, 'survival').emoji} Survival <ArrowRight size={17} /></Link>
            <Link to="/lifesteal" className="btn btn-ghost">{modeCfg(s, 'lifesteal').emoji} Lifesteal <ArrowRight size={17} /></Link>
            <a className="btn btn-discord" href={s.discordInvite} target="_blank" rel="noopener"><DiscordIcon size={18} /> Join Discord</a>
          </div>
          <div className="stat-row">
            {MODES.map((m) => <ModeStat key={m} mode={m} />)}
            <Stat icon={<DiscordIcon size={20} />} value={discord ? discord.members.toLocaleString() : 'Join us'} label={discord ? `${discord.online.toLocaleString()} online on Discord` : 'Discord community'} />
          </div>
        </div>
        <div className="scroll-hint" aria-hidden />
      </section>

      {/* How to join */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head reveal">
            <div>
              <span className="eyebrow">Connect</span>
              <h2 className="h2">Join in <span className="grad">seconds</span></h2>
              <p className="lead">Play on PC with Java Edition or on mobile, console and Windows with Bedrock.</p>
            </div>
          </div>
          <div className="join-grid">
            {MODES.map((m, i) => <JoinCard key={m} mode={m} i={i} />)}
          </div>
        </div>
      </section>

      {/* Announcements */}
      {announcements.length > 0 && (
        <section className="section" style={{ paddingTop: 20 }}>
          <div className="wrap">
            <div className="sec-head reveal">
              <div>
                <span className="eyebrow">Latest news</span>
                <h2 className="h2">Announcements</h2>
                <p className="lead">Posted by staff here and on our Discord — synced automatically.</p>
              </div>
              <Link to="/announcements" className="btn btn-ghost btn-sm">All news <ArrowRight size={15} /></Link>
            </div>
            <div className="ann-list">
              {announcements.slice(0, 3).map((a, i) => <AnnouncementCard key={a.id} a={a} i={i} />)}
            </div>
          </div>
        </section>
      )}

      {/* Game modes */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head reveal">
            <div>
              <span className="eyebrow">Game modes</span>
              <h2 className="h2">Pick your <span className="grad">battlefield</span></h2>
            </div>
          </div>
          <div className="mode-grid">
            {MODES.map((m, i) => <ModeCard key={m} mode={m} i={i} />)}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head reveal">
            <div>
              <span className="eyebrow">Why {s.serverName}</span>
              <h2 className="h2">Built for <span className="grad">players</span></h2>
            </div>
          </div>
          <div className="feat-grid">
            {s.features.map((f, i) => (
              <div key={f.title} className="glass feat reveal" style={{ ['--d' as string]: `${i * 80}ms` }}>
                <div className="fi">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      {s.faq.length > 0 && (
        <section className="section">
          <div className="wrap">
            <div className="reveal" style={{ textAlign: 'center', marginBottom: 36 }}>
              <span className="eyebrow">FAQ</span>
              <h2 className="h2">Questions? <span className="grad">Answered.</span></h2>
            </div>
            <div className="faq">
              {s.faq.map((f, i) => (
                <details key={f.q} className="glass reveal" style={{ ['--d' as string]: `${i * 60}ms` }}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap">
          <div className="glass cta reveal">
            <img src={img('/img/momo-logo.png', 500)} alt="" style={{ width: 200, margin: '0 auto 10px', animation: 'floaty 6s ease-in-out infinite' }} />
            <h2 className="h2">Ready to play?</h2>
            <p className="lead" style={{ margin: '0 auto 26px' }}>Copy the IP, launch Minecraft and meet us in-game.</p>
            <div className="hero-actions" style={{ marginTop: 0 }}>
              <button className="btn btn-primary" onClick={() => copy(addr, 'Server IP copied')}><Copy size={17} /> {addr}</button>
              <a className="btn btn-discord" href={s.discordInvite} target="_blank" rel="noopener"><DiscordIcon size={18} /> Join Discord</a>
            </div>
          </div>
        </div>
      </section>

    </>
  )
}

// One live status box per game mode, using that mode's own address.
function ModeStat({ mode }: { mode: Mode }) {
  const { settings: s } = useSite()
  const a = modeServer(s, mode)
  const st = useServerStatus(a.ip, a.port)
  return (
    <Stat
      icon={<span className={'dot ' + (st.loading ? '' : st.online ? 'on' : 'off')} />}
      value={st.loading ? 'Checking…' : st.online ? `${st.players}${st.max ? ' / ' + st.max : ''}` : 'Offline'}
      label={`${modeName(s, mode)} ${st.online ? 'players online' : 'status'}`}
    />
  )
}

function JoinCard({ mode, i }: { mode: Mode; i: number }) {
  const { settings: s } = useSite()
  const a = modeServer(s, mode)
  const java = fullAddress(a.ip, a.port)
  const bedrock = `${a.bedrockIp}:${a.bedrockPort}`
  return (
    <div className="glass join-card reveal" style={{ ['--d' as string]: `${i * 100}ms` }}>
      <span className="badge">{modeCfg(s, mode).emoji} {modeName(s, mode)}</span>
      <h3>Java &amp; Bedrock</h3>
      <div style={{ margin: '0 0 12px' }}><ModeStatus mode={mode} /> <span className="mstat">Version {a.version}</span></div>
      <div className="addr"><div><small>Java address</small>{java}</div><button onClick={() => copy(java, 'Java IP copied')}>Copy</button></div>
      <div className="addr"><div><small>Bedrock address</small>{bedrock}</div><button onClick={() => copy(bedrock, 'Bedrock IP copied')}>Copy</button></div>
    </div>
  )
}

function ModeCard({ mode, i }: { mode: Mode; i: number }) {
  const { settings: s } = useSite()
  const cfg = modeCfg(s, mode)
  const name = modeName(s, mode)
  const tilt = useTilt<HTMLAnchorElement>(8)
  const live = cfg.status === 'live'
  return (
    <Link to={mode === 'survival' ? '/survival' : '/lifesteal'} {...tilt} className="glass tilt shine mode-card reveal" style={{ ['--d' as string]: `${i * 100}ms` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div className="emoji pop">{cfg.emoji}</div>
        <span className={'badge ' + cfg.status}>{live ? '● Live now' : 'Coming soon'}</span>
      </div>
      <h3>{name}</h3>
      <p>{cfg.tagline}</p>
      <div style={{ margin: '0 0 14px' }}><ModeStatus mode={mode} /></div>
      <b style={{ marginTop: 'auto', color: 'var(--cyan2)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {live ? `Open ${name}` : 'Stay tuned'} <ArrowRight size={16} />
      </b>
    </Link>
  )
}
