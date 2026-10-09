import { useEffect, useRef } from 'react'
import { img } from '@/lib/ui'

// Live background: parallax island scene, aurora glow, perspective grid and a light canvas of
// glowing voxel blocks and stars. Tuned to stay smooth on phones:
//  - glow sprites are drawn once and reused (no per-frame shadowBlur)
//  - capped at 30 fps and paused when the tab is hidden
//  - fewer blocks on small screens and weak CPUs
//  - the parallax layer is only touched when the cursor or scroll actually moved
export default function LiveBackground() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const scene = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const c = canvas.current!
    const ctx = c.getContext('2d', { alpha: true })!
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const weak = (navigator.hardwareConcurrency || 4) <= 4
    const COLORS = ['67,220,255', '80,140,255', '120,110,255', '140,236,255']
    const rnd = (a: number, b: number) => a + Math.random() * (b - a)
    let W = 0, H = 0, raf = 0, mx = 0, my = 0, tx = 0, ty = 0, scrollY = 0, last = 0, lastT = ''
    type Block = { x: number; y: number; size: number; vy: number; vx: number; rot: number; vr: number; depth: number; spr: number; a: number }
    let blocks: Block[] = []
    let stars: { x: number; y: number; r: number; p: number; s: number }[] = []

    // One glowing square per colour, drawn a single time.
    const sprites = COLORS.map((col) => {
      const s = document.createElement('canvas')
      s.width = s.height = 72
      const g = s.getContext('2d')!
      g.shadowColor = `rgba(${col},.9)`
      g.shadowBlur = 12
      g.fillStyle = `rgba(${col},.22)`
      g.fillRect(16, 16, 40, 40)
      g.shadowBlur = 0
      g.strokeStyle = `rgba(${col},.75)`
      g.lineWidth = 2
      g.strokeRect(16, 16, 40, 40)
      g.fillStyle = 'rgba(255,255,255,.3)'
      g.fillRect(16, 16, 14, 14)
      return s
    })

    const spawn = (anywhere: boolean): Block => {
      const size = rnd(8, 26)
      return {
        x: rnd(0, W), y: anywhere ? rnd(0, H) : H + size * 2, size,
        vy: rnd(0.1, 0.4), vx: rnd(-0.08, 0.08), rot: rnd(0, 6.28), vr: rnd(-0.005, 0.005),
        depth: rnd(0.4, 1.2), spr: (Math.random() * COLORS.length) | 0, a: rnd(0.35, 0.9),
      }
    }
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, weak ? 1 : 1.5)
      W = innerWidth; H = innerHeight
      c.width = W * dpr; c.height = H * dpr
      c.style.width = W + 'px'; c.style.height = H + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const small = W < 700 || weak
      blocks = [] // the floating glowing blocks were removed, only stars and the aurora remain
      stars = Array.from({ length: Math.min(small ? 30 : 70, Math.round((W * H) / 20000)) }, () => ({
        x: rnd(0, W), y: rnd(0, H), r: rnd(0.8, 1.8), p: rnd(0, 6.28), s: rnd(0.4, 1.2),
      }))
      draw(performance.now())
    }
    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = 'rgb(190,235,255)'
      for (const s of stars) {
        ctx.globalAlpha = 0.2 + 0.6 * Math.abs(Math.sin((t / 1000) * s.s + s.p))
        ctx.fillRect(s.x + mx * 8, s.y + my * 8, s.r, s.r)
      }
      for (const b of blocks) {
        const px = b.size * b.depth * 1.8
        ctx.globalAlpha = b.a * 0.6
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        const dpr = c.width / W
        ctx.translate((b.x + mx * 26 * b.depth) * dpr, (b.y + my * 26 * b.depth - scrollY * 0.05 * b.depth) * dpr)
        ctx.rotate(b.rot)
        ctx.drawImage(sprites[b.spr], (-px / 2) * dpr, (-px / 2) * dpr, px * dpr, px * dpr)
      }
      ctx.globalAlpha = 1
      ctx.setTransform(c.width / W, 0, 0, c.width / W, 0, 0)
    }
    const parallax = () => {
      if (!scene.current) return
      const v = `translate3d(${(mx * -24).toFixed(1)}px, ${(my * -18 - scrollY * 0.08).toFixed(1)}px, 0) scale(1.06)`
      if (v !== lastT) { scene.current.style.transform = v; lastT = v }
    }
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame)
      if (t - last < 33) return // 30 fps is plenty for a background
      last = t
      mx += (tx - mx) * 0.06; my += (ty - my) * 0.06
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i]
        b.y -= b.vy * 2; b.x += b.vx * 2; b.rot += b.vr * 2
        if (b.y < -b.size * 3) blocks[i] = spawn(false)
      }
      draw(t)
      parallax()
    }
    const start = () => { if (!raf && !reduce && !document.hidden) raf = requestAnimationFrame(frame) }
    const stop = () => { cancelAnimationFrame(raf); raf = 0 }
    const onMove = (e: PointerEvent) => { tx = e.clientX / W - 0.5; ty = e.clientY / H - 0.5 }
    const onScroll = () => { scrollY = window.scrollY; if (reduce) parallax() }
    const onVis = () => (document.hidden ? stop() : start())
    resize()
    parallax()
    start()
    addEventListener('resize', resize)
    addEventListener('pointermove', onMove, { passive: true })
    addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVis)
    return () => {
      stop()
      removeEventListener('resize', resize)
      removeEventListener('pointermove', onMove)
      removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return (
    <div className="bg-root" aria-hidden>
      <div ref={scene} className="bg-scene" style={{ backgroundImage: `url(${img('/img/hero-islands.jpg', 1600)})` }} />
      <div className="bg-aurora"><i /><i /><i /></div>
      <div className="bg-grid" />
      <canvas ref={canvas} className="bg-canvas" />
      <div className="bg-vignette" />
    </div>
  )
}
