// A real momo (pleated dumpling) drawn as inline SVG. Cheap to animate: one flat vector, no filters.
type Props = { size?: number; tone?: 'steamed' | 'fried'; style?: React.CSSProperties; className?: string }

// point on the quadratic curve used as the pleated seam
const seam = (t: number): [number, number] => {
  const [x0, y0, cx, cy, x1, y1] = [12, 62, 60, 4, 108, 62]
  const u = 1 - t
  return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]
}

export default function Momo({ size = 64, tone = 'steamed', style, className = '' }: Props) {
  const c = tone === 'fried'
    ? { a: '#ffe0a3', b: '#e9a24f', edge: '#b9722c', fold: '#c98235' }
    : { a: '#fffaf0', b: '#f3dcb4', edge: '#d8b884', fold: '#e6c894' }
  const id = `mg-${tone}`
  const pleats = Array.from({ length: 9 }, (_, i) => {
    const t = 0.1 + i * 0.1
    const [x, y] = seam(t)
    // each pleat leans towards the centre of the dumpling
    const dx = (60 - x) * 0.32
    return { x, y, x2: x + dx, y2: y + 15 + Math.sin(t * Math.PI) * 6 }
  })
  return (
    <svg className={'momo ' + className} style={{ width: size, height: size * 0.75, ...style }} viewBox="0 0 120 90" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.a} />
          <stop offset="1" stopColor={c.b} />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="80" rx="46" ry="6" fill="rgba(0,10,30,.35)" />
      <path d="M8 62 C10 30 38 8 60 8 C82 8 110 30 112 62 C112 74 98 80 60 80 C22 80 8 74 8 62 Z" fill={`url(#${id})`} stroke={c.edge} strokeWidth="2" strokeLinejoin="round" />
      {pleats.map((p, i) => (
        <path key={i} d={`M${p.x.toFixed(1)} ${p.y.toFixed(1)} Q${((p.x + p.x2) / 2 + (i % 2 ? 2 : -2)).toFixed(1)} ${((p.y + p.y2) / 2).toFixed(1)} ${p.x2.toFixed(1)} ${p.y2.toFixed(1)}`} fill="none" stroke={c.fold} strokeWidth="2.4" strokeLinecap="round" />
      ))}
      <path d="M12 62 Q60 4 108 62" fill="none" stroke={c.edge} strokeWidth="3.2" strokeLinecap="round" />
      <ellipse cx="38" cy="50" rx="14" ry="6" fill="#fff" opacity=".35" transform="rotate(-24 38 50)" />
    </svg>
  )
}
